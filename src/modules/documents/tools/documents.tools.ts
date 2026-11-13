import { Injectable } from '@nestjs/common';
import { Tool, type McpContext } from '@nestjs/mcp';
import { McpApprovalService } from '../../approval/services/mcp-approval.service.js';
import * as s from '../schemas/documents.schemas.js';
import type * as t from '../types/documents.type.js';
import { DocumentFileService } from '../services/document-file.service.js';
import { DocumentConverterService } from '../services/document-converter.service.js';
import { DocumentTemplateService } from '../services/document-template.service.js';

/** Publishes document tools and routes replacement operations through shared MCP approval. */
@Injectable()
export class DocumentsTools {
  /** Initializes the tool handlers and their dependencies. */
  constructor(
    private readonly files: DocumentFileService,
    private readonly converter: DocumentConverterService,
    private readonly templates: DocumentTemplateService,
    private readonly approval: McpApprovalService,
  ) {}

  /** Lists supported document formats, operations, and current limitations. */
  /** Returns the browser automation capabilities and safety restrictions. */
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

  /** Reads a supported text document without exposing protected environment files. */
  /** Handles read for the component. */
  @Tool({
    name: 'documents_read',
    description:
      'Read a Markdown, text, HTML, JSON, CSV, XML, or YAML document from an allowed workspace.',
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
  /** Handles inspect for the component. */
  @Tool({
    name: 'documents_inspect',
    description:
      'Inspect a supported text document and return size, format, line, word, and character counts.',
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

  /** Creates a document; replacing an existing file requires explicit user approval. */
  /** Handles create for the component. */
  @Tool({
    name: 'documents_create',
    description:
      'Create a Markdown, text, HTML, JSON, CSV, XML, or YAML document. Existing files require approval before replacement.',
    inputSchema: s.documentCreateSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  })
  create(input: t.DocumentCreateInput, context: McpContext) {
    if (!input.overwrite) return this.files.create(input);
    return this.approval.run(
      'documents',
      'Replace an existing document at ' + input.path,
      input,
      context,
      () => this.files.create(input),
    );
  }

  /** Converts supported text formats and gates replacement of an existing destination. */
  /** Handles convert for the component. */
  @Tool({
    name: 'documents_convert',
    description:
      'Convert supported text-based formats: Markdown, TXT, HTML, JSON, and CSV. Existing destinations require approval.',
    inputSchema: s.documentConvertSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  })
  convert(input: t.DocumentConvertInput, context: McpContext) {
    if (!input.overwrite) return this.converter.convert(input);
    return this.approval.run(
      'documents',
      'Convert ' + input.sourcePath + ' and replace ' + input.destinationPath,
      input,
      context,
      () => this.converter.convert(input),
    );
  }

  /** Generates a project-document template and gates replacement of an existing file. */
  /** Handles template for the component. */
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
  template(input: t.DocumentTemplateInput, context: McpContext) {
    const execute = async () =>
      this.files.create({
        path: input.path,
        content: this.templates.generate(input),
        overwrite: input.overwrite,
        clientId: input.clientId,
        rootIndex: input.rootIndex,
      });
    if (!input.overwrite) return execute();
    return this.approval.run(
      'documents',
      'Generate the ' + input.template + ' template and replace ' + input.path,
      input,
      context,
      execute,
    );
  }
}
