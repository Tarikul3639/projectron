import { describe, expect, it } from 'vitest';
import {
  activityRecordSchema,
  activityReportSchema,
  executionStepSchema,
  toolExecutionInputSchema,
  toolExecutionSearchSchema,
} from './activity-logging.schemas.js';

describe('Activity Logging schemas', () => {
  it('validates tool input while allowing arbitrary payloads', () => {
    expect(
      toolExecutionInputSchema.parse({
        tool: 'filesystem_read',
        input: { path: 'src/main.ts', nested: [1, true] },
      }),
    ).toMatchObject({ tool: 'filesystem_read' });
  });
  it('validates execution trace steps and bounded search options', () => {
    expect(
      executionStepSchema.safeParse({ name: 'read file', status: 'completed' })
        .success,
    ).toBe(true);
    expect(toolExecutionSearchSchema.parse({ limit: 20 }).limit).toBe(20);
    expect(toolExecutionSearchSchema.safeParse({ limit: 501 }).success).toBe(
      false,
    );
  });
  it('validates activity and report filters', () => {
    expect(
      activityRecordSchema.safeParse({
        type: 'task',
        description: 'Updated source',
        status: 'completed',
      }).success,
    ).toBe(true);
    expect(
      activityReportSchema.safeParse({ from: '2026-11-01T00:00:00.000Z' })
        .success,
    ).toBe(true);
  });
});
