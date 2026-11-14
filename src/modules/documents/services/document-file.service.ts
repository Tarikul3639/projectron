import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  lstat,
  mkdir,
  readFile,
  realpath,
  stat,
  writeFile,
} from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { AppConfigService } from '../../../config/config.service.js';
import type {
  DocumentCreateInput,
  DocumentInspectInput,
  DocumentReadInput,
} from '../types/documents.type.js';
import type { DocumentInfo } from '../interfaces/documents.interface.js';
import {
  assertDocumentPathIsAllowed,
  countWords,
  getDocumentFormat,
} from '../utils/documents.utils.js';

const MAX_DOCUMENT_BYTES = 1_000_000;

/** Reads, inspects, and creates supported text documents inside configured workspace roots. */
@Injectable()
export class DocumentFileService {
  /** Creates the service and initializes its dependencies. */
  constructor(private readonly config: AppConfigService) {}

  /** Creates configured workspace roots before document operations begin. */
  async onModuleInit(): Promise<void> {
    for (const root of this.roots()) await mkdir(root, { recursive: true });
  }

  /** Reads a bounded UTF-8 document and never exposes protected environment files. */
  async read(input: DocumentReadInput) {
    const path = await this.resolveExisting(input.path, input.rootIndex);
    const format = getDocumentFormat(path);
    assertDocumentPathIsAllowed(path);
    const metadata = await stat(path);
    if (!metadata.isFile())
      throw new BadRequestException('Document path is not a regular file');
    if (metadata.size > MAX_DOCUMENT_BYTES)
      throw new BadRequestException(
        'Document exceeds the 1 MB text-reading limit',
      );
    const content = await readFile(path, 'utf8');
    const maxCharacters = input.maxCharacters ?? 100_000;
    return {
      path: input.path,
      format,
      content: content.slice(0, maxCharacters),
      truncated: content.length > maxCharacters,
    };
  }

  /** Inspects a supported text document and returns metadata and content statistics only. */
  async inspect(input: DocumentInspectInput): Promise<DocumentInfo> {
    const path = await this.resolveExisting(input.path, input.rootIndex);
    const format = getDocumentFormat(path);
    assertDocumentPathIsAllowed(path);
    const metadata = await stat(path);
    if (!metadata.isFile())
      throw new BadRequestException('Document path is not a regular file');
    if (metadata.size > MAX_DOCUMENT_BYTES)
      throw new BadRequestException(
        'Document exceeds the 1 MB inspection limit',
      );
    const content = await readFile(path, 'utf8');
    return {
      path: input.path,
      format,
      bytes: metadata.size,
      characters: content.length,
      words: countWords(content),
      lines: content ? content.split(/\r?\n/).length : 0,
      modifiedAt: metadata.mtime.toISOString(),
    };
  }

