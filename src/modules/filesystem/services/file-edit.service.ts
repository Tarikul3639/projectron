import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { lstat, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { AppConfigService } from '../../../config/config.service.js';
import { ApprovalService } from '../../approval/services/approval.service.js';
import { FilesystemAccess } from '../filesystem.utils.js';

/** Handles exact text edits, line-range reads, and bounded workspace searches. */
@Injectable()
export class FileEditService {
  private readonly access: FilesystemAccess;

  constructor(config: AppConfigService, approvals: ApprovalService) {
    this.access = new FilesystemAccess(config, approvals);
  }

  /** Ensures configured roots exist before search/edit operations begin. */
  onModuleInit(): Promise<void> {
    return this.access.initialize();
  }

  /** Replaces one exact occurrence; ambiguous matches are rejected. */
  async edit(input: {
    path: string;
    oldText: string;
    newText: string;
    clientId: string;
    approvalRequestId?: string;
    rootIndex?: number;
  }): Promise<{ path: string; replacements: 1 }> {
    if (!input.oldText) {
      throw new BadRequestException('oldText must not be empty');
    }

    const path = await this.access.resolve(input.path, input.rootIndex);
    const metadata = await lstat(path);

    if (!metadata.isFile()) {
      throw new BadRequestException('Path is not a regular file');
    }

    const original = await readFile(path, 'utf8');
    const first = original.indexOf(input.oldText);

    if (first < 0) {
      throw new NotFoundException('The exact text was not found');
    }

    if (original.indexOf(input.oldText, first + input.oldText.length) >= 0) {
      throw new ConflictException(
        'The exact text occurs more than once; provide a more specific match',
      );
    }

    await this.access.requireApproval(
      input.approvalRequestId,
      input.clientId,
      `filesystem.edit:${input.rootIndex ?? 0}:${input.path}`,
      'Edit content in an existing file',
    );

    const updated =
      original.slice(0, first) +
      input.newText +
      original.slice(first + input.oldText.length);

    const temporary = resolve(
      dirname(path),
      `.projectron-edit-${Date.now()}-${Math.random().toString(16).slice(2)}.tmp`,
    );

    await writeFile(temporary, updated, { encoding: 'utf8', flag: 'wx' });
    const { rename } = await import('node:fs/promises');
    await rename(temporary, path);

    return { path: input.path, replacements: 1 };
  }

  /** Reads an inclusive, one-based line range with a bounded maximum span. */
  async readRange(input: {
    path: string;
    startLine: number;
    endLine: number;
    rootIndex?: number;
  }): Promise<{
    path: string;
    startLine: number;
    endLine: number;
    totalLines: number;
    content: string;
  }> {
    if (
      !Number.isInteger(input.startLine) ||
      !Number.isInteger(input.endLine) ||
      input.startLine < 1 ||
      input.endLine < input.startLine ||
      input.endLine - input.startLine > 999
    ) {
      throw new BadRequestException(
        'Line range must be valid and contain at most 1000 lines',
      );
    }

    const path = await this.access.resolve(input.path, input.rootIndex);
    const text = await readFile(path, 'utf8');
    const lines = text.split(/\r?\n/);

    return {
      path: input.path,
      startLine: input.startLine,
      endLine: Math.min(input.endLine, lines.length),
      totalLines: lines.length,
      content: lines.slice(input.startLine - 1, input.endLine).join('\n'),
    };
  }

  /** Finds matching file names recursively without following symlinks. */
  async searchFiles(input: {
    query: string;
    path?: string;
    maxResults?: number;
    rootIndex?: number;
  }): Promise<Array<{ path: string; type: 'file' | 'directory' }>> {
    if (!input.query.trim()) {
      throw new BadRequestException('Search query must not be empty');
    }

    const root = await this.access.resolve(input.path ?? '.', input.rootIndex);
    const limit = Math.min(Math.max(input.maxResults ?? 100, 1), 500);
    const results: Array<{ path: string; type: 'file' | 'directory' }> = [];

    const walk = async (dir: string): Promise<void> => {
      if (results.length >= limit) return;

      for (const entry of await readdir(dir, { withFileTypes: true })) {
        if (results.length >= limit) return;

        const absolute = resolve(dir, entry.name);
        const rel = absolute.slice(root.length).replace(/^[/\\]/, '');

        if (entry.isSymbolicLink()) continue;

        if (entry.name.toLowerCase().includes(input.query.toLowerCase())) {
          results.push({
            path: rel || entry.name,
            type: entry.isDirectory() ? 'directory' : 'file',
          });
        }

        if (entry.isDirectory()) {
          await walk(absolute);
        }
      }
    };

    await walk(root);
    return results;
  }

  /** Searches UTF-8 text files recursively; binary files and symlinks are skipped. */
  async searchInFiles(input: {
    query: string;
    path?: string;
    maxResults?: number;
    rootIndex?: number;
  }): Promise<Array<{ path: string; line: number; content: string }>> {
    if (!input.query) {
      throw new BadRequestException('Search query must not be empty');
    }

    const root = await this.access.resolve(input.path ?? '.', input.rootIndex);
    const limit = Math.min(Math.max(input.maxResults ?? 100, 1), 500);
    const results: Array<{ path: string; line: number; content: string }> = [];

    const walk = async (dir: string): Promise<void> => {
      if (results.length >= limit) return;

      for (const entry of await readdir(dir, { withFileTypes: true })) {
        if (results.length >= limit) return;

        const absolute = resolve(dir, entry.name);
        // Never inspect protected environment-file contents during workspace search.
        if (
          /^\.env(?:\..+)?$/.test(entry.name) &&
          entry.name !== '.env.example'
        ) {
          continue;
        }

        if (entry.isSymbolicLink()) continue;

        if (entry.isDirectory()) {
          await walk(absolute);
          continue;
        }

        if (!entry.isFile()) continue;

        try {
          const buffer = await readFile(absolute);
          if (buffer.includes(0)) continue;

          const text = buffer.toString('utf8');
          if (Buffer.from(text, 'utf8').compare(buffer) !== 0) continue;

          const lines = text.split(/\r?\n/);
          for (let i = 0; i < lines.length && results.length < limit; i++) {
            if (lines[i].includes(input.query)) {
              results.push({
                path: absolute.slice(root.length).replace(/^[/\\]/, ''),
                line: i + 1,
                content: lines[i].slice(0, 500),
              });
            }
          }
        } catch {
          /* Ignore unreadable files and continue the bounded search. */
        }
      }
    };

    await walk(root);
    return results;
  }
}
