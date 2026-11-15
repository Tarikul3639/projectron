import * as z from 'zod';

const identifier = z.string().trim().min(1).max(256);

/** All Activity Logging input/output schemas live in this single module schema file. */
export const executionStepSchema = z
  .object({
    name: z.string().trim().min(1).max(500),
    status: z.enum(['started', 'completed', 'info', 'warning', 'error']),
    durationMs: z.number().int().nonnegative().optional(),
    details: z.unknown().optional(),
  })
  .strict();

export const toolExecutionInputSchema = z
  .object({
    tool: identifier,
    input: z.unknown(),
    taskId: identifier.optional(),
  })
  .strict();

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
export const archiveLogsSchema = z
  .object({
    reason: z.string().trim().min(1).max(256).default('manual'),
  })
  .strict();
export const emptyActivityLoggingSchema = z.object({}).strict();

export const activityRecordSchema = z
  .object({
    type: identifier,
    description: z.string().trim().min(1).max(4000),
    status: z.enum(['completed', 'failed', 'partial']),
    executionIds: z.array(z.string().uuid()).max(500).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const activityReportSchema = z
  .object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    limit: z.number().int().min(1).max(5000).default(500),
  })
  .strict();
