import { Module } from '@nestjs/common';
import { AppConfigModule } from '../../config/config.module.js';
import { SecurityModule } from '../security/security.module.js';
import { ProcessService } from './process.service.js';
import { ProcessTools } from './process.tools.js';

// Registers process supervision, approval handling, and its MCP tools.
@Module({
  imports: [AppConfigModule, SecurityModule],
  providers: [ProcessService, ProcessTools],
  exports: [ProcessService, ProcessTools],
})
export class ProcessesModule {}
