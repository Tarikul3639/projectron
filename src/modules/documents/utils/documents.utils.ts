import { BadRequestException } from '@nestjs/common';
import { basename, extname } from 'node:path';

export const SUPPORTED_DOCUMENT_FORMATS = [
  'md',
  'markdown',
  'txt',
  'text',
  'html',
  'htm',
  'json',
  'csv',
  'xml',
  'yaml',
  'yml',
] as const;

const PROTECTED_ENVIRONMENT_FILE = /^\.env(?:\..+)?$/i;

// Blocks every .env variant except the explicitly permitted example template.
export function assertDocumentPathIsAllowed(path: string): void {
  const name = basename(path);
  if (
    PROTECTED_ENVIRONMENT_FILE.test(name) &&
    name.toLowerCase() !== '.env.example'
  ) {
    throw new BadRequestException(
      'Environment files are protected and cannot be accessed by Documents tools',
    );
  }
}

// Rejects binary or unknown formats rather than decoding them as corrupted text.
export function getDocumentFormat(path: string): string {
  if (basename(path).toLowerCase() === '.env.example') return 'txt';
  const extension = extname(path).slice(1).toLowerCase();
  if (!(SUPPORTED_DOCUMENT_FORMATS as readonly string[]).includes(extension)) {
    throw new BadRequestException(
      'Unsupported document format ".' +
        (extension || '(no extension)') +
        '". Supported formats: ' +
        SUPPORTED_DOCUMENT_FORMATS.join(', '),
    );
  }
  return extension;
}

// Counts words in Unicode text without assuming English-only content.
export function countWords(content: string): number {
  return content.trim() ? content.trim().split(/\s+/u).length : 0;
}
