import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  appendFile,
  lstat,
  mkdir,
  open,
  readFile,
  stat,
  writeFile,
} from 'node:fs/promises';
import { dirname } from 'node:path';
import { AppConfigService } from '../../../config/config.service.js';
import type {
  DeleteFileInput,
  ReadFileInput,
  WriteFileInput,
  WriteMultipleFilesInput,
  ReadFileChunkInput,
} from '../types/filesystem.type.js';
import { FilesystemAccess, moveToTrash } from '../utils/filesystem.utils.js';

/** Handles single-file reads, writes, append, deletion, and bounded byte reads. */
@Injectable()
export class FileService {
  private readonly access: FilesystemAccess;

  /** Creates the service and initializes its dependencies. */
  constructor(config: AppConfigService) {
    this.access = new FilesystemAccess(config);
  }

  /** Ensures configured workspace roots exist before tools are called. */
  onModuleInit(): Promise<void> {
    return this.access.initialize();
  }

  /** Reads a UTF-8 file from an allowed workspace root. */
  async read(input: ReadFileInput): Promise<string> {
    const path = await this.access.resolve(input.path, input.rootIndex);
    try {
      if (!(await stat(path)).isFile()) {
        throw new BadRequestException('Path is not a file');
      }
      return await readFile(path, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new NotFoundException('File not found');
      }
      throw error;
    }
  }

  /** Creates a file or overwrites an existing regular file. */
  async write(input: WriteFileInput): Promise<void> {
    const path = await this.access.resolve(input.path, input.rootIndex);
    let metadata;
    try {
      metadata = await lstat(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    if (metadata && !metadata.isFile()) {
      throw new BadRequestException('Path is not a regular file');
    }

    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, input.content, {
      encoding: 'utf8',
      flag: metadata ? 'w' : 'wx',
    });
  }

  /** Appends UTF-8 content to a file, creating it when it does not exist. */
  async append(input: WriteFileInput): Promise<void> {
    const path = await this.access.resolve(input.path, input.rootIndex);
    let metadata;
    try {
      metadata = await lstat(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    if (metadata && !metadata.isFile()) {
      throw new BadRequestException('Path is not a regular file');
    }

    await mkdir(dirname(path), { recursive: true });

    if (metadata) {
      await appendFile(path, input.content, 'utf8');
    } else {
      await writeFile(path, input.content, { encoding: 'utf8', flag: 'wx' });
    }
  }

  /** Writes a bounded batch and reports individual failures. */
  async writeMultiple(input: WriteMultipleFilesInput): Promise<{
    succeeded: string[];
    failed: Array<{ path: string; error: string }>;
  }> {
    if (new Set(input.items.map((x) => x.path)).size !== input.items.length) {
      throw new BadRequestException(
        'A batch cannot contain duplicate file paths',
      );
    }

    const succeeded: string[] = [];
    const failed: Array<{ path: string; error: string }> = [];
    const prepared: Array<{
      path: string;
      content: string;
      absolute: string;
      exists: boolean;
    }> = [];

    for (const item of input.items) {
      try {
        const absolute = await this.access.resolve(item.path, input.rootIndex);
        let metadata;
        try {
          metadata = await lstat(absolute);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw error;
          }
        }

        if (metadata && !metadata.isFile()) {
          throw new BadRequestException('Destination is not a regular file');
        }

        prepared.push({ ...item, absolute, exists: Boolean(metadata) });
      } catch (error) {
        failed.push({
          path: item.path,
          error:
            error instanceof Error ? error.message : 'Unknown filesystem error',
        });
      }
    }

    for (const item of prepared) {
      try {
        await mkdir(dirname(item.absolute), { recursive: true });
        const safe = await this.access.resolve(item.path, input.rootIndex);
        await writeFile(safe, item.content, {
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

  /** Moves a regular file or symbolic link into the desktop Trash. */
  async delete(input: DeleteFileInput): Promise<void> {
    const path = await this.access.resolve(input.path, input.rootIndex);
    let metadata;
    try {
      metadata = await lstat(path);
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

    await moveToTrash(path, metadata.isSymbolicLink());
  }

  /** Reads a bounded binary-safe file segment as base64. */
  async readFileChunk(input: ReadFileChunkInput): Promise<{
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

    const path = await this.access.resolve(input.path, input.rootIndex);
    const metadata = await stat(path);
    if (!metadata.isFile()) {
      throw new BadRequestException('Path is not a file');
    }

    const handle = await open(path, 'r');
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
}
