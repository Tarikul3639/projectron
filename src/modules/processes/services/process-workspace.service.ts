import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { mkdir, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { AppConfigService } from '../../../config/config.service.js';

/** Provides the process workspace functionality for this module. */
@Injectable()
export class ProcessWorkspaceService {
  private readonly roots: string[];
  /** Creates the service and initializes its dependencies. */
  constructor(config: AppConfigService) {
    this.roots = config.filesystemAllowedRoots
      .split(/[:;]/)
      .map((item) => resolve(item.trim()))
      .filter(Boolean);
  }
  /** Initializes the resources required by this component. */
  async onModuleInit(): Promise<void> {
    await Promise.all(
      this.roots.map((root) => mkdir(root, { recursive: true })),
    );
  }
  /** Handles resolve working directory for the component. */
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
