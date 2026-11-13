import { Injectable } from '@nestjs/common';
import { Tool } from '@nestjs/mcp';
import * as z from 'zod';
import {
  decideInputSchema,
  listPendingInputSchema,
} from '../schemas/approval.schemas.js';
import { ApprovalService } from '../services/approval.service.js';

/**
 * Exposes the approval inbox and explicit decision actions to the MCP client.
 *
 * These tools manage approval state only. They never execute the protected
 * operation themselves; the assistant must retry the original tool after approval.
 */
@Injectable()
export class ApprovalTools {
  /** Connects the MCP approval tools to the persisted approval lifecycle. */
  constructor(private readonly approvals: ApprovalService) { }

  /**
   * Lists pending approval requests for the supplied MCP client.
   *
   * This is a read-only operation. ApprovalService is responsible for filtering
   * the inbox so a client can only inspect its own pending requests.
   */
  @Tool({
    name: 'approval_list_pending',
    description:
      'List pending Projectron approval requests for a client. Review the action and reason before deciding.',
    inputSchema: listPendingInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  listPending(input: z.infer<typeof listPendingInputSchema>) {
    // Keep client scoping in the service rather than filtering results here.
    return this.approvals.listPending(input.clientId);
  }

  /**
   * Persists the user's explicit approval or rejection decision.
   *
   * An approval is permission for a later retry, not an instruction to execute.
   * The protected tool must be called again with the same approvalRequestId;
   * its service then revalidates the request before performing the operation.
   */
  @Tool({
    name: 'approval_decide',
    description:
      'Approve or reject one pending Projectron request after the user explicitly decides. This only records the decision; it does not execute the protected operation. After approval, retry the original tool with the same approvalRequestId when that tool supports it.',
    inputSchema: decideInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
  })
  async decide(input: z.infer<typeof decideInputSchema>) {
    // Convert the client-facing choice into the persisted approval status.
    const status = input.decision === 'approve' ? 'approved' : 'rejected';

    // The service verifies that this request belongs to the supplied client
    // and applies the decision to the matching pending request.
    const request = await this.approvals.decideForClient(
      input.approvalRequestId,
      input.clientId,
      status,
    );

    // Return the decision outcome and make the execution boundary explicit.
    // The protected operation is intentionally not invoked from this tool.
    return {
      status: request.status,
      approvalRequestId: request.id,
      decidedAt: request.decidedAt,
      message:
        request.status === 'approved'
          ? 'Approval recorded. The protected operation has NOT been executed; retry the original tool with this approvalRequestId.'
          : 'Request rejected. The protected operation was NOT executed.',
    };
  }
}
