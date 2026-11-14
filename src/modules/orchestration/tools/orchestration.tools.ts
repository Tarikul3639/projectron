import { Injectable } from '@nestjs/common';
import { Tool, type McpContext } from '@nestjs/mcp';
import * as s from '../schemas/orchestration.schemas.js';
import type * as t from '../types/orchestration.type.js';
import { AiPlannerService } from '../services/ai-planner.service.js';
import { OrchestrationService } from '../services/orchestration.service.js';
import { AgentExecutionService } from '../services/agent-execution.service.js';

/** MCP tools for planning, executing, and tracking multi-step work. */
@Injectable()
export class OrchestrationTools {
  /** Initializes orchestration services. */
  constructor(
    private readonly orchestration: OrchestrationService,
    private readonly planner: AiPlannerService,
    private readonly executor: AgentExecutionService,
  ) {}

  /** Lists registered tools available to orchestration plans. */
  @Tool({
    name: 'orchestration_list_tools',
    description:
      'List registered Projectron tools available to an orchestration plan.',
    inputSchema: s.emptyOrchestrationInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  listAvailableTools() {
    return this.orchestration.listAvailableTools();
  }

  /** Generates and persists a plan from a natural-language goal. */
  @Tool({
    name: 'orchestration_plan_from_goal',
    description:
      'Convert a natural-language goal into a validated, persisted plan. This does not execute tools.',
    inputSchema: s.planFromGoalSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
  })
  planFromGoal(input: { goal: string }) {
    return this.planner.plan(input.goal);
  }

  /** Executes the next dependency-ready step of a persisted task. */
  @Tool({
    name: 'orchestration_execute_next',
    description:
      'Execute or resume the next dependency-ready step of a persisted task. Executes at most one step per call; failed steps are retried on later calls up to their configured maxAttempts (default 3).',
    inputSchema: s.orchestrationExecuteSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  })
  executeNext(input: { taskId: string }, context: McpContext) {
    return this.executor.executeNext(input, context);
  }

  /** Cancels a task that has no actively running tool step. */
  @Tool({
    name: 'orchestration_cancel_task',
    description:
      'Cancel a task that has no actively running tool step. Pending and retryable steps are marked skipped; active tool operations must finish before cancellation.',
    inputSchema: s.orchestrationCancelSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  })
  cancelTask(input: { taskId: string }) {
    return this.orchestration.cancelTask(input.taskId);
  }

  /** Creates a persisted multi-step task plan. */
  @Tool({
    name: 'orchestration_create_plan',
    description:
      'Create a persisted multi-step task plan. Every step must reference a registered tool; no tool is executed automatically.',
    inputSchema: s.createOrchestrationPlanSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
  })
  createPlan(input: t.CreateOrchestrationPlanInput) {
    return this.orchestration.createPlan(input);
  }

  /** Lists persisted tasks, newest first. */
  @Tool({
    name: 'orchestration_list_tasks',
    description: 'List persisted orchestration tasks, newest first.',
    inputSchema: s.emptyOrchestrationInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  listTasks() {
    return this.orchestration.listTasks();
  }

  /** Returns a task plan and its current execution state. */
  @Tool({
    name: 'orchestration_get_task',
    description:
      'Get a task plan, its steps, dependencies, and current execution state.',
    inputSchema: s.orchestrationTaskIdSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  getTask(input: { taskId: string }) {
    return this.orchestration.getTask(input.taskId);
  }

  /** Updates a step after an external executor reports its result. */
  @Tool({
    name: 'orchestration_update_step',
    description:
      'Advance a step state after an external executor reports the result. Dependencies must be completed before a step can run.',
    inputSchema: s.updateOrchestrationStepSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
  })
  updateStep(input: t.UpdateOrchestrationStepInput) {
    return this.orchestration.updateStep(input);
  }
}
