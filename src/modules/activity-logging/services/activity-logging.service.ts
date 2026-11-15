import { Injectable, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { FileStorageService } from '../../storage/services/file-storage.service.js';
import type {
  ToolExecutionLog,
  ToolExecutionStatus,
} from '../interfaces/log.interface.js';
import { LogRedactionService } from './log-redaction.service.js';

const LOG_DIR = 'logs';
const LOG_FILE = LOG_DIR + '/tool-executions.jsonl';
const MAX_RECORDS = 500;
const MAX_RECORD_BYTES = 64 * 1024;

type ExecutionInput = {
  tool: string;
  input: unknown;
  output?: unknown;
  error?: unknown;
  status: Exclude<ToolExecutionStatus, 'running'>;
  timestamp: string;
  durationMs: number;
};

@Injectable()
export class ActivityLoggingService implements OnModuleInit {
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly storage: FileStorageService,
    private readonly redaction: LogRedactionService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.storage.createDirectory(LOG_DIR);
    if (!(await this.storage.exists(LOG_FILE)))
      await this.storage.write(LOG_FILE, '');
  }

  async recordExecution(input: ExecutionInput): Promise<ToolExecutionLog> {
    const completedAt = new Date().toISOString();
    const record: ToolExecutionLog = {
      id: randomUUID(),
      timestamp: input.timestamp,
      tool: input.tool,
      input: this.redaction.sanitize(input.input),
      ...(input.status === 'success'
        ? { output: this.redaction.sanitize(input.output) }
        : { error: this.redaction.sanitizeError(input.error) }),
      status: input.status,
      durationMs: Math.max(0, input.durationMs),
      completedAt,
    };

    let serialized = JSON.stringify(record);
    if (Buffer.byteLength(serialized, 'utf8') > MAX_RECORD_BYTES) {
      record.input = '[TRUNCATED: record exceeded 64 KB]';
      if (input.status === 'success') {
        record.output = '[TRUNCATED: record exceeded 64 KB]';
      }
      serialized = JSON.stringify(record);
    }

    await this.enqueue(async () => {
      const records = await this.readRecords();
      records.push(JSON.parse(serialized) as ToolExecutionLog);
      await this.storage.write(
        LOG_FILE,
        records
          .slice(-MAX_RECORDS)
          .map((entry) => JSON.stringify(entry))
          .join('\n') + '\n',
      );
    });
    return record;
  }

  async getRecent(limit = 50): Promise<ToolExecutionLog[]> {
    const records = await this.readRecords();
    return records.slice(-Math.max(1, Math.min(limit, MAX_RECORDS))).reverse();
  }

  async getById(id: string): Promise<ToolExecutionLog | null> {
    const records = await this.readRecords();
    return records.find((record) => record.id === id) ?? null;
  }

  async search(input: {
    executionId?: string;
    tool?: string;
    status?: ToolExecutionStatus;
    limit?: number;
  }): Promise<ToolExecutionLog[]> {
    const records = await this.readRecords();
    return records
      .filter(
        (record) =>
          (!input.executionId || record.id === input.executionId) &&
          (!input.tool ||
            record.tool.toLowerCase().includes(input.tool.toLowerCase())) &&
          (!input.status || record.status === input.status),
      )
      .slice(0, Math.max(1, Math.min(input.limit ?? 50, MAX_RECORDS)));
  }

  private async readRecords(): Promise<ToolExecutionLog[]> {
    if (!(await this.storage.exists(LOG_FILE))) return [];
    const content = await this.storage.read(LOG_FILE);
    const records: ToolExecutionLog[] = [];

    for (const line of content.split('\n').filter(Boolean)) {
      try {
        const value = JSON.parse(line) as ToolExecutionLog;
        if (typeof value.id === 'string' && typeof value.tool === 'string') {
          records.push(value);
        }
      } catch {
        // Ignore incomplete or malformed trailing lines.
      }
    }
    return records.slice(-MAX_RECORDS);
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.writeQueue.then(operation);
    this.writeQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}
