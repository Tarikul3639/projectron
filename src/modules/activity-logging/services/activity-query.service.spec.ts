import { describe, expect, it, vi } from 'vitest';
import { ActivityQueryService } from './activity-query.service.js';

describe('ActivityQueryService', () => {
  it('queries recent records and one execution trace', async () => {
    const logs = {
      getRecentTechnicalLogs: vi.fn().mockResolvedValue([{ id: 'a' }]),
      getExecutionTrace: vi
        .fn()
        .mockResolvedValue([{ eventType: 'tool.started' }]),
    };
    const service = new ActivityQueryService(logs as never);
    await expect(service.recent(10)).resolves.toEqual([{ id: 'a' }]);
    await expect(service.trace('a')).resolves.toEqual([
      { eventType: 'tool.started' },
    ]);
    expect(logs.getRecentTechnicalLogs).toHaveBeenCalledWith(10);
  });
});
