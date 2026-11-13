import { Injectable } from '@nestjs/common';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { AppConfigService } from '../../config/config.service.js';

/**
 * Provides filesystem storage operations inside the configured storage directory.
 * All paths are resolved relative to the storage root and cannot escape it.
 */

@Injectable()
export class FileStorageService {
  // Keeps all application storage operations inside the configured storage directory.
  private readonly rootPath: string;

  constructor(config: AppConfigService) {
    // Resolves the configured storage directory to an absolute path.
    this.rootPath = resolve(config.storagePath);
  }

  /** Reads a UTF-8 file from the storage directory. */
  async read(path: string): Promise<string> {
    return readFile(this.resolvePath(path), 'utf8');
  }

  /** Writes UTF-8 content and creates missing parent directories. */
  async write(path: string, content: string): Promise<void> {
    const filePath = this.resolvePath(path);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, content, 'utf8');
  }

  /** Deletes a stored file without affecting its parent directory. */
  async delete(path: string): Promise<void> {
    await rm(this.resolvePath(path), { force: true });
  }

  /** Checks whether a stored file exists. */
  async exists(path: string): Promise<boolean> {
    try {
      return (await stat(this.resolvePath(path))).isFile();
    } catch {
      return false;
    }
  }

  /** Creates a directory inside the storage root when it does not exist. */
  async createDirectory(path: string): Promise<void> {
    await mkdir(this.resolvePath(path), { recursive: true });
  }

  /** Resolves a relative storage path and rejects paths outside the storage root. */
  private resolvePath(path: string): string {
    if (!path.trim() || isAbsolute(path)) {
      throw new Error('Storage path must be a non-empty relative path');
    }

    const target = resolve(this.rootPath, path);
    const fromRoot = relative(this.rootPath, target);

    if (
      fromRoot.startsWith('..') ||
      fromRoot === '..' ||
      isAbsolute(fromRoot)
    ) {
      throw new Error(
        'Storage path is outside the configured storage directory',
      );
    }
    return join(this.rootPath, fromRoot);
  }
}
