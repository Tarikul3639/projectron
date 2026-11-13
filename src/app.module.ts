import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module.js';
import { FilesystemModule } from './modules/filesystem/filesystem.module.js';
import { McpModule } from './modules/mcp/mcp.module.js';
import { ProcessesModule } from './modules/processes/processes.module.js';
import { SecurityModule } from './modules/security/security.module.js';
import { StorageModule } from './modules/storage/storage.module.js';
import { TerminalModule } from './modules/terminal/terminal.module.js';

// Root module that composes configuration, feature modules, and the MCP endpoint.
@Module({
  imports: [
    AppConfigModule,
    SecurityModule,
    StorageModule,
    FilesystemModule,
    TerminalModule,
    ProcessesModule,
    McpModule,
  ],
})
export class AppModule {}
