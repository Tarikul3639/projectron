import { Module } from '@nestjs/common';
import { AppConfigModule } from '../../config/config.module.js';
import { ApprovalModule } from '../approval/approval.module.js';
import { TerminalService } from './services/terminal.service.js';
import { TerminalTools } from './tools/terminal.tools.js';

// Registers the terminal execution service and its single MCP tools provider.
@Module({
  imports: [AppConfigModule, ApprovalModule],
  providers: [TerminalService, TerminalTools],
  exports: [TerminalService, TerminalTools],
})
export class TerminalModule {}
