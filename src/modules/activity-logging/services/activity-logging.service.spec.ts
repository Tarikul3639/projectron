import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileStorageService } from '../../storage/file-storage.service.js';
import { ActivityLoggingService } from './activity-logging.service.js';
import { LogRedactionService } from './log-redaction.service.js';

describe('ActivityLoggingService', () => {
  let root: string;
  let service: ActivityLoggingService;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'projectron-activity-'));
    service = new ActivityLoggingService(
      new FileStorageService({ storagePath: root } as never),
      new LogRedactionService(),
    );
    await service.onModuleInit();
  });
  afterEach(async () => rm(root, { recursive: true, force: true }));

  it('persists complete input, output, lifecycle and trace as JSONL events', async () => {
    const id = await service.startToolExecution({
      tool: 'filesystem_read',
      input: { path: 'src/a.ts' },
    });
    await service.recordExecutionStep(id, {
      name: 'Reading file',
      status: 'completed',
      durationMs: 12,
    });
    await service.completeToolExecution(id, {
      content: 'complete file contents',
    });
    const records = await service.getRecentTechnicalLogs();
    expect(records[0]).toMatchObject({
      id,
      tool: 'filesystem_read',
      input: { path: 'src/a.ts' },
      output: { content: 'complete file contents' },
      status: 'success',
      steps: [{ name: 'Reading file', durationMs: 12 }],
    });
    const raw = await readFile(
      join(root, 'logs/active/execution-records.jsonl'),
      'utf8',
    );
    expect(raw.trim().split('\n')).toHaveLength(3);
  });

  it('redacts credentials and preserves the full ordinary output', async () => {
    const id = await service.startToolExecution({
      tool: 'example',
      input: { apiKey: 'private', note: 'x'.repeat(17000) },
    });
    await service.completeToolExecution(id, { result: 'y'.repeat(17000) });
    const [record] = await service.getRecentTechnicalLogs();
    expect(record.input).toMatchObject({ apiKey: '[REDACTED]' });
    expect((record.input as { note: string }).note).toHaveLength(17000);
    expect((record.output as { result: string }).result).toHaveLength(17000);
  });

  it('archives without discarding existing records', async () => {
    const id = await service.startToolExecution({
      tool: 'test_tool',
      input: {},
    });
    await service.completeToolExecution(id, { ok: true });
    const result = await service.archiveActive('test');
    expect(result.archived).toBe(true);
    expect(
      await readFile(join(root, 'logs/active/execution-records.jsonl'), 'utf8'),
    ).toBe('');
    expect(
      (
        await readFile(
          join(root, `logs/archive/${result.date}/execution-records.jsonl`),
          'utf8',
        )
      ).length,
    ).toBeGreaterThan(0);
  });
});
