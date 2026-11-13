import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createReadStream } from 'node:fs';
import {
  appendFile,
  copyFile,
  cp,
  lstat,
  mkdir,
  readdir,
  readFile,
  readlink,
  realpath,
  rename,
  rm,
  stat,
  symlink,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import {
  basename,
  delimiter,
  dirname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from 'node:path';
import { AppConfigService } from '../../config/config.service.js';
import type { OnModuleInit } from '@nestjs/common';
import type {
  CreateDirectoryInput,
  DeleteFileInput,
  ListFilesInput,
  ReadFileInput,
  WriteFileInput,
} from './filesystem.type.js';
import { ApprovalService } from '../security/approval.service.js';
import { pathExists } from './filesystem.utils.js';

@Injectable()
export class FilesystemService implements OnModuleInit {
  // Configured roots define the only directories this service may access.
  private readonly allowedRoots: string[];
  // Controls whether protected filesystem operations must request user approval.
  private readonly approvalRequired: boolean;
  // Prevents an approved destructive request from being replayed more than once.
  private readonly usedApprovalIds = new Set<string>();
  // Tracks active chunk uploads; unfinished uploads remain isolated in temporary files.
  private readonly uploads = new Map<
    string,
    {
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
    }
  >();

  constructor(
    config: AppConfigService,
    private readonly approvalService: ApprovalService,
  ) {
    this.allowedRoots = config.filesystemAllowedRoots
      .split(delimiter)
      .map((root) => resolve(root.trim()))
      .filter(Boolean);
    this.approvalRequired = config.approvalRequired;
  }

  /** Creates configured workspace roots before filesystem tools are used. */
  async onModuleInit(): Promise<void> {
    await Promise.all(
      this.allowedRoots.map((root) => mkdir(root, { recursive: true })),
    );
  }

  /** Lists entries in a directory and returns basic file metadata. */
  async list(input: ListFilesInput): Promise<
    Array<{
      name: string;
      type: 'file' | 'directory' | 'symlink';
      size: number;
      modifiedAt: Date;
    }>
  > {
    const directory = await this.resolveSafePath(
      input.path ?? '.',
      input.rootIndex,
    );
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new NotFoundException('Directory not found');
      }
      throw error;
    }
    return Promise.all(
      entries.map(async (entry) => {
        const metadata = await lstat(resolve(directory, entry.name));
        return {
          name: entry.name,
          type: entry.isSymbolicLink()
            ? ('symlink' as const)
            : entry.isDirectory()
              ? ('directory' as const)
              : ('file' as const),
          size: metadata.size,
          modifiedAt: metadata.mtime,
        };
      }),
    );
  }

  /** Reads a UTF-8 file after verifying it stays within an allowed root. */
  async read(input: ReadFileInput): Promise<string> {
    const filePath = await this.resolveSafePath(input.path, input.rootIndex);
    try {
      if (!(await stat(filePath)).isFile())
        throw new BadRequestException('Path is not a file');
      return await readFile(filePath, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new NotFoundException('File not found');
      }
      throw error;
    }
  }

  /** Creates a new file; overwriting an existing file requires an approved request. */
  async write(input: WriteFileInput): Promise<void> {
    const filePath = await this.resolveSafePath(input.path, input.rootIndex);
    let exists = true;
    try {
      await stat(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      exists = false;
    }
    if (exists && !(await stat(filePath)).isFile()) {
      throw new BadRequestException('Path is not a regular file');
    }
    if (exists) {
      this.requireApproval(
        input.approvalRequestId,
        input.clientId,
        `filesystem.write:${input.rootIndex ?? 0}:${input.path}`,
        'Overwrite an existing file',
      );
    }
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, input.content, 'utf8');
  }

  /** Writes a bounded batch of files and reports per-file outcomes. */
  async writeMultiple(input: {
    items: Array<{ path: string; content: string }>;
    clientId: string;
    approvalRequestId?: string;
    rootIndex?: number;
  }): Promise<{
    succeeded: string[];
    failed: Array<{ path: string; error: string }>;
  }> {
    if (input.items.length === 0 || input.items.length > 100) {
      throw new BadRequestException(
        'A batch must contain between 1 and 100 files',
      );
    }

    // Reject duplicate destinations so one batch cannot silently overwrite its own earlier writes.
    const paths = input.items.map((item) => item.path);
    if (new Set(paths).size !== paths.length) {
      throw new BadRequestException(
        'A batch cannot contain duplicate file paths',
      );
    }

    const succeeded: string[] = [];
    const failed: Array<{ path: string; error: string }> = [];
    const prepared: Array<{
      path: string;
      content: string;
      filePath: string;
      exists: boolean;
    }> = [];

    // Validate every destination before writing anything; invalid items remain isolated failures.
    for (const item of input.items) {
      try {
        const filePath = await this.resolveSafePath(item.path, input.rootIndex);
        let metadata;
        try {
          metadata = await lstat(filePath);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
        if (metadata && !metadata.isFile()) {
          throw new BadRequestException('Destination is not a regular file');
        }
        prepared.push({ ...item, filePath, exists: Boolean(metadata) });
      } catch (error) {
        failed.push({
          path: item.path,
          error:
            error instanceof Error ? error.message : 'Unknown filesystem error',
        });
      }
    }

    // A single approval covers exactly the existing files that this batch will overwrite.
    const overwritePaths = prepared
      .filter((item) => item.exists)
      .map((item) => item.path);
    if (overwritePaths.length > 0) {
      const action = `filesystem.bulk-write:${input.rootIndex ?? 0}:${overwritePaths.join('|')}`;
      this.requireApproval(
        input.approvalRequestId,
        input.clientId,
        action,
        `Overwrite ${overwritePaths.length} existing file(s) in a batch write`,
      );
    }

    // Continue after individual I/O errors and never replace a newly appeared file without approval.
    for (const item of prepared) {
      try {
        await mkdir(dirname(item.filePath), { recursive: true });
        const safePath = await this.resolveSafePath(item.path, input.rootIndex);
        await writeFile(safePath, item.content, {
          encoding: 'utf8',
          flag: item.exists ? 'w' : 'wx',
        });
        succeeded.push(item.path);
      } catch (error) {
        failed.push({
          path: item.path,
          error:
            error instanceof Error ? error.message : 'Unknown filesystem error',
        });
      }
    }

    return { succeeded, failed };
  }

  /** Creates a directory recursively inside the selected allowed root. */
  async createDirectory(input: CreateDirectoryInput): Promise<void> {
    await mkdir(await this.resolveSafePath(input.path, input.rootIndex), {
      recursive: true,
    });
  }

  /** Moves a file to the user's desktop Trash after its matching approval. */
  async delete(input: DeleteFileInput): Promise<void> {
    const filePath = await this.resolveSafePath(input.path, input.rootIndex);
    let metadata;
    try {
      metadata = await lstat(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new NotFoundException('File not found');
      }
      throw error;
    }
    if (!metadata.isFile() && !metadata.isSymbolicLink()) {
      throw new BadRequestException(
        'Only files and symbolic links can be moved to Trash',
      );
    }

    this.requireApproval(
      input.approvalRequestId,
      input.clientId,
      `filesystem.delete:${input.rootIndex ?? 0}:${input.path}`,
      "Move a file to the user's Trash",
    );

    await this.moveToTrash(filePath, metadata.isSymbolicLink());
  }

  /** Renames a file without replacing an existing destination. */
  async renameFile(input: {
    path: string;
    newPath: string;
    rootIndex?: number;
  }): Promise<void> {
    const source = await this.resolveSafePath(input.path, input.rootIndex);
    const destination = await this.resolveSafePath(
      input.newPath,
      input.rootIndex,
    );
    const metadata = await lstat(source);
    if (!metadata.isFile() && !metadata.isSymbolicLink()) {
      throw new BadRequestException('Source path is not a file');
    }
    await this.ensureDestinationDoesNotExist(destination);
    await mkdir(dirname(destination), { recursive: true });
    await rename(source, destination);
  }

  /** Copies a file without replacing an existing destination. */
  async copyFile(input: {
    path: string;
    destination: string;
    rootIndex?: number;
  }): Promise<void> {
    const source = await this.resolveSafePath(input.path, input.rootIndex);
    const destination = await this.resolveSafePath(
      input.destination,
      input.rootIndex,
    );
    if (!(await stat(source)).isFile()) {
      throw new BadRequestException('Source path is not a regular file');
    }
    await this.ensureDestinationDoesNotExist(destination);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(source, destination);
  }

  /** Moves a file without replacing an existing destination. */
  async moveFile(input: {
    path: string;
    destination: string;
    rootIndex?: number;
  }): Promise<void> {
    const source = await this.resolveSafePath(input.path, input.rootIndex);
    const destination = await this.resolveSafePath(
      input.destination,
      input.rootIndex,
    );
    const metadata = await lstat(source);
    if (!metadata.isFile() && !metadata.isSymbolicLink()) {
      throw new BadRequestException('Source path is not a file');
    }
    await this.ensureDestinationDoesNotExist(destination);
    await mkdir(dirname(destination), { recursive: true });
    try {
      await rename(source, destination);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error;
      if (metadata.isSymbolicLink()) {
        await symlink(await readlink(source), destination);
      } else {
        await copyFile(source, destination);
      }
      await unlink(source);
    }
  }

  /** Moves a directory and all descendants to the user's Trash after approval. */
  async deleteDirectory(input: DeleteFileInput): Promise<void> {
    const directory = await this.resolveSafePath(input.path, input.rootIndex);
    const metadata = await lstat(directory);
    if (!metadata.isDirectory()) {
      throw new BadRequestException('Path is not a directory');
    }
    if (directory === this.allowedRoots[input.rootIndex ?? 0]) {
      throw new ForbiddenException('An allowed root cannot be moved to Trash');
    }
    this.requireApproval(
      input.approvalRequestId,
      input.clientId,
      `filesystem.delete-directory:${input.rootIndex ?? 0}:${input.path}`,
      'Move a directory and all its contents to the user Trash',
    );
    await this.moveToTrash(directory, false, true);
  }

  /** Renames a directory without replacing an existing destination. */
  async renameDirectory(input: {
    path: string;
    newPath: string;
    rootIndex?: number;
  }): Promise<void> {
    const source = await this.resolveSafePath(input.path, input.rootIndex);
    const destination = await this.resolveSafePath(
      input.newPath,
      input.rootIndex,
    );
    if (!(await lstat(source)).isDirectory()) {
      throw new BadRequestException('Source path is not a directory');
    }
    if (destination.startsWith(source + sep)) {
      throw new BadRequestException(
        'A directory cannot be moved inside itself',
      );
    }
    await this.ensureDestinationDoesNotExist(destination);
    await mkdir(dirname(destination), { recursive: true });
    await rename(source, destination);
  }

  /** Copies a directory recursively without following symbolic links. */
  async copyDirectory(input: {
    path: string;
    destination: string;
    rootIndex?: number;
  }): Promise<void> {
    const source = await this.resolveSafePath(input.path, input.rootIndex);
    const destination = await this.resolveSafePath(
      input.destination,
      input.rootIndex,
    );
    if (!(await lstat(source)).isDirectory()) {
      throw new BadRequestException('Source path is not a directory');
    }
    if (destination.startsWith(source + sep) || destination === source) {
      throw new BadRequestException(
        'A directory cannot be copied inside itself',
      );
    }
    await this.ensureDestinationDoesNotExist(destination);
    await mkdir(dirname(destination), { recursive: true });
    await cp(source, destination, {
      recursive: true,
      errorOnExist: true,
      force: false,
      dereference: false,
    });
  }

  /** Moves a directory recursively, with a cross-device copy fallback. */
  async moveDirectory(input: {
    path: string;
    destination: string;
    rootIndex?: number;
  }): Promise<void> {
    const source = await this.resolveSafePath(input.path, input.rootIndex);
    const destination = await this.resolveSafePath(
      input.destination,
      input.rootIndex,
    );
    if (!(await lstat(source)).isDirectory()) {
      throw new BadRequestException('Source path is not a directory');
    }
    if (destination.startsWith(source + sep) || destination === source) {
      throw new BadRequestException(
        'A directory cannot be moved inside itself',
      );
    }
    await this.ensureDestinationDoesNotExist(destination);
    await mkdir(dirname(destination), { recursive: true });
    try {
      await rename(source, destination);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error;
      await cp(source, destination, {
        recursive: true,
        errorOnExist: true,
        force: false,
        dereference: false,
      });
      await rm(source, { recursive: true });
    }
  }

  /** Deletes a list of files and directories as one approval-controlled operation. */
  async deleteMultiple(input: {
    paths: string[];
    clientId: string;
    approvalRequestId?: string;
    rootIndex?: number;
  }): Promise<{
    succeeded: string[];
    failed: Array<{ path: string; error: string }>;
  }> {
    if (input.paths.length === 0) {
      throw new BadRequestException('At least one path is required');
    }
    const action = `filesystem.bulk-delete:${input.rootIndex ?? 0}:${input.paths.join('|')}`;
    this.requireApproval(
      input.approvalRequestId,
      input.clientId,
      action,
      `Move ${input.paths.length} filesystem entries to the user Trash`,
    );

    const succeeded: string[] = [];
    const failed: Array<{ path: string; error: string }> = [];
    for (const path of input.paths) {
      try {
        const resolved = await this.resolveSafePath(path, input.rootIndex);
        const metadata = await lstat(resolved);
        if (resolved === this.allowedRoots[input.rootIndex ?? 0]) {
          throw new ForbiddenException(
            'An allowed root cannot be moved to Trash',
          );
        }
        await this.moveToTrash(
          resolved,
          metadata.isSymbolicLink(),
          metadata.isDirectory(),
        );
        succeeded.push(path);
      } catch (error) {
        failed.push({
          path,
          error:
            error instanceof Error ? error.message : 'Unknown filesystem error',
        });
      }
    }
    return { succeeded, failed };
  }

  /** Copies mixed files and directories, reporting partial success for each item. */
  async copyMultiple(input: {
    items: Array<{ path: string; destination: string }>;
    rootIndex?: number;
  }): Promise<{
    succeeded: Array<{ path: string; destination: string }>;
    failed: Array<{ path: string; destination: string; error: string }>;
  }> {
    const succeeded: Array<{ path: string; destination: string }> = [];
    const failed: Array<{ path: string; destination: string; error: string }> =
      [];
    for (const item of input.items) {
      try {
        const source = await this.resolveSafePath(item.path, input.rootIndex);
        const metadata = await lstat(source);
        if (metadata.isDirectory()) {
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

  /** Moves mixed files and directories, reporting partial success for each item. */
  async moveMultiple(input: {
    items: Array<{ path: string; destination: string }>;
    rootIndex?: number;
  }): Promise<{
    succeeded: Array<{ path: string; destination: string }>;
    failed: Array<{ path: string; destination: string; error: string }>;
  }> {
    const succeeded: Array<{ path: string; destination: string }> = [];
    const failed: Array<{ path: string; destination: string; error: string }> =
      [];
    for (const item of input.items) {
      try {
        const source = await this.resolveSafePath(item.path, input.rootIndex);
        const metadata = await lstat(source);
        if (metadata.isDirectory()) {
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

  /** Creates multiple directories and reports individual failures. */
  async createMultipleDirectories(input: {
    paths: string[];
    rootIndex?: number;
  }): Promise<{
    succeeded: string[];
    failed: Array<{ path: string; error: string }>;
  }> {
    const succeeded: string[] = [];
    const failed: Array<{ path: string; error: string }> = [];
    for (const path of input.paths) {
      try {
        await this.createDirectory({ path, rootIndex: input.rootIndex });
        succeeded.push(path);
      } catch (error) {
        failed.push({
          path,
          error:
            error instanceof Error ? error.message : 'Unknown filesystem error',
        });
      }
    }
    return { succeeded, failed };
  }

  /** Returns a bounded recursive tree without following symbolic links. */
  async getTree(input: {
    path?: string;
    rootIndex?: number;
    maxDepth?: number;
  }): Promise<Array<{ name: string; type: string; children?: unknown[] }>> {
    const root = await this.resolveSafePath(input.path ?? '.', input.rootIndex);
    const maxDepth = Math.min(Math.max(input.maxDepth ?? 5, 1), 10);
    const walk = async (
      directory: string,
      depth: number,
    ): Promise<Array<{ name: string; type: string; children?: unknown[] }>> => {
      const entries = await readdir(directory, { withFileTypes: true });
      const result = [];
      for (const entry of entries) {
        const entryPath = resolve(directory, entry.name);
        if (entry.isSymbolicLink()) {
          result.push({ name: entry.name, type: 'symlink' });
        } else if (entry.isDirectory()) {
          result.push({
            name: entry.name,
            type: 'directory',
            ...(depth < maxDepth
              ? { children: await walk(entryPath, depth + 1) }
              : {}),
          });
        } else {
          result.push({ name: entry.name, type: 'file' });
        }
      }
      return result;
    };
    return walk(root, 1);
  }

  /** Reads a binary-safe file segment and returns it as base64 for bounded MCP responses. */
  async readFileChunk(input: {
    path: string;
    offset: number;
    length: number;
    rootIndex?: number;
  }): Promise<{
    data: string;
    bytesRead: number;
    offset: number;
    size: number;
  }> {
    if (
      !Number.isSafeInteger(input.offset) ||
      input.offset < 0 ||
      !Number.isSafeInteger(input.length) ||
      input.length < 1 ||
      input.length > 1_048_576
    ) {
      throw new BadRequestException(
        'Invalid chunk offset or length (maximum 1 MiB)',
      );
    }
    const filePath = await this.resolveSafePath(input.path, input.rootIndex);
    const metadata = await stat(filePath);
    if (!metadata.isFile()) throw new BadRequestException('Path is not a file');
    const handle = await (await import('node:fs/promises')).open(filePath, 'r');
    try {
      const buffer = Buffer.alloc(
        Math.min(input.length, Math.max(0, metadata.size - input.offset)),
      );
      const { bytesRead } = await handle.read(
        buffer,
        0,
        buffer.length,
        input.offset,
      );
      return {
        data: buffer.subarray(0, bytesRead).toString('base64'),
        bytesRead,
        offset: input.offset,
        size: metadata.size,
      };
    } finally {
      await handle.close();
    }
  }

  /** Starts a staged upload so large files can be received in bounded MCP chunks. */
  async beginFileUpload(input: {
    path: string;
    totalBytes: number;
    sha256?: string;
    overwrite?: boolean;
    clientId: string;
    rootIndex?: number;
  }): Promise<{ transferId: string; chunkSizeBytes: number }> {
    if (!Number.isSafeInteger(input.totalBytes) || input.totalBytes < 1) {
      throw new BadRequestException(
        'totalBytes must be a positive safe integer',
      );
    }
    const rootIndex = input.rootIndex ?? 0;
    const targetPath = await this.resolveSafePath(input.path, rootIndex);
    const targetExists = await this.pathExists(targetPath);
    if (targetExists && !input.overwrite) {
      throw new ConflictException(
        'Destination already exists; set overwrite=true to request approval at completion',
      );
    }

    const transferId = randomUUID();
    const transferDirectory = await this.resolveSafePath(
      '.projectron-transfers',
      rootIndex,
    );
    await mkdir(transferDirectory, { recursive: true });
    const temporaryPath = await this.resolveSafePath(
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

  /** Appends one sequential base64 chunk to an active staged upload. */
  async writeFileChunk(input: {
    transferId: string;
    chunkIndex: number;
    base64Data: string;
  }): Promise<{
    transferId: string;
    chunkIndex: number;
    bytesWritten: number;
    complete: boolean;
  }> {
    const upload = this.uploads.get(input.transferId);
    if (!upload) throw new NotFoundException('Upload session not found');
    if (input.chunkIndex !== upload.nextChunkIndex) {
      throw new ConflictException(
        `Expected chunk index ${upload.nextChunkIndex}`,
      );
    }
    const chunk = Buffer.from(input.base64Data, 'base64');
    if (chunk.length === 0 || chunk.toString('base64') !== input.base64Data) {
      throw new BadRequestException(
        'Chunk must contain canonical non-empty base64 data',
      );
    }
    if (chunk.length > 1_048_576) {
      throw new BadRequestException('Chunk exceeds the 1 MiB maximum');
    }
    if (upload.bytesWritten + chunk.length > upload.expectedBytes) {
      throw new BadRequestException(
        'Chunk exceeds the declared total file size',
      );
    }
    await appendFile(upload.temporaryPath, chunk);
    upload.bytesWritten += chunk.length;
    upload.nextChunkIndex += 1;
    return {
      transferId: input.transferId,
      chunkIndex: input.chunkIndex,
      bytesWritten: upload.bytesWritten,
      complete: upload.bytesWritten === upload.expectedBytes,
    };
  }

  /** Verifies and atomically publishes a completed upload into its destination. */
  async finishFileUpload(input: {
    transferId: string;
    approvalRequestId?: string;
  }): Promise<{ path: string; bytesWritten: number; sha256: string }> {
    const upload = this.uploads.get(input.transferId);
    if (!upload) throw new NotFoundException('Upload session not found');
    if (upload.bytesWritten !== upload.expectedBytes) {
      throw new ConflictException(
        `Upload is incomplete: ${upload.bytesWritten}/${upload.expectedBytes} bytes received`,
      );
    }

    // Hash the staged file as a stream so memory usage stays bounded for large uploads.
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
    if (await this.pathExists(upload.targetPath)) {
      if (!upload.overwrite)
        throw new ConflictException('Destination already exists');
      this.requireApproval(
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

  /** Cancels an upload and removes its temporary data. */
  async abortFileUpload(transferId: string): Promise<void> {
    const upload = this.uploads.get(transferId);
    if (!upload) throw new NotFoundException('Upload session not found');
    await rm(upload.temporaryPath, { force: true });
    this.uploads.delete(transferId);
  }

  /** Returns the current progress of an active upload session. */
  getFileUploadStatus(transferId: string): {
    transferId: string;
    bytesWritten: number;
    totalBytes: number;
    nextChunkIndex: number;
    complete: boolean;
  } {
    const upload = this.uploads.get(transferId);
    if (!upload) throw new NotFoundException('Upload session not found');
    return {
      transferId,
      bytesWritten: upload.bytesWritten,
      totalBytes: upload.expectedBytes,
      nextChunkIndex: upload.nextChunkIndex,
      complete: upload.bytesWritten === upload.expectedBytes,
    };
  }

  /** Checks a path without following a symbolic link. */
  private async pathExists(path: string): Promise<boolean> {
    return pathExists(path);
  }

  /** Ensures a destination cannot silently replace an existing file or directory. */
  private async ensureDestinationDoesNotExist(
    destination: string,
  ): Promise<void> {
    try {
      await lstat(destination);
      throw new ConflictException('Destination already exists');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  /** Stores a file in the standard XDG Trash directory with restore metadata. */
  private async moveToTrash(
    filePath: string,
    isSymbolicLink: boolean,
    isDirectory = false,
  ): Promise<void> {
    const dataHome =
      process.env.XDG_DATA_HOME || resolve(homedir(), '.local', 'share');
    const trashRoot = resolve(dataHome, 'Trash');
    const filesDirectory = resolve(trashRoot, 'files');
    const infoDirectory = resolve(trashRoot, 'info');
    const trashName = `${randomUUID()}-${basename(filePath)}`;
    const trashedFile = resolve(filesDirectory, trashName);
    const infoFile = resolve(infoDirectory, `${trashName}.trashinfo`);
    const deletedAt = new Date().toISOString().slice(0, 19);
    const trashInfo = `[Trash Info]\nPath=${encodeURI(filePath)}\nDeletionDate=${deletedAt}\n`;

    await mkdir(filesDirectory, { recursive: true });
    await mkdir(infoDirectory, { recursive: true });
    await writeFile(infoFile, trashInfo, { encoding: 'utf8', flag: 'wx' });

    try {
      try {
        await rename(filePath, trashedFile);
      } catch (error) {
        // The home Trash may be on another filesystem, where rename cannot work.
        if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error;

        if (isSymbolicLink) {
          await symlink(await readlink(filePath), trashedFile);
        } else if (isDirectory) {
          await cp(filePath, trashedFile, {
            recursive: true,
            errorOnExist: true,
            force: false,
            dereference: false,
          });
          await rm(filePath, { recursive: true });
        } else {
          await copyFile(filePath, trashedFile);
          await unlink(filePath);
        }
      }
    } catch (error) {
      await Promise.all([
        rm(infoFile, { force: true }),
        rm(trashedFile, { force: true, recursive: true }),
      ]);
      throw error;
    }
  }

  /** Creates an approval request or verifies a matching approved request. */
  private requireApproval(
    approvalRequestId: string | undefined,
    clientId: string,
    action: string,
    reason: string,
  ): void {
    if (!this.approvalRequired) return;
    if (!approvalRequestId) {
      const request = this.approvalService.createRequest({
        clientId,
        action,
        reason,
      });
      throw new ConflictException({
        message: 'User approval is required before this operation can continue',
        approvalRequestId: request.id,
      });
    }
    if (this.usedApprovalIds.has(approvalRequestId)) {
      throw new ForbiddenException(
        'This approval request has already been used',
      );
    }
    const request = this.approvalService.getRequest(approvalRequestId);
    if (
      !request ||
      request.status !== 'approved' ||
      request.clientId !== clientId ||
      request.action !== action
    ) {
      throw new ForbiddenException('A matching approved request is required');
    }
    this.usedApprovalIds.add(approvalRequestId);
  }

  /** Resolves a relative path and blocks traversal or symlink escapes from its root. */
  private async resolveSafePath(path: string, rootIndex = 0): Promise<string> {
    if (!path.trim() || isAbsolute(path)) {
      throw new BadRequestException('A non-empty relative path is required');
    }
    const root = this.allowedRoots[rootIndex];
    if (!root) throw new BadRequestException('Invalid allowed root index');
    const rootRealPath = await realpath(root);
    const target = resolve(rootRealPath, path);
    const fromRoot = relative(rootRealPath, target);
    if (
      fromRoot === '..' ||
      fromRoot.startsWith(`..${sep}`) ||
      isAbsolute(fromRoot)
    ) {
      throw new ForbiddenException(
        'Path is outside the configured allowed root',
      );
    }

    // Resolve the nearest existing ancestor to detect symlinks escaping the root.
    let existingPath = target;
    while (true) {
      try {
        const actualPath = await realpath(existingPath);
        const actualRelative = relative(rootRealPath, actualPath);
        if (
          actualRelative === '..' ||
          actualRelative.startsWith(`..${sep}`) ||
          isAbsolute(actualRelative)
        ) {
          throw new ForbiddenException(
            'Path resolves outside the configured allowed root',
          );
        }
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        const parent = dirname(existingPath);
        if (parent === existingPath) throw error;
        existingPath = parent;
      }
    }
    return target;
  }
}
