import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FileService } from './file.service.js';

describe('FileService', () => {
  let root: string;
  let service: FileService;
  const approvals = { createRequest: vi.fn(), getRequest: vi.fn() };
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'projectron-file-'));
    service = new FileService(
      { filesystemAllowedRoots: root, approvalRequired: false } as never,
      approvals as never,
    );
  });
  afterEach(async () => rm(root, { recursive: true, force: true }));
  it('reads, writes, and appends files inside the allowed root', async () => {
    await service.write({
      path: 'notes/a.txt',
      content: 'hello',
      clientId: 'test',
    });
    await service.append({
      path: 'notes/a.txt',
      content: ' world',
      clientId: 'test',
    });
    expect(await service.read({ path: 'notes/a.txt' })).toBe('hello world');
    expect(await readFile(join(root, 'notes/a.txt'), 'utf8')).toBe(
      'hello world',
    );
  });
  it('returns bounded binary-safe chunks', async () => {
    await writeFile(join(root, 'blob.bin'), Buffer.from([0, 1, 255]));
    const chunk = await service.readFileChunk({
      path: 'blob.bin',
      offset: 1,
      length: 2,
    });
    expect(Buffer.from(chunk.data, 'base64')).toEqual(Buffer.from([1, 255]));
  });
});
