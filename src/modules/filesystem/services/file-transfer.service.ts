import { createReadStream } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  appendFile,
  copyFile,
  cp,
  lstat,
  mkdir,
  readlink,
  rename,
  rm,
  stat,
  symlink,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { AppConfigService } from '../../../config/config.service.js';
import { ApprovalService } from '../../security/approval.service.js';
import type {
  BeginFileUploadInput,
  BulkPathPairsInput,
  FinishFileUploadInput,
  PathPairInput,
  WriteFileChunkInput,
  FileUploadIdInput,
} from '../filesystem.type.js';
import {
  assertNoProtectedEnvironmentFiles,
  ensureDestinationDoesNotExist,
  FilesystemAccess,
  pathExists,
} from '../filesystem.utils.js';

type UploadSession = {
  targetPath: string;
  relativePath: string;
  temporaryPath: string;
  expectedBytes: number;
  bytesWritten: number;
  nextChunkIndex: number;
  sha256?: string;
  overwrite: boolean;
  clientId: string;
  rootIndex: number;
};

/** Handles copy/move batches and staged, checksum-verified large-file transfers. */
@Injectable()
export class FileTransferService {
  private readonly access: FilesystemAccess;
  private readonly uploads = new Map<string, UploadSession>();

  constructor(config: AppConfigService, approvals: ApprovalService) {
    this.access = new FilesystemAccess(config, approvals);
  }

  /** Creates configured roots before transfer tools are used. */
  onModuleInit(): Promise<void> {
    return this.access.initialize();
  }

  /** Copies a regular file without replacing an existing destination. */
  async copyFile(input: PathPairInput): Promise<void> {
    const source = await this.access.resolve(input.path, input.rootIndex);
    const destination = await this.access.resolve(
      input.destination,
      input.rootIndex,
    );

    if (!(await stat(source)).isFile()) {
      throw new BadRequestException('Source path is not a regular file');
    }

    await ensureDestinationDoesNotExist(destination);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(source, destination, fsConstants.COPYFILE_EXCL);
  }

