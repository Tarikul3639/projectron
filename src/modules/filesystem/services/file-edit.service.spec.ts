import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FileEditService } from './file-edit.service.js';

describe('FileEditService', () => {
  let root: string;
  let service: FileEditService;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'projectron-edit-'));
    service = new FileEditService(
      { filesystemAllowedRoots: root, approvalRequired: false } as never,
      { createRequest: vi.fn(), getRequest: vi.fn() } as never,
    );
  });
  afterEach(async () => rm(root, { recursive: true, force: true }));
  it('replaces one exact match and reads line ranges', async () => {
    await writeFile(join(root, 'a.txt'), 'alpha\nbeta\ngamma');
    await service.edit({
      path: 'a.txt',
      oldText: 'beta',
      newText: 'BETA',
      clientId: 'test',
    });
    expect(await readFile(join(root, 'a.txt'), 'utf8')).toBe(
      'alpha\nBETA\ngamma',
    );
    expect(
      (await service.readRange({ path: 'a.txt', startLine: 2, endLine: 3 }))
        .content,
    ).toBe('BETA\ngamma');
  });
  it('searches names and text content', async () => {
    await writeFile(join(root, 'match.txt'), 'needle here');
    expect((await service.searchFiles({ query: 'match' })).length).toBe(1);
    expect((await service.searchInFiles({ query: 'needle' }))[0].line).toBe(1);
  });
});
