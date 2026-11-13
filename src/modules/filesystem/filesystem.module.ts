import { Module } from '@nestjs/common';
import { AppConfigModule } from '../../config/config.module.js';
import { ApprovalModule } from '../approval/approval.module.js';
import { FileService } from './services/file.service.js';
import { DirectoryService } from './services/directory.service.js';
import { FileEditService } from './services/file-edit.service.js';
import { FileTransferService } from './services/file-transfer.service.js';
import { FilesystemTools } from './tools/filesystem.tools.js';

// Registers the four focused filesystem services and their single MCP tools provider.
@Module({
  imports: [AppConfigModule, ApprovalModule],
  providers: [
    FileService,
    DirectoryService,
    FileEditService,
    FileTransferService,
    FilesystemTools,
  ],
  exports: [
    FileService,
    DirectoryService,
    FileEditService,
    FileTransferService,
    FilesystemTools,
  ],
})
export class FilesystemModule {}
