import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { FileStorageService } from '../../storage/file-storage.service.js';
import { LogRedactionService } from './log-redaction.service.js';
import type {
  ArchiveResult,
  ExecutionTraceStep,
  ToolExecutionLog,
  UserActivity,
} from '../interfaces/log.interface.js';
import type { ToolExecutionEvent } from '../types/log.type.js';

const ACTIVE = 'logs/active';
const ARCHIVE = 'logs/archive';
const EXECUTIONS = ACTIVE + '/execution-records.jsonl';
const RUNTIME = ACTIVE + '/runtime-trace.log';
const ACTIVITIES = ACTIVE + '/activities.json';

@Injectable()
export class ActivityLoggingService implements OnModuleInit {
  private readonly logger = new Logger(ActivityLoggingService.name);
  private readonly sessionId = randomUUID();
  private writeQueue: Promise<void> = Promise.resolve();

  /** Wires persistent storage and credential redaction into the logging service. */
  constructor(
    private readonly storage: FileStorageService,
    private readonly redaction: LogRedactionService,
  ) {}

  /** Creates active/archive log locations and initializes required log files on startup. */
  async onModuleInit(): Promise<void> {
    await this.storage.createDirectory(ACTIVE);
    await this.storage.createDirectory(ARCHIVE);
    await this.ensureFile(EXECUTIONS, '');
    await this.ensureFile(RUNTIME, '');
    await this.ensureFile(ACTIVE + '/task-context.json', '{}');
    await this.ensureFile(ACTIVITIES, '[]');
    this.logger.log('Activity logging session started: ' + this.sessionId);
  }

  /** Returns the unique identifier shared by log records from this server session. */
  getSessionId(): string {
    return this.sessionId;
  }

  /** Persists a sanitized start record and returns the execution ID used by later events. */
  async startToolExecution(input: {
    tool: string;
    input: unknown;
    taskId?: string;
  }): Promise<string> {
    const id = randomUUID();
    const timestamp = new Date().toISOString();
    const record: ToolExecutionLog = {
      id,
      timestamp,
      sessionId: this.sessionId,
      event: 'mcp_tool_execution',
      tool: input.tool,
      input: this.redaction.sanitize(input.input),
      status: 'running',
      ...(input.taskId ? { taskId: input.taskId } : {}),
      steps: [],
    };
    await this.appendEvent(
      { eventType: 'tool.started', executionId: id, record },
      '[START] ' + timestamp + ' ' + input.tool + ' id=' + id,
    );
    this.logger.log('▶ ' + input.tool + ' [' + id + '] started');
    if (process.env.PROJECTRON_LOG_DETAILS === 'true')
      this.logger.log('  INPUT ' + JSON.stringify(record.input, null, 2));
    return id;
  }

  /** Adds a timestamped, sanitized step to an execution's append-only event trace. */
  async recordExecutionStep(
    executionId: string,
    step: Omit<ExecutionTraceStep, 'timestamp'>,
  ): Promise<void> {
    const entry: ExecutionTraceStep = {
      ...step,
      timestamp: new Date().toISOString(),
      ...(step.details === undefined
        ? {}
        : { details: this.redaction.sanitize(step.details) }),
    };
    await this.appendEvent(
      { eventType: 'tool.step', executionId, step: entry },
      '  [' +
        entry.status.toUpperCase() +
        '] ' +
        entry.timestamp +
        ' ' +
        entry.name +
        (entry.durationMs === undefined ? '' : ' (' + entry.durationMs + 'ms)'),
    );
    if (process.env.PROJECTRON_LOG_DETAILS === 'true')
      this.logger.debug('  STEP ' + JSON.stringify(entry, null, 2));
  }

