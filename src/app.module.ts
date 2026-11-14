import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppConfigModule } from './config/config.module.js';
import { LoggingInterceptor } from './common/logging/logging.interceptor.js';

import { BrowserModule } from './modules/browser/browser.module.js';
import { DocumentsModule } from './modules/documents/documents.module.js';
import { FilesystemModule } from './modules/filesystem/filesystem.module.js';
import { McpModule } from './modules/mcp/mcp.module.js';
import { NetworkModule } from './modules/network/network.module.js';
import { OrchestrationModule } from './modules/orchestration/orchestration.module.js';
import { ProcessesModule } from './modules/processes/processes.module.js';
import { ProjectsModule } from './modules/projects/projects.module.js';
import { StorageModule } from './modules/storage/storage.module.js';
import { SystemModule } from './modules/system/system.module.js';
import { TerminalModule } from './modules/terminal/terminal.module.js';

@Module({
  imports: [
    AppConfigModule,
    StorageModule,
    BrowserModule,
    DocumentsModule,
    FilesystemModule,
    TerminalModule,
    ProcessesModule,
    ProjectsModule,
    OrchestrationModule,
    NetworkModule,
    SystemModule,
    McpModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
