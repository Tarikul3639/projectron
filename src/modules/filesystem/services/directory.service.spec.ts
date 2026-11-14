import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DirectoryService } from './directory.service.js';

describe('DirectoryService', () => {
  let root: string;
  let service: DirectoryService;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'projectron-dir-'));
    service = new DirectoryService({ filesystemAllowedRoots: root } as never);
  });

  afterEach(async () => rm(root, { recursive: true, force: true }));

  it('creates, lists, and returns a bounded tree', async () => {
    await service.createDirectory({ path: 'src/nested' });
    await writeFile(join(root, 'src/nested/a.ts'), 'export {};');
    expect((await service.list({ path: 'src' })).map((x) => x.name)).toContain(
      'nested',
    );
    expect((await service.getTree({ path: 'src' }))[0].name).toBe('nested');
  });

  it('creates multiple directories with individual outcomes', async () => {
    const result = await service.createMultipleDirectories({
      paths: ['one', 'two'],
    });
    expect(result.succeeded).toEqual(['one', 'two']);
    expect(result.failed).toEqual([]);
  });
});
