import { describe, expect, it, vi } from 'vitest';
import { ActivitySummaryService } from './activity-summary.service.js';

describe('ActivitySummaryService', () => {
  it('counts outcomes and sums known durations', async () => {
    const query = {
      recent: vi
        .fn()
        .mockResolvedValue([
          { status: 'success', durationMs: 10 },
          { status: 'error', durationMs: 5 },
          { status: 'running' },
        ]),
    };
    const service = new ActivitySummaryService(query as never);
    await expect(service.summarize()).resolves.toEqual({
      total: 3,
      running: 1,
      succeeded: 1,
      failed: 1,
      totalDurationMs: 15,
    });
  });
});
