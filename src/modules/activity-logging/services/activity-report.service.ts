import { Injectable } from '@nestjs/common';
import { ActivityQueryService } from './activity-query.service.js';
import { ActivitySummaryService } from './activity-summary.service.js';

@Injectable()
export class ActivityReportService {
  constructor(
    private readonly query: ActivityQueryService,
    private readonly summary: ActivitySummaryService,
  ) {}
  /** Builds a timestamped report combining recent execution records and aggregate totals. */
  async create(limit = 500) {
    const [records, totals] = await Promise.all([
      this.query.recent(limit),
      this.summary.summarize(limit),
    ]);
    return { generatedAt: new Date().toISOString(), totals, records };
  }
}
