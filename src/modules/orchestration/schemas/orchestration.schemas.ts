import { z } from 'zod';
export const emptyOrchestrationInputSchema = z.object({});
export const planFromGoalSchema = z.object({
  goal: z.string().trim().min(1).max(2_000),
});
export const createOrchestrationPlanSchema = z.object({
  goal: z.string().trim().min(1).max(2_000),
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
        input: z.record(z.string(), z.json()).optional(),
        dependsOn: z.array(z.string().trim().min(1).max(64)).max(50).optional(),
        maxAttempts: z.number().int().min(1).max(5).optional(),
      }),
    )
    .min(1)
    .max(50),
});
export const orchestrationTaskIdSchema = z.object({
  taskId: z.string().uuid(),
});
export const orchestrationCancelSchema = z.object({
  taskId: z.string().uuid(),
});
export const orchestrationExecuteSchema = z.object({
  taskId: z.string().uuid(),
});
export const updateOrchestrationStepSchema = z.object({
  taskId: z.string().uuid(),
  stepId: z.string().trim().min(1).max(64),
  status: z.enum(['queued', 'running', 'completed', 'failed', 'skipped']),
  result: z.json().optional(),
  error: z.string().max(4_000).optional(),
});
