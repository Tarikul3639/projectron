import { Injectable } from '@nestjs/common';
import { ActivityLoggingService } from './activity-logging.service.js';
import type { ExecutionTraceStep } from '../interfaces/log.interface.js';

/** Small facade used by tool adapters to report named execution steps. */
@Injectable()
export class ActivityCollectorService {
  /** Creates the collector with the shared persistent activity logger. */
  constructor(private readonly logs: ActivityLoggingService) {}
  /** Starts a tracked tool execution and returns its unique execution ID. */
  start(tool: string, input: unknown, taskId?: string): Promise<string> {
    return this.logs.startToolExecution({ tool, input, ...(taskId ? { taskId } : {}) });
  }
  /** Appends one named step to an existing execution trace. */
  step(id: string, step: Omit<ExecutionTraceStep, 'timestamp'>): Promise<void> {
    return this.logs.recordExecutionStep(id, step);
  }
  /** Marks an execution successful and stores its sanitized output. */
  complete(id: string, output: unknown): Promise<void> {
    return this.logs.completeToolExecution(id, output);
  }
  /** Marks an execution failed and stores its sanitized error details. */
  fail(id: string, error: unknown): Promise<void> {
    return this.logs.failToolExecution(id, error);
  }
}
