import { Injectable } from '@nestjs/common';
import { Tool } from '@nestjs/mcp';
import * as s from '../schemas/activity-logging.schemas.js';
import { ActivityQueryService } from '../services/activity-query.service.js';
import { ActivitySummaryService } from '../services/activity-summary.service.js';
import { ActivityReportService } from '../services/activity-report.service.js';
import { ActivityLoggingService } from '../services/activity-logging.service.js';

/**
 * Readable observability tools for both AI clients and human operators.
 * Every result explains what happened and links detail/trace lookups by executionId.
 */
@Injectable()
export class ActivityLoggingTools {
  /** Injects query, summary, report, and archive services used by the MCP handlers. */
  constructor(
    private readonly query: ActivityQueryService,
    private readonly summary: ActivitySummaryService,
    private readonly reports: ActivityReportService,
    private readonly logs: ActivityLoggingService,
  ) {}

  @Tool({
    name: 'activity_get_recent_executions',
    description:
      'Show the latest Projectron MCP tool executions in reverse chronological order. Returns executionId, tool name, sanitized input/output, status, start/end timestamps, duration, taskId, and a short step trace. Use this to explain to the user and the client model what Projectron has recently done. Call activity_get_execution_details or activity_get_execution_steps for a selected executionId.',
    inputSchema: s.recentExecutionsSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  /** Lists the newest execution records for an operational activity overview. */
  getRecent(input: { limit: number }) {
    return this.query.recent(input.limit);
  }

  @Tool({
    name: 'activity_get_execution_details',
    description:
      'Retrieve the complete stored record for one Projectron tool execution, including sanitized full input, output or error, status, timestamps, duration, taskId, and all captured steps. Requires the executionId returned by an activity execution listing/search.',
    inputSchema: s.executionIdSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  /** Returns one execution's full retained record or a clear not-found result. */
  async getDetails(input: { executionId: string }) {
    const record = await this.query.details(input.executionId);
    if (!record)
      return {
        found: false,
        executionId: input.executionId,
        message:
          'No matching execution was found in the active execution history. It may have been archived or older than the retained query window.',
      };
    return { found: true, record };
  }

  @Tool({
    name: 'activity_search_executions',
    description:
      'Search recent Projectron tool executions by exact executionId, partial tool name, and/or status (running, success, error). Use this to investigate a specific operation or explain failures. Returns records with executionIds for follow-up detail and step queries.',
    inputSchema: s.toolExecutionSearchSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  /** Searches recent executions using the supplied ID, tool-name, and status filters. */
  search(input: {
    executionId?: string;
    tool?: string;
    status?: 'running' | 'success' | 'error';
    limit: number;
  }) {
    return this.query.search(input);
  }

  @Tool({
    name: 'activity_get_execution_steps',
    description:
      'Show the chronological lifecycle events and internal execution steps for one Projectron tool call, including step status, timestamp, duration, and sanitized details. Use this when a client model or user asks how an operation proceeded step by step.',
    inputSchema: s.executionIdSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  /** Returns chronological lifecycle events and internal steps for one execution. */
  async getSteps(input: { executionId: string }) {
    const events = await this.query.trace(input.executionId);
    return {
      executionId: input.executionId,
      found: events.length > 0,
      steps: events,
    };
  }

  @Tool({
    name: 'activity_get_summary',
    description:
      'Return a compact operational overview of recent Projectron tool activity: total executions, running, succeeded, failed, and cumulative duration. Use this for status questions and concise user-facing progress summaries.',
    inputSchema: s.emptyActivityLoggingSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  /** Provides aggregate counts and cumulative duration for recent tool activity. */
  getSummary() {
    return this.summary.summarize(500);
  }

  @Tool({
    name: 'activity_create_report',
    description:
      'Create a structured report of recent Projectron activity with aggregate counts and execution records. Use this when a user or client model needs a fuller audit/report rather than a short status.',
    inputSchema: s.emptyActivityLoggingSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  /** Builds a detailed report containing recent records and aggregate activity totals. */
  createReport() {
    return this.reports.create(500);
  }

  @Tool({
    name: 'activity_archive_logs',
    description:
      'Archive the current active Projectron execution and runtime logs into a date-based archive, then clear the active log files. This changes log storage; call only when explicitly requested by the user or by an authorized maintenance workflow. Returns archive counts and verification status.',
    inputSchema: s.archiveLogsSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  })
  /** Archives active logs; this storage-changing operation requires explicit authorization. */
  archive(input: { reason: string }) {
    return this.logs.archiveActive(input.reason);
  }
}
