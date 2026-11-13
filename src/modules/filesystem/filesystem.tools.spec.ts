import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import * as schemas from './filesystem.schemas.js';
import { FilesystemTools } from './filesystem.tools.js';

// Verifies the public MCP schemas and the service routing of the tools provider.
describe('FilesystemTools', () => {
  it('validates the file-edit and search contracts', () => {
    expect(
      schemas.editFileInputSchema.safeParse({
        path: 'a.txt',
        oldText: 'x',
        newText: 'y',
        clientId: 'client',
      }).success,
    ).toBe(true);
    expect(
      schemas.readFileRangeInputSchema.safeParse({
        path: 'a.txt',
        startLine: 1,
        endLine: 3,
      }).success,
    ).toBe(true);
    expect(
      schemas.searchFilesInputSchema.safeParse({ query: 'service' }).success,
    ).toBe(true);
    expect(
      schemas.appendFileInputSchema.safeParse({
        path: 'a.txt',
        content: 'x',
        clientId: 'client',
      }).success,
    ).toBe(true);
  });
  it('routes each group of tools to its focused service', async () => {
    const files = {
      read: vi.fn(),
      write: vi.fn(),
      append: vi.fn(),
      writeMultiple: vi.fn(),
      delete: vi.fn(),
      readFileChunk: vi.fn(),
    };
    const directories = {
      list: vi.fn(),
      getTree: vi.fn(),
      createDirectory: vi.fn(),
      deleteDirectory: vi.fn(),
      renameDirectory: vi.fn(),
      deleteMultiple: vi.fn(),
      createMultipleDirectories: vi.fn(),
    };
    const edits = {
      edit: vi.fn(),
      readRange: vi.fn(),
      searchFiles: vi.fn(),
      searchInFiles: vi.fn(),
    };
    const transfers = {
      copyFile: vi.fn(),
      moveFile: vi.fn(),
      copyDirectory: vi.fn(),
      moveDirectory: vi.fn(),
      copyMultiple: vi.fn(),
      moveMultiple: vi.fn(),
      beginFileUpload: vi.fn(),
      writeFileChunk: vi.fn(),
      finishFileUpload: vi.fn(),
      getFileUploadStatus: vi.fn(),
      abortFileUpload: vi.fn(),
    };
    const tools = new FilesystemTools(
      files as never,
      directories as never,
      edits as never,
      transfers as never,
    );
    await tools.read({ path: 'a.txt' });
    await tools.list({});
    await tools.edit({
      path: 'a.txt',
      oldText: 'x',
      newText: 'y',
      clientId: 'c',
    });
    await tools.copyFile({ path: 'a.txt', destination: 'b.txt' });
    expect(files.read).toHaveBeenCalled();
    expect(directories.list).toHaveBeenCalled();
    expect(edits.edit).toHaveBeenCalled();
    expect(transfers.copyFile).toHaveBeenCalled();
  });
});
