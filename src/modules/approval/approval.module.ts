import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module.js';
import { ApprovalService } from './services/approval.service.js';
import { McpApprovalService } from './services/mcp-approval.service.js';

/** Owns approval request persistence and the MCP approval handshake. */
@Module({
  imports: [StorageModule],
  providers: [ApprovalService, McpApprovalService],
  exports: [ApprovalService, McpApprovalService],
})
export class ApprovalModule {}
