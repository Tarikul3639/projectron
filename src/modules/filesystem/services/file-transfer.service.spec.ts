import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileTransferService } from './file-transfer.service.js';

describe('FileTransferService', () => {
  let root: string;
  let service: FileTransferService;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'projectron-transfer-'));
    service = new FileTransferService({
      filesystemAllowedRoots: root,
    } as never);
  });

  afterEach(async () => rm(root, { recursive: true, force: true }));

  it('copies and moves files without replacing destinations', async () => {
    await writeFile(join(root, 'source.txt'), 'data');
    await service.copyFile({ path: 'source.txt', destination: 'copy.txt' });
    await service.moveFile({ path: 'copy.txt', destination: 'moved.txt' });
    expect(await readFile(join(root, 'moved.txt'), 'utf8')).toBe('data');
  });

  it('receives and publishes a chunked upload', async () => {
    const started = await service.beginFileUpload({
      path: 'large.txt',
      totalBytes: 5,
    });
    await service.writeFileChunk({
      transferId: started.transferId,
      chunkIndex: 0,
      base64Data: Buffer.from('hello').toString('base64'),
    });
    await service.finishFileUpload({ transferId: started.transferId });
    expect(await readFile(join(root, 'large.txt'), 'utf8')).toBe('hello');
  });
});
