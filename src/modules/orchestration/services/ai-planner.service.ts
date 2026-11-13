import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { z } from 'zod';
import { OrchestrationService } from './orchestration.service.js';
import { AI_PROVIDER } from '../interfaces/ai-provider.interface.js';
import type { AiProvider } from '../interfaces/ai-provider.interface.js';
import type { CreateOrchestrationPlanInput } from '../types/orchestration.type.js';

const generatedPlanSchema = z.object({
  steps: z
    .array(
      z.object({
        id: z
          .string()
          .trim()
          .min(1)
          .max(64)
          .regex(/^[a-zA-Z0-9_-]+$/),
        title: z.string().trim().min(1).max(200),
        toolName: z.string().trim().min(1).max(128),
        input: z.record(z.string(), z.unknown()).optional(),
        dependsOn: z.array(z.string().trim().min(1).max(64)).max(50).optional(),
        requiresApproval: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(50),
});

/** Converts a natural-language goal into a validated, persisted plan. */
@Injectable()
export class AiPlannerService {
  /** Creates the service and initializes its dependencies. */
  constructor(
    @Inject(AI_PROVIDER) private readonly provider: AiProvider,
    private readonly orchestration: OrchestrationService,
  ) {}

  /** Generates, validates, and persists an execution plan for the supplied goal. */
  async plan(goal: string) {
    const normalizedGoal = goal.trim();
    if (!normalizedGoal || normalizedGoal.length > 2_000) {
      throw new BadRequestException('Goal must contain 1 to 2000 characters');
    }
    const tools = this.orchestration.listAvailableTools();
    const catalog = tools.map(({ name, description }) => ({
      name,
      description,
    }));
    const raw = await this.provider.completeJson([
      {
        role: 'system',
        content: [
          'You are Projectron Planner. Convert the user goal into a safe, ordered execution plan.',
          'Return only a JSON object with a "steps" array.',
          'Each step must contain id, title, toolName, input, dependsOn, and requiresApproval.',
          'Use only exact tool names from the supplied catalog. Never invent tools.',
          'Use dependencies to express ordering. Keep the plan minimal and specific.',
          'Do not claim that actions have been executed.',
          'Set requiresApproval=true for any step that changes files, runs commands, changes system state, sends data externally, or has uncertain impact.',
        ].join(' '),
      },
      {
        role: 'user',
        content: JSON.stringify({
          goal: normalizedGoal,
          availableTools: catalog,
        }),
      },
    ]);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new BadGatewayException('AI planner returned invalid JSON');
    }
    const result = generatedPlanSchema.safeParse(parsed);
    if (!result.success)
      throw new BadGatewayException(
        'AI planner returned an invalid plan structure',
      );

    const available = new Set(tools.map((tool) => tool.name));
    for (const step of result.data.steps) {
      if (!available.has(step.toolName))
        throw new BadGatewayException(
          `AI planner referenced an unavailable tool: ${step.toolName}`,
        );
    }
    const input: CreateOrchestrationPlanInput = {
      goal: normalizedGoal,
      steps: result.data.steps.map((step) => ({
        ...step,
        // Model output is untrusted: default to approval unless the tool is clearly read-only.
        requiresApproval:
          step.requiresApproval === true || !this.isReadOnlyTool(step.toolName),
      })),
    };
    return this.orchestration.createPlan(input);
  }

  /** Determines whether the named tool is classified as read-only. */
  private isReadOnlyTool(toolName: string): boolean {
    const action = toolName.split('_').slice(1).join('_');
    return (
      /^(list|get|read|search|inspect|discover|check|status|info|show)(_|$)/.test(
        action,
      ) &&
      !/(write|create|delete|remove|update|move|copy|run|execute|send|install|archive|restore)/.test(
        action,
      )
    );
  }
}
