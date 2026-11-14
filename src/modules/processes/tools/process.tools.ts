import { Injectable } from '@nestjs/common';
import { Tool } from '@nestjs/mcp';
import * as z from 'zod';
import {
  processIdSchema,
  startProcessSchema,
  stopProcessSchema,
} from '../schemas/processes.schemas.js';
import { ProcessExecutionService } from '../services/process-execution.service.js';
import { ProcessRegistryService } from '../services/process-registry.service.js';
import type { StartProcessInput } from '../types/processes.type.js';

/** Publishes process supervision tools. */
@Injectable()
export class ProcessTools {
  /** Initializes process execution and registry dependencies. */
  constructor(
    private readonly execution: ProcessExecutionService,
    private readonly registry: ProcessRegistryService,
  ) {}

  /** Starts a non-interactive executable in an allowed workspace. */
  @Tool({
    name: 'process_start',
    description:
      'Start a non-interactive executable in an allowed workspace. Returns its managed PID.',
    inputSchema: startProcessSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  })
  start(input: StartProcessInput) {
    return this.execution.start(input);
  }

  /** Lists processes started and managed by this Projectron instance. */
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

  /** Gets status and metadata for a managed process. */
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

  /** Reads captured stdout and stderr for a managed process. */
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

  /** Sends SIGTERM to a Projectron-managed process. */
  @Tool({
    name: 'process_stop',
    description:
      'Send SIGTERM to a process started by Projectron. Cannot stop unrelated processes or Projectron itself.',
    inputSchema: stopProcessSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  })
  stop(input: { pid: number }) {
    return this.execution.stop(input.pid);
  }
}
