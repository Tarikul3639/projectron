import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import {
  beginFileUploadInputSchema,
  bulkPathPairsInputSchema,
  createDirectoryInputSchema,
  createMultipleDirectoriesInputSchema,
  deleteDirectoryInputSchema,
  deleteFileInputSchema,
  deleteMultipleInputSchema,
  fileUploadIdInputSchema,
  finishFileUploadInputSchema,
  getTreeInputSchema,
  listFilesInputSchema,
  pathPairInputSchema,
  readFileChunkInputSchema,
  readFileInputSchema,
  renamePathInputSchema,
  writeFileChunkInputSchema,
  writeFileInputSchema,
  writeMultipleFilesInputSchema,
} from './filesystem.schemas.js';
import { FilesystemTools } from './filesystem.tools.js';

describe('FilesystemTools', () => {
  it('validates the MCP input schemas', () => {
    expect(listFilesInputSchema.safeParse({}).success).toBe(true);
    expect(readFileInputSchema.safeParse({ path: '' }).success).toBe(false);
    expect(
      writeFileInputSchema.safeParse({
        path: 'note.txt',
        content: 'hello',
        clientId: 'client-1',
      }).success,
    ).toBe(true);
    expect(createDirectoryInputSchema.safeParse({ path: 'docs' }).success).toBe(
      true,
    );
    expect(
      writeMultipleFilesInputSchema.safeParse({
        items: [
          { path: 'src/a.ts', content: 'export {};' },
          { path: 'src/b.ts', content: 'export {};' },
        ],
        clientId: 'client-1',
      }).success,
    ).toBe(true);
    expect(
      writeMultipleFilesInputSchema.safeParse({
        items: [],
        clientId: 'client-1',
      }).success,
    ).toBe(false);
    expect(
      deleteFileInputSchema.safeParse({
        path: 'note.txt',
        clientId: 'client-1',
      }).success,
    ).toBe(true);
    expect(
      deleteDirectoryInputSchema.safeParse({
        path: 'docs',
        clientId: 'client-1',
      }).success,
    ).toBe(true);
    expect(
      pathPairInputSchema.safeParse({ path: 'a.txt', destination: 'b.txt' })
        .success,
    ).toBe(true);
    expect(
      renamePathInputSchema.safeParse({ path: 'a.txt', newPath: 'b.txt' })
        .success,
    ).toBe(true);
    expect(
      deleteMultipleInputSchema.safeParse({
        paths: ['a.txt'],
        clientId: 'client-1',
      }).success,
    ).toBe(true);
    expect(
      deleteMultipleInputSchema.safeParse({ paths: [], clientId: 'client-1' })
        .success,
    ).toBe(false);
    expect(
      bulkPathPairsInputSchema.safeParse({
        items: [{ path: 'a', destination: 'b' }],
      }).success,
    ).toBe(true);
    expect(
      createMultipleDirectoriesInputSchema.safeParse({ paths: ['one', 'two'] })
        .success,
    ).toBe(true);
    expect(
      getTreeInputSchema.safeParse({ path: '.', maxDepth: 10 }).success,
    ).toBe(true);
    expect(
      readFileChunkInputSchema.safeParse({
        path: 'large.bin',
        offset: 0,
        length: 1024,
      }).success,
    ).toBe(true);
    expect(
      readFileChunkInputSchema.safeParse({
        path: 'large.bin',
        offset: 0,
        length: 2_000_000,
      }).success,
    ).toBe(false);
    expect(
      beginFileUploadInputSchema.safeParse({
        path: 'large.bin',
        totalBytes: 100,
        clientId: 'client-1',
      }).success,
    ).toBe(true);
    expect(
      writeFileChunkInputSchema.safeParse({
        transferId: '00000000-0000-4000-8000-000000000000',
        chunkIndex: 0,
        base64Data: 'YWJj',
      }).success,
    ).toBe(true);
    expect(
      finishFileUploadInputSchema.safeParse({
        transferId: '00000000-0000-4000-8000-000000000000',
      }).success,
    ).toBe(true);
    expect(
      fileUploadIdInputSchema.safeParse({ transferId: 'invalid' }).success,
    ).toBe(false);
  });

  it('delegates every MCP tool operation to the filesystem service', async () => {
    const methods = [
      'list',
      'getTree',
      'read',
      'write',
      'writeMultiple',
      'createDirectory',
      'delete',
      'deleteDirectory',
      'renameFile',
      'renameDirectory',
      'copyFile',
      'copyDirectory',
      'moveFile',
      'moveDirectory',
      'deleteMultiple',
      'copyMultiple',
      'moveMultiple',
      'createMultipleDirectories',
      'readFileChunk',
      'beginFileUpload',
      'writeFileChunk',
      'finishFileUpload',
      'getFileUploadStatus',
      'abortFileUpload',
    ] as const;
    const filesystem = Object.fromEntries(
      methods.map((method) => [method, vi.fn()]),
    );
    filesystem.read = vi.fn().mockResolvedValue('content');
    const tools = new FilesystemTools(filesystem as never);

    await tools.list({});
    await tools.getTree({ path: '.' });
    await expect(tools.read({ path: 'note.txt' })).resolves.toBe('content');
    await tools.write({
      path: 'note.txt',
      content: 'hello',
      clientId: 'client-1',
    });
    await tools.writeMultiple({
      items: [{ path: 'src/a.ts', content: 'export {};' }],
      clientId: 'client-1',
    });
    await tools.createDirectory({ path: 'docs' });
    await tools.delete({ path: 'note.txt', clientId: 'client-1' });
    await tools.deleteDirectory({ path: 'docs', clientId: 'client-1' });
    await tools.renameFile({ path: 'a.txt', newPath: 'b.txt' });
    await tools.renameDirectory({ path: 'a', newPath: 'b' });
    await tools.copyFile({ path: 'a.txt', destination: 'b.txt' });
    await tools.copyDirectory({ path: 'a', destination: 'b' });
    await tools.moveFile({ path: 'a.txt', destination: 'b.txt' });
    await tools.moveDirectory({ path: 'a', destination: 'b' });
    await tools.deleteMultiple({ paths: ['a.txt'], clientId: 'client-1' });
    await tools.copyMultiple({ items: [{ path: 'a', destination: 'b' }] });
    await tools.moveMultiple({ items: [{ path: 'a', destination: 'b' }] });
    await tools.createMultipleDirectories({ paths: ['one', 'two'] });
    await tools.readChunk({ path: 'large.bin', offset: 0, length: 1024 });
    await tools.beginUpload({
      path: 'large.bin',
      totalBytes: 10,
      clientId: 'client-1',
    });
    await tools.writeChunk({
      transferId: '00000000-0000-4000-8000-000000000000',
      chunkIndex: 0,
      base64Data: 'YWJj',
    });
    await tools.finishUpload({
      transferId: '00000000-0000-4000-8000-000000000000',
    });
    await tools.getUploadStatus({
      transferId: '00000000-0000-4000-8000-000000000000',
    });
    await tools.abortUpload({
      transferId: '00000000-0000-4000-8000-000000000000',
    });

    expect(filesystem.list).toHaveBeenCalled();
    expect(filesystem.getTree).toHaveBeenCalled();
    expect(filesystem.read).toHaveBeenCalledWith({ path: 'note.txt' });
    for (const method of methods) expect(filesystem[method]).toHaveBeenCalled();
  });
});