  /** Creates a supported text document and refuses silent replacement by default. */
  async create(input: DocumentCreateInput) {
    const path = await this.resolveForWrite(input.path, input.rootIndex);
    const format = getDocumentFormat(path);
    assertDocumentPathIsAllowed(path);
    const existing = await lstat(path).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return undefined;
      throw error;
    });
    if (existing?.isSymbolicLink() || (existing && !existing.isFile())) {
      throw new BadRequestException(
        'Document destination must be a regular file, not a symlink or directory',
      );
    }
    if (existing && !input.overwrite) {
      throw new BadRequestException(
        'Document already exists; set overwrite=true to replace it',
      );
    }
    if (Buffer.byteLength(input.content, 'utf8') > MAX_DOCUMENT_BYTES) {
      throw new BadRequestException(
        'Document content exceeds the 1 MB write limit',
      );
    }
    await writeFile(path, input.content, {
      encoding: 'utf8',
      flag: existing ? 'w' : 'wx',
    });
    return {
      path: input.path,
      format,
      bytes: Buffer.byteLength(input.content, 'utf8'),
      overwritten: Boolean(existing),
    };
  }

  /** Reads a bounded binary document after enforcing workspace and protected-file rules. */
  async readBinary(
    value: string,
    rootIndex = 0,
    maxBytes = 50 * 1024 * 1024,
  ): Promise<{ buffer: Buffer; bytes: number; modifiedAt: string }> {
    const path = await this.resolveExisting(value, rootIndex);
    assertDocumentPathIsAllowed(path);
    const metadata = await stat(path);
    if (!metadata.isFile()) {
      throw new BadRequestException('Document path is not a regular file');
    }
    if (metadata.size > maxBytes) {
      throw new BadRequestException(
        'Document exceeds the 50 MB binary-reading limit',
      );
    }
    const buffer = await readFile(path);
    return {
      buffer,
      bytes: metadata.size,
      modifiedAt: metadata.mtime.toISOString(),
    };
  }

  /** Writes a bounded binary document and refuses replacement unless explicitly requested. */
  async writeBinary(
    value: string,
    content: Buffer,
    overwrite = false,
    rootIndex = 0,
  ) {
    const path = await this.resolveForWrite(value, rootIndex);
    assertDocumentPathIsAllowed(path);
    if (content.byteLength > 50 * 1024 * 1024) {
      throw new BadRequestException(
        'Document exceeds the 50 MB binary-writing limit',
      );
    }
    const existing = await lstat(path).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return undefined;
      throw error;
    });
    if (existing?.isSymbolicLink() || (existing && !existing.isFile())) {
      throw new BadRequestException(
        'Document destination must be a regular file, not a symlink or directory',
      );
    }
    if (existing && !overwrite) {
      throw new BadRequestException(
        'Document already exists; set overwrite=true to replace it',
      );
    }
    await writeFile(path, content, { flag: existing ? 'w' : 'wx' });
    return {
      path: value,
      bytes: content.byteLength,
      overwritten: Boolean(existing),
    };
  }

  /** Resolves an existing document and verifies its real path remains inside its selected root. */
  private async resolveExisting(value: string, rootIndex = 0): Promise<string> {
    const target = await this.resolveLexical(value, rootIndex);
    const actual = await realpath(target).catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT')
          throw new NotFoundException('Document not found');
        throw error;
      },
    );
    await this.assertInsideRoot(actual, rootIndex);
    return actual;
  }

  /** Creates parent directories and validates their real path before a document is written. */
  private async resolveForWrite(value: string, rootIndex = 0): Promise<string> {
    const target = await this.resolveLexical(value, rootIndex);
    await mkdir(dirname(target), { recursive: true });
    const parent = await realpath(dirname(target));
    await this.assertInsideRoot(parent, rootIndex);
    return target;
  }

  /** Resolves a relative path against one configured root and rejects traversal. */
  private async resolveLexical(
    value: string,
    rootIndex: number,
  ): Promise<string> {
    if (isAbsolute(value) || value.split(/[\\/]/).includes('..')) {
      throw new BadRequestException(
        'Document path must stay inside an allowed workspace root',
      );
    }
    const root = this.roots()[rootIndex];
    if (!root) throw new BadRequestException('Invalid filesystem root index');
    const absoluteRoot = resolve(root);
    const target = resolve(absoluteRoot, value);
    const rel = relative(absoluteRoot, target);
    if (rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) {
      throw new BadRequestException(
        'Document path escapes its allowed workspace root',
      );
    }
    return target;
  }

  /** Confirms the resolved path is beneath the selected real workspace root. */
  private async assertInsideRoot(
    target: string,
    rootIndex: number,
  ): Promise<void> {
    const root = await realpath(this.roots()[rootIndex]);
    const rel = relative(root, target);
    if (rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) {
      throw new BadRequestException(
        'Document path resolves outside its allowed workspace root',
      );
    }
  }

  /** Returns configured workspace roots in their configured priority order. */
  private roots(): string[] {
    return this.config.filesystemAllowedRoots
      .split(':')
      .map((root) => resolve(root.trim()));
  }
}
