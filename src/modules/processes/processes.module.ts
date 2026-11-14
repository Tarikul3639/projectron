import { Module } from '@nestjs/common';
import { AppConfigModule } from '../../config/config.module.js';

import { ProcessExecutionService } from './services/process-execution.service.js';
import { ProcessRegistryService } from './services/process-registry.service.js';
import { ProcessWorkspaceService } from './services/process-workspace.service.js';
import { ProcessTools } from './tools/process.tools.js';

// Registers process supervision services and their MCP tools.
@Module({
  imports: [AppConfigModule],
  providers: [
    ProcessWorkspaceService,
    ProcessRegistryService,
    ProcessExecutionService,
    ProcessTools,
  ],
  exports: [
    ProcessWorkspaceService,
    ProcessRegistryService,
    ProcessExecutionService,
    ProcessTools,
  ],
})
export class ProcessesModule {}
