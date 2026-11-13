import type { ApprovalStatus } from '../types/approval-status.type.js';

// Describes the approval request data stored and returned by the security module.
export interface ApprovalRequest {
  // Unique identifier used to retrieve or decide this request.
  id: string;
  // MCP client that initiated the protected operation.
  clientId: string;
  // Name of the operation awaiting approval.
  action: string;
  // Human-readable explanation of why approval is needed.
  reason: string;
  // Unix timestamp in milliseconds when the request was created.
  createdAt: number;
  // Unix timestamp in milliseconds after which the request expires.
  expiresAt: number;
  // Current lifecycle state of the approval request.
  status: ApprovalStatus;
  // Unix timestamp in milliseconds when the request was decided or expired.
  decidedAt?: number;
}
