import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CoordinationService } from '../../../core/coordination/services/coordination.service.js';
import { FileStorageService } from '../../storage/services/file-storage.service.js';
import { ActivityLoggingService } from './activity-logging.service.js';
import { LogRedactionService } from './log-redaction.service.js';

describe('ActivityLoggingService', () => {
  let root: string;
  let service: ActivityLoggingService;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'projectron-activity-'));
    service = new ActivityLoggingService(
      new FileStorageService(
        { databasePath: root } as never,
        new CoordinationService(),
      ),
      new LogRedactionService(),
    );
    await service.onModuleInit();
  });

  afterEach(async () => rm(root, { recursive: true, force: true }));

  it('stores one compact record containing tool input and output', async () => {
    const record = await service.recordExecution({
      tool: 'filesystem_read',
      input: { path: 'src/a.ts' },
      output: { content: 'file contents' },
      status: 'success',
      timestamp: new Date().toISOString(),
      durationMs: 12,
    });
    expect(await service.getRecent()).toMatchObject([
      {
        id: record.id,
        tool: 'filesystem_read',
        input: { path: 'src/a.ts' },
        output: { content: 'file contents' },
        status: 'success',
        durationMs: 12,
      },
    ]);
    const raw = await readFile(
      join(root, 'logs/tool-executions.jsonl'),
      'utf8',
    );
    expect(raw.trim().split('\n')).toHaveLength(1);
  });

  it('redacts secrets and bounds large payloads', async () => {
    await service.recordExecution({
      tool: 'example',
      input: { apiKey: 'private', note: 'x'.repeat(20_000) },
      output: { result: 'y'.repeat(20_000) },
      status: 'success',
      timestamp: new Date().toISOString(),
      durationMs: 1,
    });
    const [record] = await service.getRecent();
    expect(record.input).toMatchObject({ apiKey: '[REDACTED]' });
    expect(JSON.stringify(record).length).toBeLessThan(65_536);
  });

  it('keeps only the latest 500 records', async () => {
    for (let i = 0; i < 505; i++) {
      await service.recordExecution({
        tool: 'example',
        input: { i },
        output: { ok: true },
        status: 'success',
        timestamp: new Date().toISOString(),
        durationMs: i,
      });
    }
    expect(await service.getRecent(500)).toHaveLength(500);
    expect((await service.getRecent(1))[0].input).toEqual({ i: 504 });
  });
});
