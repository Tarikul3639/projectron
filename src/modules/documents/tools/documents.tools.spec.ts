import { describe, expect, it, vi } from 'vitest';
import { DocumentFileService } from '../services/document-file.service.js';
import { DocumentConverterService } from '../services/document-converter.service.js';
import { DocumentTemplateService } from '../services/document-template.service.js';
import { WordDocumentService } from '../services/word-document.service.js';
import { SpreadsheetDocumentService } from '../services/spreadsheet-document.service.js';
import { PresentationDocumentService } from '../services/presentation-document.service.js';
import { PdfDocumentService } from '../services/pdf-document.service.js';
import { OfficeConverterService } from '../services/office-converter.service.js';
import { DocumentsTools } from './documents.tools.js';

function createTools(
  files = {} as DocumentFileService,
  converter = {} as DocumentConverterService,
  templates = {} as DocumentTemplateService,
  word = {} as WordDocumentService,
  spreadsheet = {} as SpreadsheetDocumentService,
  presentation = {} as PresentationDocumentService,
  pdf = {} as PdfDocumentService,
  officeConverter = {} as OfficeConverterService,
) {
  return new DocumentsTools(
    files,
    converter,
    templates,
    word,
    spreadsheet,
    presentation,
    pdf,
    officeConverter,
  );
}

describe('DocumentsTools', () => {
  it('exposes modern Office formats and document operations', () => {
    const tools = createTools();
    const capabilities = tools.capabilities();
    expect(capabilities.formats).toContain('Markdown');
    expect(capabilities.formats).toContain('DOCX');
    expect(capabilities.formats).toContain('XLSX');
    expect(capabilities.formats).toContain('PPTX');
    expect(capabilities.formats).toContain('PDF');
    expect(capabilities.officeTools).toContain('documents_create_presentation');
  });

  it('delegates reads and inspection to the document file service', async () => {
    const files = {
      read: vi.fn().mockResolvedValue({
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
    const tools = createTools(files as unknown as DocumentFileService);
    await tools.read({ path: 'README.md' });
    await tools.inspect({ path: 'README.md' });
    expect(files.read).toHaveBeenCalledWith({ path: 'README.md' });
    expect(files.inspect).toHaveBeenCalledWith({ path: 'README.md' });
  });

  it('creates or replaces a text document through the file service', async () => {
    const files = {
      create: vi
        .fn()
        .mockResolvedValue({ path: 'notes.md', overwritten: true }),
    };
    const tools = createTools(files as unknown as DocumentFileService);
    const input = { path: 'notes.md', content: 'Updated', overwrite: true };
    await expect(tools.create(input)).resolves.toEqual({
      path: 'notes.md',
      overwritten: true,
    });
    expect(files.create).toHaveBeenCalledWith(input);
  });

  it('delegates Office creation to the format-specific services', async () => {
    const word = { create: vi.fn().mockResolvedValue({ format: 'docx' }) };
    const spreadsheet = {
      create: vi.fn().mockResolvedValue({ format: 'xlsx' }),
    };
    const presentation = {
      create: vi.fn().mockResolvedValue({ format: 'pptx' }),
    };
    const pdf = { create: vi.fn().mockResolvedValue({ format: 'pdf' }) };
    const tools = createTools(
      {} as DocumentFileService,
      {} as DocumentConverterService,
      {} as DocumentTemplateService,
      word as unknown as WordDocumentService,
      spreadsheet as unknown as SpreadsheetDocumentService,
      presentation as unknown as PresentationDocumentService,
      pdf as unknown as PdfDocumentService,
    );
    const wordInput = { path: 'report.docx', sections: [] };
    const sheetInput = { path: 'report.xlsx', sheets: [] };
    const slideInput = { path: 'report.pptx', title: 'Report', slides: [] };
    const pdfInput = { path: 'report.pdf', title: 'Report', sections: [] };
    await tools.createWord(wordInput as never);
    await tools.createSpreadsheet(sheetInput as never);
    await tools.createPresentation(slideInput as never);
    await tools.createPdf(pdfInput as never);
    expect(word.create).toHaveBeenCalledWith(wordInput);
    expect(spreadsheet.create).toHaveBeenCalledWith(sheetInput);
    expect(presentation.create).toHaveBeenCalledWith(slideInput);
    expect(pdf.create).toHaveBeenCalledWith(pdfInput);
  });
});
