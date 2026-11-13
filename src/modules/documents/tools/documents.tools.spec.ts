import { describe, expect, it, vi } from 'vitest';
import { DocumentsTools } from './documents.tools.js';

describe('DocumentsTools', () => {
  const files = {
    read: vi.fn(),
    inspect: vi.fn(),
    create: vi.fn(),
  };
  const converter = { convert: vi.fn() };
  const templates = { generate: vi.fn(() => '# Project') };
  const approval = {
    run: vi.fn((_scope, _reason, _input, _context, execute) => execute()),
  };
  const tools = new DocumentsTools(
    files as never,
    converter as never,
    templates as never,
    approval as never,
  );

  it('exposes supported document capabilities', () => {
    expect(tools.capabilities().formats).toContain('Markdown');
  });

  it('delegates reads and inspection directly to the document file service', async () => {
    files.read.mockResolvedValue({
      path: 'README.md',
      format: 'md',
      content: '# Hello',
      truncated: false,
    });
    files.inspect.mockResolvedValue({
      path: 'README.md',
      format: 'md',
      words: 1,
    });
    await tools.read({ path: 'README.md' });
    await tools.inspect({ path: 'README.md' });
    expect(files.read).toHaveBeenCalled();
    expect(files.inspect).toHaveBeenCalled();
  });

  it('does not request approval when creating a new document', async () => {
    files.create.mockResolvedValue({ path: 'notes.md' });
    await tools.create(
      {
        path: 'notes.md',
        content: 'Hello',
        clientId: 'client',
        overwrite: false,
      },
      {} as never,
    );
    expect(approval.run).not.toHaveBeenCalled();
  });

  it('routes replacement through the shared MCP approval service', async () => {
    files.create.mockResolvedValue({ path: 'notes.md', overwritten: true });
    await tools.create(
      {
        path: 'notes.md',
        content: 'Updated',
        clientId: 'client',
        overwrite: true,
      },
      {} as never,
    );
    expect(approval.run).toHaveBeenCalledWith(
      'documents',
      expect.any(String),
      expect.any(Object),
      expect.anything(),
      expect.any(Function),
    );
  });
});
