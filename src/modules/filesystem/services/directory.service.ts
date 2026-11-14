import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { lstat, mkdir, readdir, rename } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { AppConfigService } from '../../../config/config.service.js';
import type {
  CreateDirectoryInput,
  DeleteFileInput,
  ListFilesInput,
  GetTreeInput,
  RenamePathInput,
  DeleteMultipleInput,
  CreateMultipleDirectoriesInput,
} from '../types/filesystem.type.js';
import {
  assertNoProtectedEnvironmentFiles,
  ensureDestinationDoesNotExist,
  FilesystemAccess,
  moveToTrash,
} from '../utils/filesystem.utils.js';

/** Handles directory listing, trees, creation, rename, and deletion. */
@Injectable()
export class DirectoryService {
  private readonly access: FilesystemAccess;

  /** Creates the service and initializes its dependencies. */
  constructor(config: AppConfigService) {
    this.access = new FilesystemAccess(config);
  }

  /** Creates configured workspace roots before directory tools are used. */
  onModuleInit(): Promise<void> {
    return this.access.initialize();
  }

  /** Lists direct children with type, size, and modification metadata. */
  async list(input: ListFilesInput): Promise<
    Array<{
      name: string;
      type: 'file' | 'directory' | 'symlink';
      size: number;
      modifiedAt: Date;
    }>
  > {
    const directory = await this.access.resolve(
      input.path ?? '.',
      input.rootIndex,
    );
    const entries = await readdir(directory, { withFileTypes: true });

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

  /** Creates a directory and missing parent directories. */
  async createDirectory(input: CreateDirectoryInput): Promise<void> {
    await mkdir(await this.access.resolve(input.path, input.rootIndex), {
      recursive: true,
    });
  }

  /** Moves a directory and descendants to Trash. */
  async deleteDirectory(input: DeleteFileInput): Promise<void> {
    const path = await this.access.resolve(input.path, input.rootIndex);
    const metadata = await lstat(path);

    if (!metadata.isDirectory()) {
      throw new BadRequestException('Path is not a directory');
    }

    if (path === this.access.allowedRoots[input.rootIndex ?? 0]) {
      throw new ForbiddenException('An allowed root cannot be moved to Trash');
    }

    await moveToTrash(path, false, true);
  }

  /** Renames a directory without replacing an existing destination. */
  async renameDirectory(input: RenamePathInput): Promise<void> {
    const source = await this.access.resolve(input.path, input.rootIndex);
    const destination = await this.access.resolve(
      input.newPath,
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
    await rename(source, destination);
  }

  /** Returns a bounded recursive tree and never follows symbolic links. */
  async getTree(
    input: GetTreeInput,
  ): Promise<Array<{ name: string; type: string; children?: unknown[] }>> {
    const root = await this.access.resolve(input.path ?? '.', input.rootIndex);
    const maxDepth = Math.min(Math.max(input.maxDepth ?? 5, 1), 10);

    const walk = async (
      directory: string,
      depth: number,
    ): Promise<Array<{ name: string; type: string; children?: unknown[] }>> => {
      const entries = await readdir(directory, { withFileTypes: true });
      const result: Array<{
        name: string;
        type: string;
        children?: unknown[];
      }> = [];

      for (const entry of entries) {
        const path = resolve(directory, entry.name);
        if (entry.isSymbolicLink()) {
          result.push({ name: entry.name, type: 'symlink' });
        } else if (entry.isDirectory()) {
          result.push({
            name: entry.name,
            type: 'directory',
            ...(depth < maxDepth
              ? { children: await walk(path, depth + 1) }
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

  /** Deletes a batch of mixed entries and reports per-path outcomes. */
  async deleteMultiple(input: DeleteMultipleInput): Promise<{
    succeeded: string[];
    failed: Array<{ path: string; error: string }>;
  }> {
    const succeeded: string[] = [];
    const failed: Array<{ path: string; error: string }> = [];

    for (const item of input.paths) {
      try {
        const path = await this.access.resolve(item, input.rootIndex);
        const metadata = await lstat(path);

        if (path === this.access.allowedRoots[input.rootIndex ?? 0]) {
          throw new ForbiddenException(
            'An allowed root cannot be moved to Trash',
          );
        }

        await moveToTrash(
          path,
          metadata.isSymbolicLink(),
          metadata.isDirectory(),
        );
        succeeded.push(item);
      } catch (error) {
        failed.push({
          path: item,
          error:
            error instanceof Error ? error.message : 'Unknown filesystem error',
        });
      }
    }

    return { succeeded, failed };
  }

  /** Creates multiple directories and reports individual failures. */
  async createMultipleDirectories(
    input: CreateMultipleDirectoriesInput,
  ): Promise<{
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
}
