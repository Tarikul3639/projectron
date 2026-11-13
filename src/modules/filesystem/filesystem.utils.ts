import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import {
  copyFile,
  cp,
  lstat,
  mkdir,
  realpath,
  rename,
  rm,
  symlink,
  readlink,
  readdir,
  unlink,
  writeFile,
} from 'node:fs/promises';
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
import { ApprovalService } from '../approval/services/approval.service.js';

/** Blocks direct access to .env files while allowing the documented .env.example template. */
export function assertEnvironmentFileIsNotProtected(path: string): void {
  const name = basename(path.replace(/[\\/]+$/, ''));
  if (/^\.env(?:\..+)?$/.test(name) && name !== '.env.example') {
    throw new ForbiddenException(
      'Environment files are protected and cannot be read or modified by Projectron',
    );
  }
}

/** Shared filesystem boundary: allowed roots, safe path resolution, and one-use approvals. */
export class FilesystemAccess {
  readonly allowedRoots: string[];
  private readonly approvalRequired: boolean;
  private readonly usedApprovalIds = new Set<string>();

  constructor(
    config: AppConfigService,
    private readonly approvals: ApprovalService,
  ) {
    this.allowedRoots = config.filesystemAllowedRoots
      .split(delimiter)
      .map((root) => resolve(root.trim()))
      .filter(Boolean);
    this.approvalRequired = config.approvalRequired;
  }

  /** Creates the configured workspace roots during module initialization. */
  async initialize(): Promise<void> {
    await Promise.all(
      this.allowedRoots.map((root) => mkdir(root, { recursive: true })),
    );
  }

  /** Resolves a relative path while blocking traversal and symlink escapes. */
  async resolve(path: string, rootIndex = 0): Promise<string> {
    // Deny every direct access to real environment files; .env.example remains usable.
    assertEnvironmentFileIsNotProtected(path);

    if (!path.trim() || isAbsolute(path)) {
      throw new BadRequestException('A non-empty relative path is required');
    }

    const root = this.allowedRoots[rootIndex];
    if (!root) {
      throw new BadRequestException('Invalid allowed root index');
    }

    const rootReal = await realpath(root);
    const target = resolve(rootReal, path);
    const rel = relative(rootReal, target);

    if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
      throw new ForbiddenException(
        'Path is outside the configured allowed root',
      );
    }

    let ancestor = target;
    while (true) {
      try {
        const actual = await realpath(ancestor);
        const actualRel = relative(rootReal, actual);

        if (
          actualRel === '..' ||
          actualRel.startsWith(`..${sep}`) ||
          isAbsolute(actualRel)
        ) {
          throw new ForbiddenException(
            'Path resolves outside the configured allowed root',
          );
        }
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }

        const parent = dirname(ancestor);
        if (parent === ancestor) {
          throw error;
        }

        ancestor = parent;
      }
    }

    return target;
  }

  /** Requests approval or validates a matching, unused approval request. */
  async requireApproval(
    id: string | undefined,
    clientId: string,
    action: string,
    reason: string,
  ): Promise<void> {
    if (!this.approvalRequired) return;

    if (!id) {
      const request = await this.approvals.createRequest({
        clientId,
        action,
        reason,
      });

      throw new ConflictException({
        message: 'User approval is required before this operation can continue',
        approvalRequestId: request.id,
      });
    }

    if (this.usedApprovalIds.has(id)) {
      throw new ForbiddenException(
        'This approval request has already been used',
      );
    }

    const request = await this.approvals.getRequest(id);
    if (
      !request ||
      request.status !== 'approved' ||
      request.clientId !== clientId ||
      request.action !== action
    ) {
      throw new ForbiddenException('A matching approved request is required');
    }

    this.usedApprovalIds.add(id);
  }
}

/** Rejects directory operations that would expose or remove protected environment files. */
export async function assertNoProtectedEnvironmentFiles(
  directory: string,
): Promise<void> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    assertEnvironmentFileIsNotProtected(entry.name);
    if (entry.isDirectory()) {
      await assertNoProtectedEnvironmentFiles(resolve(directory, entry.name));
    }
  }
}

/** Checks path existence without following symbolic links. */
export async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

/** Prevents an operation from replacing an existing destination. */
export async function ensureDestinationDoesNotExist(
  path: string,
): Promise<void> {
  try {
    await lstat(path);
    throw new ConflictException('Destination already exists');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

/** Moves an entry to XDG Trash and writes its restore metadata. */
export async function moveToTrash(
  path: string,
  symbolicLink: boolean,
  directory = false,
): Promise<void> {
  // A parent directory cannot be removed if it contains any protected environment file.
  if (directory) {
    await assertNoProtectedEnvironmentFiles(path);
  }

  const dataHome =
    process.env.XDG_DATA_HOME || resolve(homedir(), '.local', 'share');
  const files = resolve(dataHome, 'Trash', 'files');
  const info = resolve(dataHome, 'Trash', 'info');
  const name = `${randomUUID()}-${basename(path)}`;
  const trashed = resolve(files, name);
  const infoPath = resolve(info, `${name}.trashinfo`);
  const metadata = `[Trash Info]\nPath=${encodeURI(path)}\nDeletionDate=${new Date().toISOString().slice(0, 19)}\n`;

  await mkdir(files, { recursive: true });
  await mkdir(info, { recursive: true });
  await writeFile(infoPath, metadata, { encoding: 'utf8', flag: 'wx' });

  try {
    try {
      await rename(path, trashed);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EXDEV') {
        throw error;
      }

      if (symbolicLink) {
        await symlink(await readlink(path), trashed);
      } else if (directory) {
        await cp(path, trashed, {
          recursive: true,
          errorOnExist: true,
          force: false,
          dereference: false,
        });
        await rm(path, { recursive: true });
      } else {
        await copyFile(path, trashed);
        await unlink(path);
      }
    }
  } catch (error) {
    await Promise.all([
      rm(infoPath, { force: true }),
      rm(trashed, { force: true, recursive: true }),
    ]);
    throw error;
  }
}
