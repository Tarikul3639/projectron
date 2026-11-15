import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module.js';
import { CoreModule } from './core/core.module.js';
import { ActivityLoggingModule } from './modules/activity-logging/activity-logging.module.js';
import { BrowserModule } from './modules/browser/browser.module.js';
import { DocumentsModule } from './modules/documents/documents.module.js';
import { FilesystemModule } from './modules/filesystem/filesystem.module.js';
import { McpModule } from './modules/mcp/mcp.module.js';
import { NetworkModule } from './modules/network/network.module.js';
import { ProcessesModule } from './modules/processes/processes.module.js';
import { WorkspacesModule } from './modules/workspaces/workspaces.module.js';
import { StorageModule } from './modules/storage/storage.module.js';
import { SystemModule } from './modules/system/system.module.js';
import { TerminalModule } from './modules/terminal/terminal.module.js';

@Module({
  imports: [
    AppConfigModule,
    CoreModule,
    StorageModule,
    ActivityLoggingModule,
    BrowserModule,
    DocumentsModule,
    FilesystemModule,
    TerminalModule,
    ProcessesModule,
    WorkspacesModule,
    NetworkModule,
    SystemModule,
    McpModule,
  ],
})
export class AppModule {}
