import { BadRequestException, Injectable } from '@nestjs/common';
import { Tool } from '@nestjs/mcp';
import * as s from '../schemas/documents.schemas.js';
import type * as t from '../types/documents.type.js';
import { DocumentFileService } from '../services/document-file.service.js';
import { DocumentConverterService } from '../services/document-converter.service.js';
import { DocumentTemplateService } from '../services/document-template.service.js';
import { WordDocumentService } from '../services/word-document.service.js';
import { SpreadsheetDocumentService } from '../services/spreadsheet-document.service.js';
import { PresentationDocumentService } from '../services/presentation-document.service.js';
import { PdfDocumentService } from '../services/pdf-document.service.js';
import { OfficeConverterService } from '../services/office-converter.service.js';

/** Publishes document and Office tools while keeping format implementations in services. */
@Injectable()
export class DocumentsTools {
  constructor(
    private readonly files: DocumentFileService,
    private readonly converter: DocumentConverterService,
    private readonly templates: DocumentTemplateService,
    private readonly word: WordDocumentService,
    private readonly spreadsheet: SpreadsheetDocumentService,
    private readonly presentation: PresentationDocumentService,
    private readonly pdf: PdfDocumentService,
    private readonly officeConverter: OfficeConverterService,
  ) {}

  /** Lists supported formats, operations, conversion paths, limits, and known restrictions. */
  @Tool({
    name: 'documents_capabilities',
    description:
      'Describe supported document formats, Office capabilities, conversions, limits, and restrictions.',
    inputSchema: s.documentEmptySchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  capabilities() {
    return {
      formats: [
        'Markdown',
        'TXT',
        'HTML',
        'JSON',
        'CSV',
        'XML',
        'YAML',
        'DOCX',
        'XLSX',
        'PPTX',
        'PDF',
      ],
      extensions: [
        '.md',
        '.markdown',
        '.txt',
        '.text',
        '.html',
        '.htm',
        '.json',
        '.csv',
        '.xml',
        '.yaml',
        '.yml',
        '.docx',
        '.xlsx',
        '.pptx',
        '.pdf',
      ],
      operations: [
        'read',
        'create',
        'inspect',
        'convert',
        'generate_template',
        'extract_text',
        'spreadsheet_export',
      ],
      officeTools: [
        'documents_create_word',
        'documents_read_word',
        'documents_create_spreadsheet',
        'documents_read_spreadsheet',
        'documents_create_presentation',
        'documents_read_presentation',
        'documents_create_pdf',
        'documents_read_pdf',
        'documents_inspect_office',
        'documents_convert_office',
      ],
      limits: {
        textDocumentBytes: 1_000_000,
        officeDocumentBytes: 50 * 1024 * 1024,
        maximumSpreadsheetRowsPerSheet: 10000,
        maximumPresentationSlides: 100,
      },
      conversions: [
        'DOCX to TXT, HTML, or text-first PDF',
        'XLSX to CSV, JSON, TXT, or text-first PDF',
        'PPTX to TXT or text-first PDF',
        'PDF to TXT',
        'Supported text formats to other supported text formats',
      ],
      pathBoundary: 'configured filesystem roots',
      protectedFiles: '.env and .env.* are blocked; .env.example is allowed',
      limitations: [
        'Legacy binary Word/Excel/PowerPoint files (.doc, .xls, .ppt) are not supported.',
        'OpenDocument formats (.odt, .ods, .odp) are not supported.',
        'PDF creation and Office-to-PDF conversion produce text-first PDFs and do not preserve original Office page layouts, charts, or visual styling.',
        'DOCX generation currently supports headings, paragraphs, bullet lists, and simple tables; embedded images and complex page layouts are not implemented.',
        'XLSX generation supports multiple sheets, cell values, header formatting, filters, and frozen header rows; native Excel chart generation is not implemented.',
        'PPTX generation supports slide titles, body text, bullet lists, and speaker notes; existing PPTX editing and chart generation are not implemented.',
        'PDF text extraction does not perform OCR on scanned pages.',
      ],
    };
  }

  /** Reads a supported text document. */
  @Tool({
    name: 'documents_read',
    description: 'Read a supported text document from an allowed workspace.',
    inputSchema: s.documentReadSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  read(input: t.DocumentReadInput) {
    return this.files.read(input);
  }

  /** Inspects a supported text document and returns metadata without its body. */
  @Tool({
    name: 'documents_inspect',
    description:
      'Inspect a text document and return size, format, line, word, and character counts.',
    inputSchema: s.documentInspectSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  inspect(input: t.DocumentInspectInput) {
    return this.files.inspect(input);
  }

  /** Creates a supported text document. */
  @Tool({
    name: 'documents_create',
    description:
      'Create a supported text document. Set overwrite=true to replace an existing regular file.',
    inputSchema: s.documentCreateSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  })
  create(input: t.DocumentCreateInput) {
    return this.files.create(input);
  }

  /** Converts supported text-based formats. */
  @Tool({
    name: 'documents_convert',
    description:
      'Convert supported text-based formats: Markdown, TXT, HTML, JSON, and CSV.',
    inputSchema: s.documentConvertSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  })
  convert(input: t.DocumentConvertInput) {
    return this.converter.convert(input);
  }

  /** Generates a project-document template. */
  @Tool({
    name: 'documents_generate_template',
    description:
      'Generate a README, API documentation, architecture, user guide, or changelog template.',
    inputSchema: s.documentTemplateSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  })
  template(input: t.DocumentTemplateInput) {
    return this.files.create({
      path: input.path,
      content: this.templates.generate(input),
      overwrite: input.overwrite,
      rootIndex: input.rootIndex,
    });
  }

  /** Creates a Word DOCX with headings, paragraphs, lists, and simple tables. */
  @Tool({
    name: 'documents_create_word',
    description:
      'Create a .docx Word document from structured sections with optional headings, paragraphs, bullet lists, and tables.',
    inputSchema: s.wordCreateSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  })
  createWord(input: t.WordCreateInput) {
    return this.word.create(input);
  }

  /** Extracts plain text and metadata from a Word DOCX file. */
  @Tool({
    name: 'documents_read_word',
    description:
      'Read and extract text from a .docx Word document. Legacy .doc files are not supported.',
    inputSchema: s.officeReadSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  readWord(input: t.OfficeReadInput) {
    return this.word.read(input.path, input.rootIndex, input.maxCharacters);
  }

  /** Creates an XLSX workbook with one or more worksheets. */
  @Tool({
    name: 'documents_create_spreadsheet',
    description:
      'Create an .xlsx workbook with multiple worksheets, headers, rows, header formatting, filters, and frozen headers.',
    inputSchema: s.spreadsheetCreateSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  })
  createSpreadsheet(input: t.SpreadsheetCreateInput) {
    return this.spreadsheet.create(input);
  }

  /** Reads worksheet names, dimensions, headers, and cell values from XLSX. */
  @Tool({
    name: 'documents_read_spreadsheet',
    description:
      'Read worksheets, headers, and cell values from an .xlsx workbook.',
    inputSchema: s.spreadsheetReadSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  readSpreadsheet(input: t.SpreadsheetReadInput) {
    return this.spreadsheet.read(
      input.path,
      input.rootIndex,
      input.maxRows ?? 2000,
    );
  }

  /** Creates a PowerPoint PPTX presentation with slides, bullets, and notes. */
  @Tool({
    name: 'documents_create_presentation',
    description:
      'Create a .pptx PowerPoint presentation with slide titles, body text, bullet lists, and speaker notes.',
    inputSchema: s.presentationCreateSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  })
  createPresentation(input: t.PresentationCreateInput) {
    return this.presentation.create(input);
  }

  /** Extracts visible slide text and slide count from a PPTX presentation. */
  @Tool({
    name: 'documents_read_presentation',
    description:
      'Extract visible text, slide order, and slide count from a .pptx presentation.',
    inputSchema: s.officeReadSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  readPresentation(input: t.OfficeReadInput) {
    return this.presentation.read(
      input.path,
      input.rootIndex,
      input.maxCharacters,
    );
  }

  /** Creates a searchable text-first PDF. */
  @Tool({
    name: 'documents_create_pdf',
    description:
      'Create a text-first PDF from a title, sections, and paragraphs. Supports A4 and Letter page sizes.',
    inputSchema: s.pdfCreateSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  })
  createPdf(input: t.PdfCreateInput) {
    return this.pdf.create(input);
  }

  /** Extracts selectable text and page metadata from a PDF. */
  @Tool({
    name: 'documents_read_pdf',
    description:
      'Extract selectable text and page counts from a PDF. Scanned-page OCR is not supported.',
    inputSchema: s.officeReadSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  readPdf(input: t.OfficeReadInput) {
    return this.pdf.read(input.path, input.rootIndex, input.maxCharacters);
  }

  /** Inspects supported Office/PDF files without returning their full content. */
  @Tool({
    name: 'documents_inspect_office',
    description:
      'Inspect DOCX, XLSX, PPTX, or PDF metadata such as byte size, sheet count, slide count, or page count.',
    inputSchema: s.officeInspectSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  async inspectOffice(input: t.OfficeInspectInput) {
    const extension = input.path.split('.').pop()?.toLowerCase();
    if (extension === 'docx') {
      const result = await this.word.read(input.path, input.rootIndex, 1);
      return {
        path: input.path,
        format: result.format,
        bytes: result.bytes,
        modifiedAt: result.modifiedAt,
        characters: result.characters,
        words: result.words,
      };
    }
    if (extension === 'xlsx') {
      const result = await this.spreadsheet.read(
        input.path,
        input.rootIndex,
        1,
      );
      return {
        path: input.path,
        format: result.format,
        bytes: result.bytes,
        modifiedAt: result.modifiedAt,
        sheetCount: result.sheetCount,
        sheets: result.sheets.map((sheet) => ({
          name: sheet.name,
          rowCount: sheet.rowCount,
          columnCount: sheet.columnCount,
        })),
      };
    }
    if (extension === 'pptx') {
      const result = await this.presentation.read(
        input.path,
        input.rootIndex,
        1,
      );
      return {
        path: input.path,
        format: result.format,
        bytes: result.bytes,
        modifiedAt: result.modifiedAt,
        slideCount: result.slideCount,
      };
    }
    if (extension === 'pdf') {
      const result = await this.pdf.read(input.path, input.rootIndex, 1);
      return {
        path: input.path,
        format: result.format,
        bytes: result.bytes,
        modifiedAt: result.modifiedAt,
        pages: result.pages,
        characters: result.characters,
        words: result.words,
      };
    }
    throw new BadRequestException(
      'Office inspection supports .docx, .xlsx, .pptx, and .pdf files',
    );
  }

  /** Converts between supported Office, PDF, and text formats. */
  @Tool({
    name: 'documents_convert_office',
    description:
      'Convert DOCX to TXT/HTML/PDF, XLSX to CSV/JSON/TXT/PDF, PPTX to TXT/PDF, PDF to TXT, and supported text formats to one another.',
    inputSchema: s.officeConvertSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  })
  convertOffice(input: t.OfficeConvertInput) {
    return this.officeConverter.convert(input);
  }
}
