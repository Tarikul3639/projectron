import { describe, expect, it, vi } from 'vitest';
import { ActivityLoggingTools } from './activity-logging.tools.js';

describe('ActivityLoggingTools', () => {
  it('lists recent executions', async () => {
    const logs = { getRecent: vi.fn().mockResolvedValue([{ id: 'x' }]) };
    const tools = new ActivityLoggingTools(logs as never);
    await expect(tools.getRecent({ limit: 10 })).resolves.toEqual([
      { id: 'x' },
    ]);
    expect(logs.getRecent).toHaveBeenCalledWith(10);
  });

  it('returns details or a not-found result', async () => {
    const logs = { getById: vi.fn().mockResolvedValue({ id: 'x' }) };
    const tools = new ActivityLoggingTools(logs as never);
    await expect(tools.getDetails({ executionId: 'x' })).resolves.toEqual({
      found: true,
      record: { id: 'x' },
    });
    logs.getById.mockResolvedValue(null);
    await expect(tools.getDetails({ executionId: 'missing' })).resolves.toEqual(
      {
        found: false,
        executionId: 'missing',
      },
    );
  });

  it('delegates execution search', async () => {
    const logs = { search: vi.fn().mockResolvedValue([]) };
    const tools = new ActivityLoggingTools(logs as never);
    await tools.search({ tool: 'filesystem', limit: 5 });
    expect(logs.search).toHaveBeenCalledWith({ tool: 'filesystem', limit: 5 });
  });
});
