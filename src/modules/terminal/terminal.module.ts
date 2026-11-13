import { Module } from '@nestjs/common';
import { AppConfigModule } from '../../config/config.module.js';
import { SecurityModule } from '../security/security.module.js';
import { TerminalService } from './terminal.service.js';
import { TerminalTools } from './terminal.tools.js';

// Registers the terminal execution service and its single MCP tools provider.
@Module({
  imports: [AppConfigModule, SecurityModule],
  providers: [TerminalService, TerminalTools],
  exports: [TerminalService, TerminalTools],
})
export class TerminalModule {}
