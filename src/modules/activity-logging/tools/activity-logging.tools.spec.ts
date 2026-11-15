import { describe, expect, it, vi } from 'vitest';
import { ActivityLoggingTools } from './activity-logging.tools.js';

describe('ActivityLoggingTools', () => {
  const setup = () => {
    const query = {
      recent: vi.fn().mockResolvedValue([{ id: 'x' }]),
      details: vi.fn(),
      search: vi.fn(),
      trace: vi.fn(),
    };
    const summary = { summarize: vi.fn().mockResolvedValue({ total: 1 }) };
    const reports = { create: vi.fn().mockResolvedValue({ records: [] }) };
    const logs = {
      archiveActive: vi.fn().mockResolvedValue({ archived: true }),
    };
    return {
      tools: new ActivityLoggingTools(
        query as never,
        summary as never,
        reports as never,
        logs as never,
      ),
      query,
      summary,
      reports,
      logs,
    };
  };

  it('lists recent executions', async () => {
    const { tools, query } = setup();
    await expect(tools.getRecent({ limit: 10 })).resolves.toEqual([
      { id: 'x' },
    ]);
    expect(query.recent).toHaveBeenCalledWith(10);
  });

  it('returns full details and a clear not-found response', async () => {
    const { tools, query } = setup();
    query.details.mockResolvedValue({ id: 'x', input: { file: 'a' } });
    await expect(tools.getDetails({ executionId: 'x' })).resolves.toEqual({
      found: true,
      record: { id: 'x', input: { file: 'a' } },
    });
    query.details.mockResolvedValue(null);
    await expect(
      tools.getDetails({ executionId: 'missing' }),
    ).resolves.toMatchObject({ found: false });
  });

  it('delegates search, trace, summary, report and archive', async () => {
    const { tools, query, summary, reports, logs } = setup();
    query.search.mockResolvedValue([]);
    query.trace.mockResolvedValue([]);
    await tools.search({ tool: 'filesystem', limit: 5 });
    await tools.getSteps({ executionId: 'x' });
    await tools.getSummary();
    await tools.createReport();
    await tools.archive({ reason: 'requested' });
    expect(query.search).toHaveBeenCalled();
    expect(query.trace).toHaveBeenCalledWith('x');
    expect(summary.summarize).toHaveBeenCalledWith(500);
    expect(reports.create).toHaveBeenCalledWith(500);
    expect(logs.archiveActive).toHaveBeenCalledWith('requested');
  });
});
