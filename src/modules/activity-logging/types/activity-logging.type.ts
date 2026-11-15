import type { z } from 'zod';
import type {
  activityRecordSchema,
  activityReportSchema,
  toolExecutionInputSchema,
  toolExecutionSearchSchema,
} from '../schemas/activity-logging.schemas.js';

export type ToolExecutionInput = z.infer<typeof toolExecutionInputSchema>;
export type ToolExecutionSearchInput = z.infer<
  typeof toolExecutionSearchSchema
>;
export type ActivityRecordInput = z.infer<typeof activityRecordSchema>;
export type ActivityReportInput = z.infer<typeof activityReportSchema>;
