import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module.js';
import { ApprovalService } from './services/approval.service.js';
import { McpApprovalService } from './services/mcp-approval.service.js';
import { ApprovalTools } from './tools/approval.tools.js';

/** Owns approval persistence, MCP approval tools, and elicitation support. */
@Module({
  imports: [StorageModule],
  providers: [ApprovalService, McpApprovalService, ApprovalTools],
  exports: [ApprovalService, McpApprovalService, ApprovalTools],
})
export class ApprovalModule {}
