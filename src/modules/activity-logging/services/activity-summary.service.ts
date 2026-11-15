import { Injectable } from '@nestjs/common';
import { ActivityQueryService } from './activity-query.service.js';

@Injectable()
export class ActivitySummaryService {
  /** Injects the query service used to build aggregate activity statistics. */
  constructor(private readonly query: ActivityQueryService) {}
  /** Counts recent executions by status and sums known execution durations. */
  async summarize(limit = 500) {
    const records = await this.query.recent(limit);
    return {
      total: records.length,
      running: records.filter((record) => record.status === 'running').length,
      succeeded: records.filter((record) => record.status === 'success').length,
      failed: records.filter((record) => record.status === 'error').length,
      totalDurationMs: records.reduce(
        (total, record) => total + (record.durationMs ?? 0),
        0,
      ),
    };
  }
}
