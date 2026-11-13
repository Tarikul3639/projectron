import { Injectable } from '@nestjs/common';
import { Tool, type McpContext } from '@nestjs/mcp';
import * as z from 'zod';
import { McpApprovalService } from '../approval/services/mcp-approval.service.js';
import {
  processIdSchema,
  startProcessSchema,
  stopProcessSchema,
} from './processes.schemas.js';
import { ProcessExecutionService } from './services/process-execution.service.js';
import { ProcessRegistryService } from './services/process-registry.service.js';
import type { StartProcessInput } from './processes.type.js';

/** Publishes process supervision tools and shares the centralized approval flow. */
@Injectable()
export class ProcessTools {
  constructor(
    private readonly execution: ProcessExecutionService,
    private readonly registry: ProcessRegistryService,
    private readonly approvalHandler: McpApprovalService,
  ) {}

  @Tool({
    name: 'process_start',
    description:
      'Request user approval, then start a non-interactive executable in an allowed workspace. Returns its managed PID.',
    inputSchema: startProcessSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  })
  start(input: StartProcessInput, context: McpContext) {
    return this.approvalHandler.run(
      'process',
      'Start process: ' + input.command + ' ' + input.args.join(' '),
      input,
      context,
      () => this.execution.start(input),
    );
  }

  @Tool({
    name: 'process_list',
    description:
      'List processes started and managed by this Projectron instance; unrelated OS processes are not included.',
    inputSchema: z.object({}).strict(),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  list() {
    return this.registry.list();
  }

  @Tool({
    name: 'process_status',
    description: 'Get status and metadata for a process started by Projectron.',
    inputSchema: processIdSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  status(input: { pid: number }) {
    return this.registry.get(input.pid);
  }

  @Tool({
    name: 'process_logs',
    description:
      'Read captured stdout and stderr for a Projectron-managed process.',
    inputSchema: processIdSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  logs(input: { pid: number }) {
    return this.registry.getLogs(input.pid);
  }

  @Tool({
    name: 'process_stop',
    description:
      'Request user approval, then send SIGTERM to a process started by Projectron. Cannot stop unrelated processes or Projectron itself.',
    inputSchema: stopProcessSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  })
  stop(input: { pid: number; clientId: string }, context: McpContext) {
    return this.approvalHandler.run(
      'process',
      'Stop Projectron-managed process PID ' + input.pid,
      input,
      context,
      () => this.execution.stop(input.pid),
    );
  }
}
