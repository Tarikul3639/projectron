import { Module } from '@nestjs/common';
import { AppConfigModule } from '../../config/config.module.js';
import { McpModule } from '../mcp/mcp.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { AgentExecutionService } from './services/agent-execution.service.js';
import { AiPlannerService } from './services/ai-planner.service.js';
import { OrchestrationService } from './services/orchestration.service.js';
import { OrchestrationTools } from './tools/orchestration.tools.js';
import { AI_PROVIDER } from './interfaces/ai-provider.interface.js';
import { OpenAiCompatibleProvider } from './providers/openai-compatible.provider.js';

/** Coordinates planning while leaving execution to the owning domain modules. */
@Module({
  imports: [AppConfigModule, McpModule, StorageModule],
  providers: [
    { provide: AI_PROVIDER, useClass: OpenAiCompatibleProvider },
    AiPlannerService,
    AgentExecutionService,
    OrchestrationService,
    OrchestrationTools,
  ],
  exports: [AiPlannerService, AgentExecutionService, OrchestrationService],
})
export class OrchestrationModule {}
