import { Module } from '@nestjs/common';
import { AgentCoordinationService } from './services/agent-coordination.service.js';
import { AgentCoordinationTools } from './tools/agent-coordination.tools.js';

@Module({
  providers: [AgentCoordinationService, AgentCoordinationTools],
  exports: [AgentCoordinationService],
})
export class AgentCoordinationModule {}
