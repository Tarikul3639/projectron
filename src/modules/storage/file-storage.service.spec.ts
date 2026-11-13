import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileStorageService } from './file-storage.service.js';

describe('FileStorageService', () => {
  let root: string;
  let service: FileStorageService;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'projectron-storage-'));
    service = new FileStorageService({ storagePath: root } as never);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('writes and reads a file, creating parent directories', async () => {
    await service.write('nested/data.txt', 'hello');
    expect(await service.read('nested/data.txt')).toBe('hello');
    expect(await readFile(join(root, 'nested/data.txt'), 'utf8')).toBe('hello');
  });

  it('checks and deletes a stored file', async () => {
    await service.write('data.txt', 'hello');
    expect(await service.exists('data.txt')).toBe(true);
    await service.delete('data.txt');
    expect(await service.exists('data.txt')).toBe(false);
  });

  it('creates directories and rejects paths outside the storage root', async () => {
    await service.createDirectory('nested/folder');
    expect(await service.exists('nested/folder')).toBe(false);
    await expect(service.read('../outside.txt')).rejects.toThrow();
    await expect(service.write('/tmp/outside.txt', 'no')).rejects.toThrow();
  });
});
