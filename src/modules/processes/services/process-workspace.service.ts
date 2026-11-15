import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { mkdir, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { AppConfigService } from '../../../config/config.service.js';

/** Resolves and validates process working directories against configured workspace roots before a child process is launched. */
@Injectable()
export class ProcessWorkspaceService {
  private readonly roots: string[];
  /** Injects workspace configuration and path validation used to resolve process working directories safely. */
  constructor(config: AppConfigService) {
    this.roots = config.filesystemAllowedRoots
      .split(/[:;]/)
      .map((item) => resolve(item.trim()))
      .filter(Boolean);
  }
  /** Creates configured workspace roots before process launch requests are accepted. */
  async onModuleInit(): Promise<void> {
    await Promise.all(
      this.roots.map((root) => mkdir(root, { recursive: true })),
    );
  }
  /** Resolves a process working directory and verifies that it remains within a configured allowed workspace root. */
  async resolveWorkingDirectory(path: string): Promise<string> {
    const requested = isAbsolute(path)
      ? resolve(path)
      : resolve(this.roots[0] ?? '.', path);
    let actual: string;
    try {
      actual = await realpath(requested);
    } catch {
      throw new BadRequestException(
        'Working directory does not exist or cannot be accessed',
      );
    }
    const roots = await Promise.all(
      this.roots.map((root) => realpath(root).catch(() => '')),
    );
    const allowed = roots.some((root) => {
      if (!root) return false;
      const rel = relative(root, actual);
      return (
        rel === '' ||
        (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
      );
    });
    if (!allowed)
      throw new ForbiddenException(
        'Working directory is outside configured filesystem roots',
      );
    return actual;
  }
}
