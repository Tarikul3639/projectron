import { Module } from '@nestjs/common';
import { ApprovalService } from './approval.service.js';

// Provides the approval lifecycle used by protected feature modules.
@Module({
  providers: [ApprovalService],
  // Makes approval validation available to MCP tools and execution services.
  exports: [ApprovalService],
})
export class SecurityModule {}
