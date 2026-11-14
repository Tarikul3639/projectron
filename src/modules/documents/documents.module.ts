import { Module } from '@nestjs/common';
import { AppConfigModule } from '../../config/config.module.js';
import { DocumentsTools } from './tools/documents.tools.js';
import { DocumentFileService } from './services/document-file.service.js';
import { DocumentConverterService } from './services/document-converter.service.js';
import { DocumentTemplateService } from './services/document-template.service.js';

// Registers focused document services and their MCP tools.
@Module({
  imports: [AppConfigModule],
  providers: [
    DocumentFileService,
    DocumentConverterService,
    DocumentTemplateService,
    DocumentsTools,
  ],
  exports: [
    DocumentFileService,
    DocumentConverterService,
    DocumentTemplateService,
    DocumentsTools,
  ],
})
export class DocumentsModule {}
