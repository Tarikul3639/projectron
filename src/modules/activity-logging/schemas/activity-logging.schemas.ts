import * as z from 'zod';

const identifier = z.string().trim().min(1).max(256);

export const toolExecutionSearchSchema = z
  .object({
    executionId: z.string().uuid().optional(),
    tool: identifier.optional(),
    status: z.enum(['running', 'success', 'error']).optional(),
    limit: z.number().int().min(1).max(500).default(50),
  })
  .strict();

export const executionIdSchema = z
  .object({ executionId: z.string().uuid() })
  .strict();

export const recentExecutionsSchema = z
  .object({
    limit: z.number().int().min(1).max(500).default(50),
  })
  .strict();
