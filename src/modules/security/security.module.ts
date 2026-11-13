import { Module } from '@nestjs/common';
import { ApprovalService } from './approval.service.js';

// Provides the approval workflow used before protected operations are executed.
@Module({
  providers: [ApprovalService],
  // Makes approval handling available to other feature modules.
  exports: [ApprovalService],
})
export class SecurityModule {}
