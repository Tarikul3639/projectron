import { Injectable } from '@nestjs/common';
import { Tool } from '@nestjs/mcp';
import * as s from '../schemas/orchestration.schemas.js';
import type * as t from '../types/orchestration.type.js';
import { AiPlannerService } from '../services/ai-planner.service.js';
import { OrchestrationService } from '../services/orchestration.service.js';
import { AgentExecutionService } from '../services/agent-execution.service.js';
import type { McpContext } from '@nestjs/mcp';

/** MCP tools for AI planning and tracking multi-step work. */
@Injectable()
export class OrchestrationTools {
  /** Initializes the tool handlers and their dependencies. */
  constructor(
    private readonly orchestration: OrchestrationService,
    private readonly planner: AiPlannerService,
    private readonly executor: AgentExecutionService,
  ) {}

  /** Lists the registered tools available to orchestration plans. */
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

  /** Creates and persists an execution plan from a natural-language goal. */
  @Tool({
    name: 'orchestration_plan_from_goal',
    description:
      'Convert a natural-language goal into a validated, persisted plan using the configured AI provider. This does not execute tools.',
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

  /** Requests approval for a pending step before allowing it to be queued. */
  @Tool({
    name: 'orchestration_approve_step',
    description:
      'Request explicit user approval for one planned step. Approval is bound to this task and step; it does not execute the step.',
    inputSchema: s.orchestrationStepApprovalSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
  })
  approveStep(
    input: { taskId: string; stepId: string; clientId: string },
    context: McpContext,
  ) {
    return this.executor.approveStep(input, context);
  }

  /** Executes the next eligible step while preventing concurrent execution of the same task. */
  @Tool({
    name: 'orchestration_execute_next',
    description:
      'Execute or resume the next dependency-ready step of a persisted task. Supply clientId for approval-aware domain tools. Executes at most one step per call; failed steps are retried on later calls up to their configured maxAttempts (default 3). Required approvals are requested separately.',
    inputSchema: s.orchestrationExecuteSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  })
  executeNext(
    input: { taskId: string; clientId: string },
    context: McpContext,
  ) {
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

  /** Creates plan using the supplied input. */
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

  /** Lists the available tasks. */
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

  /** Returns task from the service. */
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

  /** Updates step using the supplied input. */
  @Tool({
    name: 'orchestration_update_step',
    description:
      'Advance a step state after an external executor or user reports the result. Dependencies must be completed before a step can run.',
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
