import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { McpContext } from '@nestjs/mcp';
import { McpRegistry } from '@nestjs/mcp';
import { OrchestrationService } from './orchestration.service.js';
import type {
  OrchestrationStep,
  OrchestrationTask,
} from '../types/orchestration.type.js';

type McpToolEntry = McpRegistry['tools'][number];

/** Executes dependency-ready orchestration steps through registered MCP tools. */
@Injectable()
export class AgentExecutionService {
  private readonly activeTaskLocks = new Set<string>();

  /** Creates the service and initializes its dependencies. */
  constructor(
    private readonly orchestration: OrchestrationService,
    private readonly registry: McpRegistry,
  ) {}

  /** Executes the next eligible step while preventing concurrent task execution. */
  async executeNext(input: { taskId: string }, context: McpContext) {
    if (this.activeTaskLocks.has(input.taskId)) {
      throw new BadRequestException(
        'Another execution call already holds the lock for this task',
      );
    }

    this.activeTaskLocks.add(input.taskId);
    try {
      return await this.executeNextLocked(input, context);
    } finally {
      this.activeTaskLocks.delete(input.taskId);
    }
  }

  /** Executes one dependency-ready task step while the task lock is held. */
  private async executeNextLocked(
    input: { taskId: string },
    context: McpContext,
  ) {
    let task = await this.orchestration.getTask(input.taskId);
    if (['completed', 'failed', 'cancelled'].includes(task.status)) return task;

    let step = task.steps.find((candidate) => candidate.status === 'running');
    if (!step) {
      step = task.steps.find(
        (candidate) =>
          candidate.status === 'queued' &&
          candidate.dependsOn.every(
            (dependency) =>
              task.steps.find((item) => item.id === dependency)?.status ===
              'completed',
          ),
      );
    }

    if (!step) {
      step = task.steps.find(
        (candidate) =>
          candidate.status === 'failed' &&
          (candidate.attempts?.length ?? 0) < (candidate.maxAttempts ?? 3) &&
          candidate.dependsOn.every(
            (dependency) =>
              task.steps.find((item) => item.id === dependency)?.status ===
              'completed',
          ),
      );
      if (step) {
        task = await this.orchestration.updateStep({
          taskId: task.id,
          stepId: step.id,
          status: 'queued',
        });
        step = this.findStep(task, step.id);
      }
    }

    if (!step) {
      return { task, message: 'No dependency-ready step is available.' };
    }

    const tool = this.registry.tools.find(
      (candidate) => candidate.name === step!.toolName,
    );
    if (!tool) {
      throw new NotFoundException(
        'Registered MCP tool is no longer available: ' + step.toolName,
      );
    }

    try {
      if (step.status === 'queued') {
        task = await this.orchestration.updateStep({
          taskId: task.id,
          stepId: step.id,
          status: 'running',
        });
        step = this.findStep(task, step.id);
      }

      const result = await this.invoke(tool, step, context);
      return this.orchestration.updateStep({
        taskId: task.id,
        stepId: step.id,
        status: 'completed',
        result,
      });
    } catch (error) {
      await this.orchestration.updateStep({
        taskId: task.id,
        stepId: step.id,
        status: 'failed',
        error:
          error instanceof Error
            ? error.message.slice(0, 4_000)
            : 'Tool execution failed',
      });
      throw error;
    }
  }

  /** Validates planned input and invokes the registered MCP tool. */
  private async invoke(
    tool: McpToolEntry,
    step: OrchestrationStep,
    context: McpContext,
  ): Promise<unknown> {
    let validatedInput: unknown = step.input;
    if (tool.inputSchema) {
      const checked = await tool.inputSchema['~standard'].validate(step.input);
      if (checked.issues) {
        throw new BadRequestException({
          message: 'Planned input failed MCP tool schema validation',
          tool: tool.name,
          issues: checked.issues,
        });
      }
      validatedInput = checked.value;
    }

    const toolContext: McpContext = {
      ...context,
      kind: 'tool',
      name: tool.name,
    };
    const result = await tool.handler(validatedInput, toolContext);
    if (
      result &&
      typeof result === 'object' &&
      'isError' in result &&
      result.isError === true
    ) {
      throw new BadRequestException({
        message: 'MCP tool returned an error',
        tool: tool.name,
        result,
      });
    }

    if (tool.outputSchema && result !== undefined) {
      const checked = await tool.outputSchema['~standard'].validate(result);
      if (checked.issues) {
        throw new BadRequestException({
          message: 'MCP tool output failed schema validation',
          tool: tool.name,
        });
      }
    }
    return result;
  }

  /** Finds a task step and reports when it does not exist. */
  private findStep(task: OrchestrationTask, stepId: string): OrchestrationStep {
    const step = task.steps.find((candidate) => candidate.id === stepId);
    if (!step) {
      throw new NotFoundException('Orchestration step not found: ' + stepId);
    }
    return step;
  }
}
