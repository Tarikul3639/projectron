import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module.js';

import { BrowserModule } from './modules/browser/browser.module.js';
import { DocumentsModule } from './modules/documents/documents.module.js';
import { FilesystemModule } from './modules/filesystem/filesystem.module.js';
import { McpModule } from './modules/mcp/mcp.module.js';
import { NetworkModule } from './modules/network/network.module.js';
import { ProcessesModule } from './modules/processes/processes.module.js';
import { ApprovalModule } from './modules/approval/approval.module.js';
import { ProjectsModule } from './modules/projects/projects.module.js';
import { StorageModule } from './modules/storage/storage.module.js';
import { SystemModule } from './modules/system/system.module.js';
import { TerminalModule } from './modules/terminal/terminal.module.js';

@Module({
  imports: [
    AppConfigModule,
    ApprovalModule,
    StorageModule,
    BrowserModule,
    DocumentsModule,
    FilesystemModule,
    TerminalModule,
    ProcessesModule,
    ProjectsModule,
    NetworkModule,
    SystemModule,
    McpModule,
  ],
})
export class AppModule {}
