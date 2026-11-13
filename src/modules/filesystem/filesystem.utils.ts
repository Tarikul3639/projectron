import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import {
  copyFile,
  lstat,
  mkdir,
  realpath,
  rename,
  rm,
  symlink,
  readlink,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { homedir } from 'node:os';
import {
  basename,
  dirname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from 'node:path';

/** Checks whether a filesystem path exists without following symbolic links. */
export async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

/** Prevents a filesystem operation from silently replacing an existing destination. */
export async function ensureDestinationDoesNotExist(
  destination: string,
): Promise<void> {
  try {
    await lstat(destination);
    throw new ConflictException('Destination already exists');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

/** Stores an entry in the standard XDG Trash directory with restore metadata. */
export async function moveToTrash(
  filePath: string,
  isSymbolicLink: boolean,
  isDirectory = false,
): Promise<void> {
  const dataHome =
    process.env.XDG_DATA_HOME || resolve(homedir(), '.local', 'share');
  const trashRoot = resolve(dataHome, 'Trash');
  const filesDirectory = resolve(trashRoot, 'files');
  const infoDirectory = resolve(trashRoot, 'info');
  const trashName = `${cryptoRandomId()}-${basename(filePath)}`;
  const trashedFile = resolve(filesDirectory, trashName);
  const infoFile = resolve(infoDirectory, `${trashName}.trashinfo`);
  const deletedAt = new Date().toISOString().slice(0, 19);
  const trashInfo = `[Trash Info]\\nPath=${encodeURI(filePath)}\\nDeletionDate=${deletedAt}\\n`;

  await mkdir(filesDirectory, { recursive: true });
  await mkdir(infoDirectory, { recursive: true });
  await writeFile(infoFile, trashInfo, { encoding: 'utf8', flag: 'wx' });

  try {
    try {
      await rename(filePath, trashedFile);
    } catch (error) {
      // Cross-device moves need a copy-and-remove fallback.
      if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error;
      if (isSymbolicLink) {
        await symlink(await readlink(filePath), trashedFile);
      } else if (isDirectory) {
        const { cp } = await import('node:fs/promises');
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

/** Resolves a relative path and blocks traversal or symlink escapes from an allowed root. */
export async function resolveSafePath(
  path: string,
  allowedRoots: string[],
  rootIndex = 0,
): Promise<string> {
  if (!path.trim() || isAbsolute(path)) {
    throw new BadRequestException('A non-empty relative path is required');
  }
  const root = allowedRoots[rootIndex];
  if (!root) throw new BadRequestException('Invalid allowed root index');
  const rootRealPath = await realpath(root);
  const target = resolve(rootRealPath, path);
  const fromRoot = relative(rootRealPath, target);
  if (
    fromRoot === '..' ||
    fromRoot.startsWith(`..${sep}`) ||
    isAbsolute(fromRoot)
  ) {
    throw new ForbiddenException('Path is outside the configured allowed root');
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

/** Generates a unique identifier for a trash entry. */
function cryptoRandomId(): string {
  return randomUUID();
}
