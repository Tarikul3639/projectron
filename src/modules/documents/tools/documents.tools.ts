import { Injectable } from '@nestjs/common';
import { Tool } from '@nestjs/mcp';
import * as s from '../schemas/documents.schemas.js';
import type * as t from '../types/documents.type.js';
import { DocumentFileService } from '../services/document-file.service.js';
import { DocumentConverterService } from '../services/document-converter.service.js';
import { DocumentTemplateService } from '../services/document-template.service.js';

/** Publishes document reading, creation, conversion, and template tools. */
@Injectable()
export class DocumentsTools {
  /** Initializes document services. */
  constructor(
    private readonly files: DocumentFileService,
    private readonly converter: DocumentConverterService,
    private readonly templates: DocumentTemplateService,
  ) {}

  /** Lists supported document formats and limitations. */
  @Tool({
    name: 'documents_capabilities',
    description:
      'Describe supported document formats, operations, limits, and restrictions.',
    inputSchema: s.documentEmptySchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  capabilities() {
    return {
      formats: ['Markdown', 'TXT', 'HTML', 'JSON', 'CSV', 'XML', 'YAML'],
      operations: ['read', 'create', 'inspect', 'convert', 'generate_template'],
      maxDocumentBytes: 1_000_000,
      pathBoundary: 'configured filesystem roots',
      protectedFiles: '.env and .env.* are blocked; .env.example is allowed',
      limitations: [
        'PDF and Office binary parsing/generation are not currently implemented',
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

  /** Inspects a supported document and returns metadata without its body. */
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

  /** Creates or replaces a supported text document when overwrite is enabled. */
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

  /** Converts a supported text document to another supported format. */
  @Tool({
    name: 'documents_convert',
    description:
      'Convert supported text-based formats: Markdown, TXT, HTML, JSON, and CSV. Set overwrite=true to replace an existing destination.',
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
}
