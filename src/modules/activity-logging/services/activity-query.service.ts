import { Injectable } from '@nestjs/common';
import { ActivityLoggingService } from './activity-logging.service.js';
import type { ToolExecutionLog } from '../interfaces/log.interface.js';

@Injectable()
export class ActivityQueryService {
  /** Injects the persistent logger used as the source for execution queries. */
  constructor(private readonly logs: ActivityLoggingService) {}

  /** Returns the newest execution records, bounded by the requested limit. */
  async recent(limit = 50): Promise<ToolExecutionLog[]> {
    return this.logs.getRecentTechnicalLogs(limit);
  }

  /** Retrieves the ordered lifecycle and step events for one execution. */
  async trace(executionId: string) {
    return this.logs.getExecutionTrace(executionId);
  }

  /** Finds one execution in the retained recent history, or returns null when absent. */
  async details(executionId: string): Promise<ToolExecutionLog | null> {
    const records = await this.logs.getRecentTechnicalLogs(500);
    return records.find((record) => record.id === executionId) ?? null;
  }

  /** Filters recent executions by ID, partial tool name, and status. */
  async search(input: {
    executionId?: string;
    tool?: string;
    status?: 'running' | 'success' | 'error';
    limit?: number;
  }) {
    const records = await this.logs.getRecentTechnicalLogs(500);
    const filtered = records.filter(
      (record) =>
        (!input.executionId || record.id === input.executionId) &&
        (!input.tool ||
          record.tool.toLowerCase().includes(input.tool.toLowerCase())) &&
        (!input.status || record.status === input.status),
    );
    return filtered.slice(0, input.limit ?? 50);
  }
}
