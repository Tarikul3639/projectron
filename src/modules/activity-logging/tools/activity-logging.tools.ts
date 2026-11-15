import { Injectable } from '@nestjs/common';
import { Tool } from '@nestjs/mcp';
import * as s from '../schemas/activity-logging.schemas.js';
import { ActivityLoggingService } from '../services/activity-logging.service.js';

@Injectable()
export class ActivityLoggingTools {
  constructor(private readonly logs: ActivityLoggingService) {}

  @Tool({
    name: 'activity_get_recent_executions',
    description:
      'List recent Projectron tool calls with their input, output or error, status, and duration.',
    inputSchema: s.recentExecutionsSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  getRecent(input: { limit: number }) {
    return this.logs.getRecent(input.limit);
  }

  @Tool({
    name: 'activity_get_execution_details',
    description:
      'Get the saved input and output or error for one Projectron tool call.',
    inputSchema: s.executionIdSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  async getDetails(input: { executionId: string }) {
    const record = await this.logs.getById(input.executionId);
    return record
      ? { found: true, record }
      : { found: false, executionId: input.executionId };
  }

  @Tool({
    name: 'activity_search_executions',
    description:
      'Search recent Projectron tool calls by ID, tool name, or result status.',
    inputSchema: s.toolExecutionSearchSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  search(input: {
    executionId?: string;
    tool?: string;
    status?: 'success' | 'error';
    limit: number;
  }) {
    return this.logs.search(input);
  }
}
