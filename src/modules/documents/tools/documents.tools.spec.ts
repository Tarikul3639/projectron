import type { McpContext } from '@nestjs/mcp';
import { describe, expect, it, vi } from 'vitest';
import { McpApprovalService } from '../../approval/services/mcp-approval.service.js';
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
      {} as unknown as McpApprovalService,
    );

    expect(tools.capabilities().formats).toContain('Markdown');
  });

  it('delegates reads and inspection to the document file service', async () => {
    const files = {
      read: vi.fn().mockResolvedValue({
        path: 'README.md',
        format: 'md',
        content: '# Hello',
        truncated: false,
      }),
      inspect: vi.fn().mockResolvedValue({
        path: 'README.md',
        format: 'md',
        words: 1,
      }),
      create: vi.fn(),
    };
    const tools = new DocumentsTools(
      files as unknown as DocumentFileService,
      {} as unknown as DocumentConverterService,
      {} as unknown as DocumentTemplateService,
      {} as unknown as McpApprovalService,
    );

    await tools.read({ path: 'README.md' });
    await tools.inspect({ path: 'README.md' });

    expect(files.read).toHaveBeenCalledWith({ path: 'README.md' });
    expect(files.inspect).toHaveBeenCalledWith({ path: 'README.md' });
  });

  it('creates a new document without requesting approval', async () => {
    const files = { create: vi.fn().mockResolvedValue({ path: 'notes.md' }) };
    const approval = { run: vi.fn() };
    const tools = new DocumentsTools(
      files as unknown as DocumentFileService,
      {} as unknown as DocumentConverterService,
      {} as unknown as DocumentTemplateService,
      approval as unknown as McpApprovalService,
    );
    const context = { authInfo: { clientId: 'client' } } as McpContext;

    await tools.create(
      {
        path: 'notes.md',
        content: 'Hello',
        clientId: 'client',
        overwrite: false,
      },
      context,
    );

    expect(files.create).toHaveBeenCalledOnce();
    expect(approval.run).not.toHaveBeenCalled();
  });

  it('routes document replacement through the MCP approval service', async () => {
    const files = {
      create: vi
        .fn()
        .mockResolvedValue({ path: 'notes.md', overwritten: true }),
    };
    const approval = {
      run: vi.fn((_scope, _reason, _input, _context, execute) => execute()),
    };
    const tools = new DocumentsTools(
      files as unknown as DocumentFileService,
      {} as unknown as DocumentConverterService,
      {} as unknown as DocumentTemplateService,
      approval as unknown as McpApprovalService,
    );
    const context = { authInfo: { clientId: 'client' } } as McpContext;
    const input = {
      path: 'notes.md',
      content: 'Updated',
      clientId: 'client',
      overwrite: true,
    };

    await tools.create(input, context);

    expect(approval.run).toHaveBeenCalledWith(
      'documents',
      expect.any(String),
      input,
      context,
      expect.any(Function),
    );
    expect(files.create).toHaveBeenCalledOnce();
  });
});