  /** Records successful completion, elapsed time, and sanitized output for an execution. */
  async completeToolExecution(
    executionId: string,
    output: unknown,
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    const durationMs = await this.getElapsedTime(executionId);
    const safeOutput = this.redaction.sanitize(output);
    await this.appendEvent(
      {
        eventType: 'tool.completed',
        executionId,
        timestamp,
        durationMs,
        output: safeOutput,
      },
      '[SUCCESS] ' +
        timestamp +
        ' id=' +
        executionId +
        ' duration=' +
        durationMs +
        'ms',
    );
    this.logger.log(
      '✓ Tool [' + executionId + '] completed in ' + durationMs + 'ms',
    );
    if (process.env.PROJECTRON_LOG_DETAILS === 'true')
      this.logger.log('  OUTPUT ' + JSON.stringify(safeOutput, null, 2));
  }

  /** Records failure details and elapsed time after sanitizing potentially sensitive values. */
  async failToolExecution(executionId: string, error: unknown): Promise<void> {
    const timestamp = new Date().toISOString();
    const durationMs = await this.getElapsedTime(executionId);
    const normalized =
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            ...(error.stack ? { stack: error.stack } : {}),
          }
        : { name: 'UnknownError', message: String(error) };
    const safeError = this.redaction.sanitize(
      normalized,
    ) as ToolExecutionLog['error'];
    await this.appendEvent(
      {
        eventType: 'tool.failed',
        executionId,
        timestamp,
        durationMs,
        error: safeError,
      },
      '[ERROR] ' +
        timestamp +
        ' id=' +
        executionId +
        ' duration=' +
        durationMs +
        'ms ' +
        (safeError?.message ?? ''),
    );
    this.logger.error(
      '✗ Tool [' +
        executionId +
        '] failed in ' +
        durationMs +
        'ms: ' +
        (safeError?.message ?? 'Unknown error'),
    );
    if (process.env.PROJECTRON_LOG_DETAILS === 'true')
      this.logger.error(
        '  ERROR DETAILS ' + JSON.stringify(safeError, null, 2),
      );
  }

  /** Stores a complete execution supplied by an adapter using the normal start/finalize flow. */
  async recordToolExecution(
    record: Omit<ToolExecutionLog, 'id' | 'sessionId'>,
  ): Promise<void> {
    const id = await this.startToolExecution({
      tool: record.tool,
      input: record.input,
      ...(record.taskId ? { taskId: record.taskId } : {}),
    });
    if (record.status === 'error')
      await this.failToolExecution(
        id,
        record.error ?? new Error('Tool execution failed'),
      );
    else await this.completeToolExecution(id, record.output);
  }

  /** Persists a user activity event with generated identifiers and sanitized metadata. */
  async recordActivity(
    activity: Omit<UserActivity, 'id' | 'timestamp' | 'sessionId'>,
  ): Promise<UserActivity> {
    const entry: UserActivity = {
      ...activity,
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      ...(activity.metadata
        ? {
            metadata: this.redaction.sanitize(activity.metadata) as Record<
              string,
              unknown
            >,
          }
        : {}),
    };
    await this.enqueue(async () => {
      const records = await this.readArray<UserActivity>(ACTIVITIES);
      records.push(entry);
      await this.storage.write(ACTIVITIES, JSON.stringify(records, null, 2));
    });
    return entry;
  }

  /** Rebuilds recent execution records from event history, applying a bounded result limit. */
  async getRecentTechnicalLogs(limit = 50): Promise<ToolExecutionLog[]> {
    const events = await this.readEvents();
    const records = new Map<string, ToolExecutionLog>();
    for (const event of events) {
      if (event.eventType === 'tool.started')
        records.set(event.executionId, { ...event.record, steps: [] });
      else {
        const record = records.get(event.executionId);
        if (!record) continue;
        if (event.eventType === 'tool.step')
          record.steps = [...(record.steps ?? []), event.step];
        if (event.eventType === 'tool.completed')
          Object.assign(record, {
            status: 'success',
            completedAt: event.timestamp,
            durationMs: event.durationMs,
            output: event.output,
          });
        if (event.eventType === 'tool.failed')
          Object.assign(record, {
            status: 'error',
            completedAt: event.timestamp,
            durationMs: event.durationMs,
            error: event.error,
          });
      }
    }
    return [...records.values()]
      .slice(-Math.max(1, Math.min(limit, 500)))
      .reverse();
  }

  /** Returns all persisted lifecycle events associated with one execution ID. */
  async getExecutionTrace(executionId: string): Promise<ToolExecutionEvent[]> {
    return (await this.readEvents()).filter(
      (event) => event.executionId === executionId,
    );
  }

  /** Archives active execution, runtime, and activity logs; clears active files only after verifying the archive copy. */
  async archiveActive(reason = 'manual'): Promise<ArchiveResult> {
    return this.enqueue(async () => {
      const technicalText = await this.readTextOrEmpty(EXECUTIONS);
      const runtimeText = await this.readTextOrEmpty(RUNTIME);
      const activities = await this.readArray<UserActivity>(ACTIVITIES);
      const date = new Date().toISOString().slice(0, 10);
      const result: ArchiveResult = {
        date,
        archived: false,
        technicalRecords: technicalText.split('\n').filter(Boolean).length,
        activityRecords: activities.length,
        textLogBytes: Buffer.byteLength(runtimeText, 'utf8'),
      };
      if (!technicalText && !runtimeText && activities.length === 0)
        return result;
      const target = ARCHIVE + '/' + date;
      await this.storage.createDirectory(target);
      await this.storage.append(
        target + '/execution-records.jsonl',
        technicalText,
      );
      await this.storage.append(target + '/runtime-trace.log', runtimeText);
      const oldActivities = await this.readArray<UserActivity>(
        target + '/activities.json',
      );
      await this.storage.write(
        target + '/activities.json',
        JSON.stringify([...oldActivities, ...activities], null, 2),
      );
      const verify = await this.readTextOrEmpty(
        target + '/execution-records.jsonl',
      );
      if (verify.length < technicalText.length)
        throw new Error(
          'Archive verification failed; active logs were preserved',
        );
      await this.storage.write(EXECUTIONS, '');
      await this.storage.write(RUNTIME, '');
      await this.storage.write(ACTIVITIES, '[]');
      result.archived = true;
      this.logger.log('Archived logs for ' + date + ' (' + reason + ')');
      return result;
    });
  }

  /** Serializes a structured event and its concise human-readable counterpart to disk. */
  private async appendEvent(
    event: ToolExecutionEvent,
    readableLine: string,
  ): Promise<void> {
    await this.enqueue(async () => {
      await this.storage.append(EXECUTIONS, JSON.stringify(event) + '\n');
      await this.storage.append(RUNTIME, readableLine + '\n');
    });
  }

  /** Loads and parses the JSONL execution event stream from active storage. */
  private async readEvents(): Promise<ToolExecutionEvent[]> {
    const text = await this.readTextOrEmpty(EXECUTIONS);
    return text
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as ToolExecutionEvent);
  }

  /** Calculates elapsed milliseconds from the matching execution start timestamp. */
  private async getElapsedTime(executionId: string): Promise<number> {
    const events = await this.getExecutionTrace(executionId);
    const started = events.find((event) => event.eventType === 'tool.started');
    return started?.eventType === 'tool.started'
      ? Math.max(0, Date.now() - new Date(started.record.timestamp).getTime())
      : 0;
  }

  /** Creates a log file with initial content only when it does not already exist. */
  private async ensureFile(path: string, initial: string): Promise<void> {
    if (!(await this.storage.exists(path)))
      await this.storage.write(path, initial);
  }
  /** Reads a JSON array file and rejects malformed or non-array content. */
  private async readArray<T>(path: string): Promise<T[]> {
    const content = await this.readTextOrEmpty(path);
    if (!content.trim()) return [];
    const parsed: unknown = JSON.parse(content);
    if (!Array.isArray(parsed))
      throw new Error('Expected a JSON array in ' + path);
    return parsed as T[];
  }
  /** Reads a text file when present and treats a missing file as empty content. */
  private async readTextOrEmpty(path: string): Promise<string> {
    if (!(await this.storage.exists(path))) return '';
    return this.storage.read(path);
  }
  /** Serializes asynchronous storage mutations through a promise queue so concurrent callers cannot interleave writes. */
  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.writeQueue.then(operation);
    this.writeQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}
