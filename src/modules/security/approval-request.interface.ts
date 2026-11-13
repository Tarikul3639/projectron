
import type { ApprovalStatus } from './approval-status.type.js';

// Represents an approval request created by an MCP client.
export interface ApprovalRequest {
  id: string;
  clientId: string;
  action: string;
  reason: string;
  createdAt: number;
  expiresAt: number;
  status: ApprovalStatus;
  decidedAt?: number;
}
