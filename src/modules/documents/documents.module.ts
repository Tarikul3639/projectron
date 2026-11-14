import { Module } from '@nestjs/common';
import { AppConfigModule } from '../../config/config.module.js';
import { DocumentsTools } from './tools/documents.tools.js';
import { DocumentFileService } from './services/document-file.service.js';
import { DocumentConverterService } from './services/document-converter.service.js';
import { DocumentTemplateService } from './services/document-template.service.js';
import { WordDocumentService } from './services/word-document.service.js';
import { SpreadsheetDocumentService } from './services/spreadsheet-document.service.js';
import { PresentationDocumentService } from './services/presentation-document.service.js';
import { PdfDocumentService } from './services/pdf-document.service.js';
import { OfficeConverterService } from './services/office-converter.service.js';

// Keeps all MCP tools in one provider and delegates file formats to focused services.
@Module({
  imports: [AppConfigModule],
  providers: [
    DocumentFileService,
    DocumentConverterService,
    DocumentTemplateService,
    WordDocumentService,
    SpreadsheetDocumentService,
    PresentationDocumentService,
    PdfDocumentService,
    OfficeConverterService,
    DocumentsTools,
  ],
  exports: [
    DocumentFileService,
    DocumentConverterService,
    DocumentTemplateService,
    WordDocumentService,
    SpreadsheetDocumentService,
    PresentationDocumentService,
    PdfDocumentService,
    OfficeConverterService,
    DocumentsTools,
  ],
})
export class DocumentsModule {}
