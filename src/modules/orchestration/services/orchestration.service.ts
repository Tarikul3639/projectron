import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { McpRegistry } from '@nestjs/mcp';
import { JsonStorageService } from '../../storage/json-storage.service.js';
import type {
  CreateOrchestrationPlanInput,
  OrchestrationStep,
  OrchestrationTask,
  OrchestrationTaskStatus,
  UpdateOrchestrationStepInput,
} from '../types/orchestration.type.js';

const STORAGE_PATH = 'orchestration/tasks.json';

/** Plans multi-step work and tracks execution without taking ownership of domain tools. */
@Injectable()
export class OrchestrationService {
  /** Creates the service and initializes its dependencies. */
  constructor(
    private readonly storage: JsonStorageService,
    private readonly registry: McpRegistry,
  ) {}

  /** Returns the registered MCP tool catalog available to an orchestrator. */
  listAvailableTools() {
    return this.registry.tools.map((tool) => ({
      name: tool.name,
      description: tool.options.description ?? '',
    }));
  }

  /** Creates a validated dependency graph for a user goal. */
  async createPlan(
    input: CreateOrchestrationPlanInput,
  ): Promise<OrchestrationTask> {
    const availableTools = new Map(
      this.registry.tools.map((tool) => [tool.name, tool]),
    );
    const ids = new Set(input.steps.map((step) => step.id));

    if (ids.size !== input.steps.length) {
      throw new BadRequestException('Step IDs must be unique');
    }

    for (const step of input.steps) {
      const registeredTool = availableTools.get(step.toolName);
      if (!registeredTool) {
        throw new BadRequestException(`Unknown tool: ${step.toolName}`);
      }
      for (const dependency of step.dependsOn ?? []) {
        if (!ids.has(dependency)) {
          throw new BadRequestException(
            `Step "${step.id}" depends on unknown step "${dependency}"`,
          );
        }
        if (dependency === step.id) {
          throw new BadRequestException('A step cannot depend on itself');
        }
      }
    }

    this.assertAcyclic(input.steps);

    const now = new Date().toISOString();
    const task: OrchestrationTask = {
      id: randomUUID(),
      goal: input.goal,
      status: 'planned',
      createdAt: now,
      updatedAt: now,
      steps: input.steps.map((step): OrchestrationStep => {
        const registeredTool = availableTools.get(step.toolName)!;
        const requiresApproval =
          step.requiresApproval === true ||
          registeredTool.options.annotations?.readOnlyHint !== true;
        return {
          id: step.id,
          title: step.title,
          toolName: step.toolName,
          input: step.input ?? {},
          dependsOn: step.dependsOn ?? [],
          requiresApproval,
          maxAttempts: Math.min(5, Math.max(1, step.maxAttempts ?? 3)),
          attempts: [],
          status: requiresApproval ? 'awaiting_approval' : 'queued',
          createdAt: now,
          updatedAt: now,
        };
      }),
    };

    const tasks = await this.readTasks();
    tasks.push(task);
    await this.storage.write(STORAGE_PATH, tasks);
    return task;
  }

  /** Lists persisted orchestration tasks, newest first. */
  async listTasks(): Promise<OrchestrationTask[]> {
    return (await this.readTasks()).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }

  /** Gets one persisted task by UUID. */
  async getTask(taskId: string): Promise<OrchestrationTask> {
    const task = (await this.readTasks()).find((item) => item.id === taskId);
    if (!task) {
      throw new NotFoundException(`Orchestration task not found: ${taskId}`);
    }
    return task;
  }

  /** Marks a step approved only after the Approval module confirms the decision. */
  async approveStep(
    taskId: string,
    stepId: string,
  ): Promise<OrchestrationTask> {
    const tasks = await this.readTasks();
    const task = tasks.find((item) => item.id === taskId);
    if (!task)
      throw new NotFoundException(`Orchestration task not found: ${taskId}`);
    if (['completed', 'failed', 'cancelled'].includes(task.status)) {
      throw new BadRequestException('The task is already in a terminal state');
    }
    const step = task.steps.find((item) => item.id === stepId);
    if (!step) throw new NotFoundException(`Step not found: ${stepId}`);
    if (!step.requiresApproval || step.status !== 'awaiting_approval') {
      throw new BadRequestException('Step is not awaiting approval');
    }
    step.requiresApproval = false;
    step.approvedAt = new Date().toISOString();
    step.status = 'queued';
    step.updatedAt = new Date().toISOString();
    task.updatedAt = step.updatedAt;
    await this.storage.write(STORAGE_PATH, tasks);
    return task;
  }

  /** Cancels a task when no tool step is actively running. */
  async cancelTask(taskId: string): Promise<OrchestrationTask> {
    const tasks = await this.readTasks();
    const task = tasks.find((item) => item.id === taskId);
    if (!task)
      throw new NotFoundException(`Orchestration task not found: ${taskId}`);
    if (['completed', 'failed', 'cancelled'].includes(task.status)) {
      throw new BadRequestException('The task is already in a terminal state');
    }
    if (task.steps.some((step) => step.status === 'running')) {
      throw new BadRequestException(
        'Cannot safely cancel while a tool step is running; wait for it to finish, then cancel the task',
      );
    }
    const now = new Date().toISOString();
    for (const step of task.steps) {
      if (['queued', 'awaiting_approval', 'failed'].includes(step.status)) {
        step.status = 'skipped';
        step.completedAt = now;
        step.updatedAt = now;
      }
    }
    task.status = 'cancelled';
    task.completedAt = now;
    task.updatedAt = now;
    await this.storage.write(STORAGE_PATH, tasks);
    return task;
  }

