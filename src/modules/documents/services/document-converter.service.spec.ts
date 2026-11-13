import { describe, expect, it, vi } from 'vitest';
import { DocumentConverterService } from './document-converter.service.js';

describe('DocumentConverterService', () => {
  const files = {
    read: vi.fn(),
    create: vi.fn(),
  };
  const service = new DocumentConverterService(files as never);

  it('converts Markdown to escaped HTML', async () => {
    files.read.mockResolvedValue({
      path: 'source.md',
      format: 'md',
      content: '# Hello <world>',
      truncated: false,
    });
    files.create.mockResolvedValue({ path: 'output.html' });
    await service.convert({
      sourcePath: 'source.md',
      destinationPath: 'output.html',
      clientId: 'test-client',
      overwrite: false,
    });
    expect(files.create).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'output.html',
        content: expect.stringContaining('&lt;world&gt;'),
      }),
    );
  });

  it('converts CSV rows into JSON objects', async () => {
    files.read.mockResolvedValue({
      path: 'source.csv',
      format: 'csv',
      content: 'name,age\nAda,37',
      truncated: false,
    });
    files.create.mockResolvedValue({ path: 'output.json' });
    await service.convert({
      sourcePath: 'source.csv',
      destinationPath: 'output.json',
      clientId: 'test-client',
      overwrite: false,
    });
    expect(files.create).toHaveBeenCalledWith(
      expect.objectContaining({
        content: '[\n  {\n    "name": "Ada",\n    "age": "37"\n  }\n]',
      }),
    );
  });
});
