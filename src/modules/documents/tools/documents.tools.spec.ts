import { describe, expect, it, vi } from 'vitest';
import { DocumentFileService } from '../services/document-file.service.js';
import { DocumentConverterService } from '../services/document-converter.service.js';
import { DocumentTemplateService } from '../services/document-template.service.js';
import { DocumentsTools } from './documents.tools.js';

describe('DocumentsTools', () => {
  it('exposes supported document capabilities', () => {
    const tools = new DocumentsTools(
      {} as unknown as DocumentFileService,
      {} as unknown as DocumentConverterService,
      {} as unknown as DocumentTemplateService,
    );
    expect(tools.capabilities().formats).toContain('Markdown');
  });

  it('delegates reads and inspection to the document file service', async () => {
    const files = {
      read: vi
        .fn()
        .mockResolvedValue({
          path: 'README.md',
          format: 'md',
          content: '# Hello',
          truncated: false,
        }),
      inspect: vi
        .fn()
        .mockResolvedValue({ path: 'README.md', format: 'md', words: 1 }),
      create: vi.fn(),
    };
    const tools = new DocumentsTools(
      files as unknown as DocumentFileService,
      {} as unknown as DocumentConverterService,
      {} as unknown as DocumentTemplateService,
    );
    await tools.read({ path: 'README.md' });
    await tools.inspect({ path: 'README.md' });
    expect(files.read).toHaveBeenCalledWith({ path: 'README.md' });
    expect(files.inspect).toHaveBeenCalledWith({ path: 'README.md' });
  });

  it('creates or replaces a document directly', async () => {
    const files = {
      create: vi
        .fn()
        .mockResolvedValue({ path: 'notes.md', overwritten: true }),
    };
    const tools = new DocumentsTools(
      files as unknown as DocumentFileService,
      {} as unknown as DocumentConverterService,
      {} as unknown as DocumentTemplateService,
    );
    const input = { path: 'notes.md', content: 'Updated', overwrite: true };
    await expect(tools.create(input)).resolves.toEqual({
      path: 'notes.md',
      overwritten: true,
    });
    expect(files.create).toHaveBeenCalledWith(input);
  });
});