  /** Applies a guarded state transition to a planned step. */
  async updateStep(
    input: UpdateOrchestrationStepInput,
  ): Promise<OrchestrationTask> {
    const tasks = await this.readTasks();
    const task = tasks.find((item) => item.id === input.taskId);
    if (!task) {
      throw new NotFoundException(
        `Orchestration task not found: ${input.taskId}`,
      );
    }
    if (['completed', 'failed', 'cancelled'].includes(task.status)) {
      throw new BadRequestException('The task is already in a terminal state');
    }

    const step = task.steps.find((item) => item.id === input.stepId);
    if (!step) {
      throw new NotFoundException(`Step not found: ${input.stepId}`);
    }

    this.assertTransition(step.status, input.status);

    if (input.status === 'running') {
      const incomplete = step.dependsOn.filter(
        (dependency) =>
          task.steps.find((item) => item.id === dependency)?.status !==
          'completed',
      );
      if (incomplete.length > 0) {
        throw new BadRequestException(
          `Dependencies are not complete: ${incomplete.join(', ')}`,
        );
      }
      if (step.requiresApproval) {
        throw new BadRequestException('This step requires explicit approval');
      }
      const startedAt = new Date().toISOString();
      step.startedAt ??= startedAt;
      step.completedAt = undefined;
      step.attempts ??= [];
      step.attempts.push({
        attempt: step.attempts.length + 1,
        startedAt,
        status: 'running',
      });
    }

    const now = new Date().toISOString();
    step.status = input.status;
    step.updatedAt = now;
    if (input.result !== undefined) step.result = input.result;
    if (input.error !== undefined) step.error = input.error;
    if (['completed', 'failed', 'skipped'].includes(input.status)) {
      step.completedAt = now;
      const attempt = step.attempts?.at(-1);
      if (
        attempt?.status === 'running' &&
        (input.status === 'completed' || input.status === 'failed')
      ) {
        attempt.status = input.status;
        attempt.finishedAt = now;
        if (input.error) attempt.error = input.error;
      }
    }

    task.updatedAt = now;
    task.status = this.deriveTaskStatus(task.steps);
    if (['completed', 'failed', 'cancelled'].includes(task.status)) {
      task.completedAt = now;
    }

    await this.storage.write(STORAGE_PATH, tasks);
    return task;
  }

  /** Reads tasks and returns the requested content. */
  private async readTasks(): Promise<OrchestrationTask[]> {
    if (!(await this.storage.exists(STORAGE_PATH))) return [];
    return this.storage.read<OrchestrationTask[]>(STORAGE_PATH);
  }

  /** Handles assert transition for the component. */
  private assertTransition(
    current: OrchestrationStep['status'],
    next: OrchestrationStep['status'],
  ): void {
    const allowed: Record<OrchestrationStep['status'], string[]> = {
      queued: ['running', 'awaiting_approval', 'skipped'],
      awaiting_approval: ['skipped'],
      running: ['completed', 'failed'],
      completed: [],
      failed: ['queued'],
      skipped: [],
    };
    if (!allowed[current].includes(next)) {
      throw new BadRequestException(
        `Invalid step transition: ${current} -> ${next}`,
      );
    }
  }

  /** Handles derive task status for the component. */
  private deriveTaskStatus(
    steps: OrchestrationStep[],
  ): OrchestrationTaskStatus {
    if (steps.every((step) => ['completed', 'skipped'].includes(step.status))) {
      return 'completed';
    }
    const exhaustedFailure = steps.some(
      (step) =>
        step.status === 'failed' &&
        (step.attempts?.length ?? 0) >= (step.maxAttempts ?? 3),
    );
    if (exhaustedFailure) return 'failed';
    if (
      steps.some(
        (step) => step.status === 'failed' || step.status === 'running',
      )
    )
      return 'in_progress';
    if (steps.some((step) => step.status !== 'queued')) return 'in_progress';
    return 'planned';
  }

  /** Handles assert acyclic for the component. */
  private assertAcyclic(steps: CreateOrchestrationPlanInput['steps']): void {
    const dependencies = new Map(
      steps.map((step) => [step.id, step.dependsOn ?? []]),
    );
    const visiting = new Set<string>();
    const visited = new Set<string>();

    const visit = (id: string): void => {
      if (visiting.has(id)) {
        throw new BadRequestException('Step dependencies contain a cycle');
      }
      if (visited.has(id)) return;
      visiting.add(id);
      for (const dependency of dependencies.get(id) ?? []) visit(dependency);
      visiting.delete(id);
      visited.add(id);
    };

    for (const step of steps) visit(step.id);
  }
}
