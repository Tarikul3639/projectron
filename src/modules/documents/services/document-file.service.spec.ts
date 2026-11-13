import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BadRequestException } from '@nestjs/common';
import { DocumentFileService } from './document-file.service.js';

describe('DocumentFileService', () => {
  let root: string;
  let service: DocumentFileService;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'projectron-documents-'));
    service = new DocumentFileService({
      filesystemAllowedRoots: root,
    } as never);
    await service.onModuleInit();
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('creates and reads a Markdown document', async () => {
    await service.create({
      path: 'docs/README.md',
      content: '# Hello',
      clientId: 'test-client',
      overwrite: false,
    });
    await expect(
      service.read({ path: 'docs/README.md' }),
    ).resolves.toMatchObject({
      format: 'md',
      content: '# Hello',
      truncated: false,
    });
  });

  it('returns document metadata without exposing its content', async () => {
    await writeFile(join(root, 'guide.txt'), 'one two\nthree', 'utf8');
    const result = await service.inspect({ path: 'guide.txt' });
    expect(result).toMatchObject({
      format: 'txt',
      words: 3,
      lines: 2,
      characters: 13,
    });
    expect(result).not.toHaveProperty('content');
  });

  it('rejects traversal outside the workspace', async () => {
    await expect(
      service.read({ path: '../outside.md' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks protected environment files but permits .env.example', async () => {
    await writeFile(join(root, '.env.production'), 'SECRET=value', 'utf8');
    await writeFile(join(root, '.env.example'), 'KEY=', 'utf8');
    await expect(
      service.read({ path: '.env.production' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.read({ path: '.env.example' })).resolves.toMatchObject(
      { content: 'KEY=' },
    );
  });

  it('does not overwrite an existing document without explicit overwrite', async () => {
    await writeFile(join(root, 'notes.md'), 'original', 'utf8');
    await expect(
      service.create({
        path: 'notes.md',
        content: 'replacement',
        clientId: 'test-client',
        overwrite: false,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
