import { Injectable } from '@nestjs/common';
import {
  appendFile,
  mkdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { AppConfigService } from '../../config/config.service.js';

/** Provides bounded, root-confined file operations for application storage. */
@Injectable()
export class FileStorageService {
  private readonly rootPath: string;

  /** Resolves the dedicated storage directory from application configuration. */
  constructor(config: AppConfigService) {
    this.rootPath = resolve(config.storagePath);
  }

  /** Reads a UTF-8 storage file after resolving and validating its path beneath the storage root. */
  async read(path: string): Promise<string> {
    return readFile(this.resolvePath(path), 'utf8');
  }

  /** Writes UTF-8 content to a storage file, creating parent directories when necessary. */
  async write(path: string, content: string): Promise<void> {
    const filePath = this.resolvePath(path);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, content, 'utf8');
  }

  /** Appends UTF-8 content to a storage file without replacing earlier records, creating parent directories as needed. */
  async append(path: string, content: string): Promise<void> {
    const filePath = this.resolvePath(path);
    await mkdir(dirname(filePath), { recursive: true });
    await appendFile(filePath, content, 'utf8');
  }

  /** Removes the selected storage file without failing when it is already absent. */
  async delete(path: string): Promise<void> {
    await rm(this.resolvePath(path), { force: true });
  }

  /** Checks whether the resolved storage path currently identifies a regular file. */
  async exists(path: string): Promise<boolean> {
    try {
      return (await stat(this.resolvePath(path))).isFile();
    } catch {
      return false;
    }
  }

  /** Creates the requested storage directory and any missing parent directories. */
  async createDirectory(path: string): Promise<void> {
    await mkdir(this.resolvePath(path), { recursive: true });
  }

  /** Resolves a non-empty relative path and rejects traversal outside the configured storage root. */
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
