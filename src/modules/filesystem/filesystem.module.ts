import { Module } from '@nestjs/common';
import { AppConfigModule } from '../../config/config.module.js';
import { SecurityModule } from '../security/security.module.js';
import { FilesystemService } from './filesystem.service.js';
import { FilesystemTools } from './filesystem.tools.js';

// Registers the filesystem service and its single MCP tools provider.
@Module({
  imports: [AppConfigModule, SecurityModule],
  providers: [FilesystemService, FilesystemTools],
  exports: [FilesystemService, FilesystemTools],
})
export class FilesystemModule {}
