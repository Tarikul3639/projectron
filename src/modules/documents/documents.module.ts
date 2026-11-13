import { Module } from '@nestjs/common';
import { ApprovalModule } from '../approval/approval.module.js';
import { AppConfigModule } from '../../config/config.module.js';
import { DocumentsTools } from './documents.tools.js';
import { DocumentFileService } from './services/document-file.service.js';
import { DocumentConverterService } from './services/document-converter.service.js';
import { DocumentTemplateService } from './services/document-template.service.js';

// Registers focused document services and the shared MCP approval infrastructure.
@Module({
  imports: [AppConfigModule, ApprovalModule],
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