  /** Moves a file or symlink without replacing an existing destination. */
  async moveFile(input: PathPairInput): Promise<void> {
    const source = await this.access.resolve(input.path, input.rootIndex);
    const destination = await this.access.resolve(
      input.destination,
      input.rootIndex,
    );

    const metadata = await lstat(source);
    if (!metadata.isFile() && !metadata.isSymbolicLink()) {
      throw new BadRequestException('Source path is not a file');
    }

    await ensureDestinationDoesNotExist(destination);
    await mkdir(dirname(destination), { recursive: true });

    try {
      await rename(source, destination);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EXDEV') {
        throw error;
      }

      if (metadata.isSymbolicLink()) {
        await symlink(await readlink(source), destination);
      } else {
        await copyFile(source, destination, fsConstants.COPYFILE_EXCL);
      }

      await unlink(source);
    }
  }

  /** Copies a directory recursively without following symbolic links. */
  async copyDirectory(input: PathPairInput): Promise<void> {
    const source = await this.access.resolve(input.path, input.rootIndex);
    const destination = await this.access.resolve(
      input.destination,
      input.rootIndex,
    );

    if (!(await lstat(source)).isDirectory()) {
      throw new BadRequestException('Source path is not a directory');
    }

    await assertNoProtectedEnvironmentFiles(source);

    if (destination === source || destination.startsWith(source + sep)) {
      throw new BadRequestException(
        'A directory cannot be copied inside itself',
      );
    }

    await ensureDestinationDoesNotExist(destination);
    await mkdir(dirname(destination), { recursive: true });
    await cp(source, destination, {
      recursive: true,
      errorOnExist: true,
      force: false,
      dereference: false,
    });
  }

  /** Moves a directory recursively, with a cross-device copy fallback. */
  async moveDirectory(input: PathPairInput): Promise<void> {
    const source = await this.access.resolve(input.path, input.rootIndex);
    const destination = await this.access.resolve(
      input.destination,
      input.rootIndex,
    );

    if (!(await lstat(source)).isDirectory()) {
      throw new BadRequestException('Source path is not a directory');
    }

    await assertNoProtectedEnvironmentFiles(source);

    if (destination === source || destination.startsWith(source + sep)) {
      throw new BadRequestException(
        'A directory cannot be moved inside itself',
      );
    }

    await ensureDestinationDoesNotExist(destination);
    await mkdir(dirname(destination), { recursive: true });

    try {
      await rename(source, destination);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EXDEV') {
        throw error;
      }

      await cp(source, destination, {
        recursive: true,
        errorOnExist: true,
        force: false,
        dereference: false,
      });
      await rm(source, { recursive: true });
    }
  }

  /** Copies mixed files and directories and reports partial results. */
  async copyMultiple(input: BulkPathPairsInput): Promise<{
    succeeded: Array<{ path: string; destination: string }>;
    failed: Array<{ path: string; destination: string; error: string }>;
  }> {
    const succeeded: Array<{ path: string; destination: string }> = [];
    const failed: Array<{ path: string; destination: string; error: string }> =
      [];

    for (const item of input.items) {
      try {
        const source = await this.access.resolve(item.path, input.rootIndex);
        if ((await lstat(source)).isDirectory()) {
          await this.copyDirectory({ ...item, rootIndex: input.rootIndex });
        } else {
          await this.copyFile({ ...item, rootIndex: input.rootIndex });
        }
        succeeded.push(item);
      } catch (error) {
        failed.push({
          ...item,
          error:
            error instanceof Error ? error.message : 'Unknown filesystem error',
        });
      }
    }

    return { succeeded, failed };
  }

  /** Moves mixed files and directories and reports partial results. */
  async moveMultiple(input: BulkPathPairsInput): Promise<{
    succeeded: Array<{ path: string; destination: string }>;
    failed: Array<{ path: string; destination: string; error: string }>;
  }> {
    const succeeded: Array<{ path: string; destination: string }> = [];
    const failed: Array<{ path: string; destination: string; error: string }> =
      [];

    for (const item of input.items) {
      try {
        const source = await this.access.resolve(item.path, input.rootIndex);
        if ((await lstat(source)).isDirectory()) {
          await this.moveDirectory({ ...item, rootIndex: input.rootIndex });
        } else {
          await this.moveFile({ ...item, rootIndex: input.rootIndex });
        }
        succeeded.push(item);
      } catch (error) {
        failed.push({
          ...item,
          error:
            error instanceof Error ? error.message : 'Unknown filesystem error',
        });
      }
    }

    return { succeeded, failed };
  }

  /** Begins a staged upload in a private workspace transfer directory. */
  async beginFileUpload(
    input: BeginFileUploadInput,
  ): Promise<{ transferId: string; chunkSizeBytes: number }> {
    if (!Number.isSafeInteger(input.totalBytes) || input.totalBytes < 1) {
      throw new BadRequestException(
        'totalBytes must be a positive safe integer',
      );
    }

    const rootIndex = input.rootIndex ?? 0;
    const targetPath = await this.access.resolve(input.path, rootIndex);

    if ((await pathExists(targetPath)) && !input.overwrite) {
      throw new ConflictException(
        'Destination already exists; set overwrite=true to request approval at completion',
      );
    }

    const transferId = randomUUID();
    await mkdir(await this.access.resolve('.projectron-transfers', rootIndex), {
      recursive: true,
    });

    const temporaryPath = await this.access.resolve(
      `.projectron-transfers/${transferId}.part`,
      rootIndex,
    );

    await writeFile(temporaryPath, Buffer.alloc(0), { flag: 'wx' });

    this.uploads.set(transferId, {
      targetPath,
      relativePath: input.path,
      temporaryPath,
      expectedBytes: input.totalBytes,
      bytesWritten: 0,
      nextChunkIndex: 0,
      sha256: input.sha256?.toLowerCase(),
      overwrite: input.overwrite ?? false,
      clientId: input.clientId,
      rootIndex,
    });

    return { transferId, chunkSizeBytes: 1_048_576 };
  }

  /** Appends the next sequential base64 chunk to an upload. */
  async writeFileChunk(input: WriteFileChunkInput): Promise<{
    transferId: string;
    chunkIndex: number;
    bytesWritten: number;
    complete: boolean;
  }> {
    const upload = this.uploads.get(input.transferId);
    if (!upload) {
      throw new NotFoundException('Upload session not found');
    }

    if (input.chunkIndex !== upload.nextChunkIndex) {
      throw new ConflictException(
        `Expected chunk index ${upload.nextChunkIndex}`,
      );
    }

    const chunk = Buffer.from(input.base64Data, 'base64');
    if (!chunk.length || chunk.toString('base64') !== input.base64Data) {
      throw new BadRequestException(
        'Chunk must contain canonical non-empty base64 data',
      );
    }

    if (
      chunk.length > 1_048_576 ||
      upload.bytesWritten + chunk.length > upload.expectedBytes
    ) {
      throw new BadRequestException('Chunk exceeds the allowed upload size');
    }

    await appendFile(upload.temporaryPath, chunk);
    upload.bytesWritten += chunk.length;
    upload.nextChunkIndex++;

    return {
      transferId: input.transferId,
      chunkIndex: input.chunkIndex,
      bytesWritten: upload.bytesWritten,
      complete: upload.bytesWritten === upload.expectedBytes,
    };
  }

  /** Verifies size and SHA-256 before publishing the staged file. */
  async finishFileUpload(
    input: FinishFileUploadInput,
  ): Promise<{ path: string; bytesWritten: number; sha256: string }> {
    const upload = this.uploads.get(input.transferId);
    if (!upload) {
      throw new NotFoundException('Upload session not found');
    }

    if (upload.bytesWritten !== upload.expectedBytes) {
      throw new ConflictException(
        `Upload is incomplete: ${upload.bytesWritten}/${upload.expectedBytes} bytes received`,
      );
    }

    const hash = createHash('sha256');
    for await (const chunk of createReadStream(upload.temporaryPath)) {
      hash.update(chunk);
    }

    const sha256 = hash.digest('hex');
    if (upload.sha256 && sha256 !== upload.sha256) {
      throw new BadRequestException(
        'Uploaded file SHA-256 does not match the declared checksum',
      );
    }

    if (await pathExists(upload.targetPath)) {
      if (!upload.overwrite) {
        throw new ConflictException('Destination already exists');
      }

      this.access.requireApproval(
        input.approvalRequestId,
        upload.clientId,
        `filesystem.write:${upload.rootIndex}:${upload.relativePath}`,
        'Overwrite an existing file with a completed chunked upload',
      );
    }

    await mkdir(dirname(upload.targetPath), { recursive: true });
    await rename(upload.temporaryPath, upload.targetPath);
    this.uploads.delete(input.transferId);

    return {
      path: upload.targetPath,
      bytesWritten: upload.bytesWritten,
      sha256,
    };
  }

  /** Returns the current progress of an active upload. */
  getFileUploadStatus(id: string): {
    transferId: string;
    bytesWritten: number;
    totalBytes: number;
    nextChunkIndex: number;
    complete: boolean;
  } {
    const upload = this.uploads.get(id);
    if (!upload) {
      throw new NotFoundException('Upload session not found');
    }

    return {
      transferId: id,
      bytesWritten: upload.bytesWritten,
      totalBytes: upload.expectedBytes,
      nextChunkIndex: upload.nextChunkIndex,
      complete: upload.bytesWritten === upload.expectedBytes,
    };
  }

  /** Aborts an upload and removes its staged temporary file. */
  async abortFileUpload(id: string): Promise<void> {
    const upload = this.uploads.get(id);
    if (!upload) {
      throw new NotFoundException('Upload session not found');
    }

    await rm(upload.temporaryPath, { force: true });
    this.uploads.delete(id);
  }
}
