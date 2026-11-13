import { Module } from '@nestjs/common';
import { ApprovalModule } from '../approval/approval.module.js';
import { AppConfigModule } from '../../config/config.module.js';

import { ProcessExecutionService } from './services/process-execution.service.js';
import { ProcessRegistryService } from './services/process-registry.service.js';
import { ProcessWorkspaceService } from './services/process-workspace.service.js';
import { ProcessTools } from './process.tools.js';

// Registers process supervision, approval handling, and its MCP tools.
@Module({
  imports: [AppConfigModule, ApprovalModule],
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
