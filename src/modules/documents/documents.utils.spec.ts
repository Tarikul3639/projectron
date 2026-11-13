import { describe, expect, it } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import {
  assertDocumentPathIsAllowed,
  getDocumentFormat,
} from './documents.utils.js';

describe('documents.utils', () => {
  it('blocks .env files and variants', () => {
    expect(() => assertDocumentPathIsAllowed('config/.env.production')).toThrow(
      BadRequestException,
    );
    expect(() => assertDocumentPathIsAllowed('.env.local')).toThrow(
      BadRequestException,
    );
  });

  it('allows the example environment template as text', () => {
    expect(() => assertDocumentPathIsAllowed('.env.example')).not.toThrow();
    expect(getDocumentFormat('.env.example')).toBe('txt');
  });

  it('rejects unsupported binary document extensions', () => {
    expect(() => getDocumentFormat('report.pdf')).toThrow(BadRequestException);
    expect(getDocumentFormat('README.md')).toBe('md');
  });
});
