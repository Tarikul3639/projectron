import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import * as schemas from '../schemas/filesystem.schemas.js';
import { FileService } from '../services/file.service.js';
import { DirectoryService } from '../services/directory.service.js';
import { FileEditService } from '../services/file-edit.service.js';
import { FileTransferService } from '../services/file-transfer.service.js';
import { FilesystemTools } from './filesystem.tools.js';

describe('FilesystemTools', () => {
  it('validates the public file-edit and search input contracts', () => {
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

  it('routes tool calls to their focused services', async () => {
    const files = { read: vi.fn().mockResolvedValue({ path: 'a.txt' }) };
    const directories = { list: vi.fn().mockResolvedValue({ entries: [] }) };
    const edits = {
      edit: vi.fn().mockResolvedValue({ path: 'a.txt' }),
    };
    const transfers = {
      copyFile: vi.fn().mockResolvedValue({ path: 'b.txt' }),
    };
    const tools = new FilesystemTools(
      files as unknown as FileService,
      directories as unknown as DirectoryService,
      edits as unknown as FileEditService,
      transfers as unknown as FileTransferService,
    );

    await tools.read({ path: 'a.txt' });
    await tools.list({});
    await tools.edit({
      path: 'a.txt',
      oldText: 'x',
      newText: 'y',
      clientId: 'client',
    });
    await tools.copyFile({ path: 'a.txt', destination: 'b.txt' });

    expect(files.read).toHaveBeenCalledWith({ path: 'a.txt' });
    expect(directories.list).toHaveBeenCalledWith({});
    expect(edits.edit).toHaveBeenCalledOnce();
    expect(transfers.copyFile).toHaveBeenCalledOnce();
  });
});
