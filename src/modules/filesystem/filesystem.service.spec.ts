import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FilesystemService } from './filesystem.service.js';

describe('FilesystemService', () => {
  let root: string;
  let outside: string;
  let service: FilesystemService;
  const approvals = { createRequest: vi.fn(), getRequest: vi.fn() };

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'projectron-files-'));
    outside = await mkdtemp(join(tmpdir(), 'projectron-outside-'));
    vi.stubEnv('XDG_DATA_HOME', join(outside, 'xdg-data'));
    approvals.createRequest.mockReset();
    approvals.getRequest.mockReset();
    service = new FilesystemService(
      { filesystemAllowedRoots: root, approvalRequired: true } as never,
      approvals as never,
    );
  });
  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  });

  it('lists and reads files inside an allowed root', async () => {
    await mkdir(join(root, 'docs'));
    await writeFile(join(root, 'docs/readme.txt'), 'Projectron', 'utf8');
    expect(await service.read({ path: 'docs/readme.txt' })).toBe('Projectron');
    expect(
      (await service.list({ path: 'docs' })).map((entry) => entry.name),
    ).toEqual(['readme.txt']);
  });
  it('creates directories and new files', async () => {
    await service.createDirectory({ path: 'new/nested' });
    await service.write({
      path: 'new/nested/file.txt',
      content: 'hello',
      clientId: 'client-1',
    });
    expect(await readFile(join(root, 'new/nested/file.txt'), 'utf8')).toBe(
      'hello',
    );
  });
  it('writes multiple files with partial results and one approval for overwrites', async () => {
    const created = await service.writeMultiple({
      items: [
        {
          path: 'src/users.service.ts',
          content: 'export class UsersService {}',
        },
        { path: 'src/users.module.ts', content: 'export class UsersModule {}' },
      ],
      clientId: 'client-1',
    });
    expect(created.succeeded).toEqual([
      'src/users.service.ts',
      'src/users.module.ts',
    ]);
    expect(created.failed).toEqual([]);
    expect(await readFile(join(root, 'src/users.service.ts'), 'utf8')).toBe(
      'export class UsersService {}',
    );

    approvals.createRequest.mockReturnValue({ id: 'batch-approval' });
    await expect(
      service.writeMultiple({
        items: [
          { path: 'src/users.service.ts', content: 'updated service' },
          { path: 'src/users.tools.ts', content: 'new tools' },
        ],
        clientId: 'client-1',
      }),
    ).rejects.toMatchObject({
      response: { approvalRequestId: 'batch-approval' },
    });

    approvals.getRequest.mockReturnValue({
      id: 'batch-approval',
      clientId: 'client-1',
      action: 'filesystem.bulk-write:0:src/users.service.ts',
      status: 'approved',
    });
    const updated = await service.writeMultiple({
      items: [
        { path: 'src/users.service.ts', content: 'updated service' },
        { path: 'src/users.tools.ts', content: 'new tools' },
      ],
      clientId: 'client-1',
      approvalRequestId: 'batch-approval',
    });
    expect(updated.succeeded).toEqual([
      'src/users.service.ts',
      'src/users.tools.ts',
    ]);
    expect(updated.failed).toEqual([]);
    expect(await readFile(join(root, 'src/users.service.ts'), 'utf8')).toBe(
      'updated service',
    );
  });

  it('requires approval before overwriting or deleting files', async () => {
    await writeFile(join(root, 'existing.txt'), 'old', 'utf8');
    approvals.createRequest.mockReturnValue({ id: 'approval-1' });
    await expect(
      service.write({
        path: 'existing.txt',
        content: 'new',
        clientId: 'client-1',
      }),
    ).rejects.toMatchObject({ response: { approvalRequestId: 'approval-1' } });
    await expect(
      service.delete({
        path: 'existing.txt',
        clientId: 'client-1',
      }),
    ).rejects.toMatchObject({ response: { approvalRequestId: 'approval-1' } });
  });
  it('moves a file to the XDG Trash with restore metadata after approval', async () => {
    approvals.getRequest.mockReturnValue({
      id: 'approval-2',
      clientId: 'client-1',
      action: 'filesystem.delete:0:remove.txt',
      status: 'approved',
    });
    await writeFile(join(root, 'remove.txt'), 'data', 'utf8');
    await service.delete({
      path: 'remove.txt',
      clientId: 'client-1',
      approvalRequestId: 'approval-2',
    });
    expect(approvals.getRequest).toHaveBeenCalledWith('approval-2');
    await expect(readFile(join(root, 'remove.txt'), 'utf8')).rejects.toThrow();
    const trashRoot = join(outside, 'xdg-data', 'Trash');
    const trashedNames = await readdir(join(trashRoot, 'files'));
    expect(trashedNames).toHaveLength(1);
    expect(
      await readFile(join(trashRoot, 'files', trashedNames[0]), 'utf8'),
    ).toBe('data');
    const infoNames = await readdir(join(trashRoot, 'info'));
    expect(infoNames).toEqual([`${trashedNames[0]}.trashinfo`]);
    const info = await readFile(join(trashRoot, 'info', infoNames[0]), 'utf8');
    expect(info).toContain('[Trash Info]');
    expect(info).toContain(encodeURI(join(root, 'remove.txt')));
  });
  it('renames, copies, and moves files without overwriting destinations', async () => {
    await writeFile(join(root, 'source.txt'), 'source', 'utf8');
    await service.copyFile({ path: 'source.txt', destination: 'copy.txt' });
    await service.renameFile({ path: 'copy.txt', newPath: 'renamed.txt' });
    await service.moveFile({
      path: 'source.txt',
      destination: 'moved/source.txt',
    });

    expect(await readFile(join(root, 'renamed.txt'), 'utf8')).toBe('source');
    expect(await readFile(join(root, 'moved/source.txt'), 'utf8')).toBe(
      'source',
    );
    await expect(
      service.copyFile({
        path: 'renamed.txt',
        destination: 'moved/source.txt',
      }),
    ).rejects.toThrow();
  });

  it('copies, renames, moves, and trashes directory trees', async () => {
    await mkdir(join(root, 'project', 'src'), { recursive: true });
    await writeFile(
      join(root, 'project', 'src', 'index.ts'),
      'export {};',
      'utf8',
    );
    await service.copyDirectory({
      path: 'project',
      destination: 'project-copy',
    });
    await service.renameDirectory({
      path: 'project-copy',
      newPath: 'renamed-copy',
    });
    await service.moveDirectory({
      path: 'renamed-copy',
      destination: 'archive/renamed-copy',
    });

    expect(
      await readFile(join(root, 'archive/renamed-copy/src/index.ts'), 'utf8'),
    ).toBe('export {};');
    approvals.createRequest.mockReturnValue({ id: 'directory-approval' });
    await expect(
      service.deleteDirectory({
        path: 'project',
        clientId: 'client-1',
      }),
    ).rejects.toMatchObject({
      response: { approvalRequestId: 'directory-approval' },
    });
  });

  it('deletes a mixed batch after one matching approval and reports per-path results', async () => {
    await writeFile(join(root, 'one.txt'), 'one', 'utf8');
    await mkdir(join(root, 'folder'));
    approvals.getRequest.mockReturnValue({
      id: 'bulk-approval',
      clientId: 'client-1',
      action: 'filesystem.bulk-delete:0:one.txt|folder|missing.txt',
      status: 'approved',
    });
    const result = await service.deleteMultiple({
      paths: ['one.txt', 'folder', 'missing.txt'],
      clientId: 'client-1',
      approvalRequestId: 'bulk-approval',
    });
    expect(result.succeeded).toEqual(['one.txt', 'folder']);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].path).toBe('missing.txt');
  });

  it('runs mixed bulk copy, move, and directory creation with partial results', async () => {
    await writeFile(join(root, 'bulk.txt'), 'bulk', 'utf8');
    await mkdir(join(root, 'bulk-dir'));
    const copied = await service.copyMultiple({
      items: [
        { path: 'bulk.txt', destination: 'bulk-copy.txt' },
        { path: 'bulk-dir', destination: 'bulk-dir-copy' },
      ],
    });
    expect(copied.succeeded).toHaveLength(2);
    const moved = await service.moveMultiple({
      items: [{ path: 'bulk-copy.txt', destination: 'moved/bulk-copy.txt' }],
    });
    expect(moved.succeeded).toHaveLength(1);
    const created = await service.createMultipleDirectories({
      paths: ['batch/one', 'batch/two'],
    });
    expect(created.succeeded).toEqual(['batch/one', 'batch/two']);
    expect(await readFile(join(root, 'moved/bulk-copy.txt'), 'utf8')).toBe(
      'bulk',
    );
  });

  it('returns a bounded tree and binary-safe file chunks', async () => {
    await mkdir(join(root, 'tree', 'nested'), { recursive: true });
    await writeFile(
      join(root, 'tree', 'nested', 'data.bin'),
      Buffer.from([0, 1, 2, 255]),
    );
    const tree = await service.getTree({ path: 'tree', maxDepth: 2 });
    expect(tree[0]).toMatchObject({ name: 'nested', type: 'directory' });
    const chunk = await service.readFileChunk({
      path: 'tree/nested/data.bin',
      offset: 1,
      length: 2,
    });
    expect(Buffer.from(chunk.data, 'base64')).toEqual(Buffer.from([1, 2]));
    expect(chunk.size).toBe(4);
  });

  it('receives a large file in sequential chunks and publishes it after verification', async () => {
    const upload = await service.beginFileUpload({
      path: 'large/generated.txt',
      totalBytes: 11,
      clientId: 'client-1',
    });
    const first = Buffer.from('hello ').toString('base64');
    const second = Buffer.from('world').toString('base64');

    await expect(
      service.writeFileChunk({
        transferId: upload.transferId,
        chunkIndex: 1,
        base64Data: second,
      }),
    ).rejects.toThrow('Expected chunk index 0');

    await service.writeFileChunk({
      transferId: upload.transferId,
      chunkIndex: 0,
      base64Data: first,
    });
    const status = service.getFileUploadStatus(upload.transferId);
    expect(status).toMatchObject({
      bytesWritten: 6,
      totalBytes: 11,
      nextChunkIndex: 1,
      complete: false,
    });

    await service.writeFileChunk({
      transferId: upload.transferId,
      chunkIndex: 1,
      base64Data: second,
    });
    const result = await service.finishFileUpload({
      transferId: upload.transferId,
    });
    expect(result.bytesWritten).toBe(11);
    expect(await readFile(join(root, 'large/generated.txt'), 'utf8')).toBe(
      'hello world',
    );
    expect(() => service.getFileUploadStatus(upload.transferId)).toThrow();
  });

  it('blocks traversal and symlink escapes', async () => {
    await symlink(outside, join(root, 'escape'));
    await expect(service.read({ path: '../outside.txt' })).rejects.toThrow();
    await expect(service.read({ path: 'escape/secret.txt' })).rejects.toThrow();
  });
});
