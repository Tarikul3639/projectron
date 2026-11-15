import { describe, expect, it, vi } from 'vitest';
import { ActivityReportService } from './activity-report.service.js';

describe('ActivityReportService', () => {
  it('combines execution records with aggregate totals', async () => {
    const query = {
      recent: vi.fn().mockResolvedValue([{ id: 'execution-1' }]),
    };
    const summary = { summarize: vi.fn().mockResolvedValue({ total: 1 }) };
    const service = new ActivityReportService(query as never, summary as never);
    const report = await service.create(20);
    expect(report.records).toEqual([{ id: 'execution-1' }]);
    expect(report.totals).toEqual({ total: 1 });
    expect(report.generatedAt).toBeTruthy();
  });
});
