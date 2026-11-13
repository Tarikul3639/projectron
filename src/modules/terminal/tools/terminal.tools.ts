import { ConflictException, Injectable } from '@nestjs/common';
import { Tool } from '@nestjs/mcp';
import { ApprovalService } from '../../approval/services/approval.service.js';
import { executeCommandInputSchema } from '../schemas/terminal.schemas.js';
import type { ExecuteCommandInput } from '../types/terminal.type.js';
import { TerminalService } from '../services/terminal.service.js';

/**
 * Exposes terminal execution to MCP clients and translates approval-required
 * conflicts into a response the assistant can handle in the same conversation.
 */
@Injectable()
export class TerminalTools {
  /** Injects command execution and the approval-request lookup service. */
  constructor(
    private readonly terminal: TerminalService,
    private readonly approvals: ApprovalService,
  ) {}

  /**
   * Runs a command when it is already authorized.
   *
   * If TerminalService reports that approval is required, this method returns
   * the pending request details instead of executing or approving the command.
   * The user must explicitly decide through approval_decide; after approval,
   * the assistant retries this tool with the original approvalRequestId.
   */
  @Tool({
    name: 'terminal_execute',
    description:
      'Execute one local program inside a configured workspace. Pass the executable and each argument separately; shell syntax and interactive interpreters are blocked. When approval is required, this tool returns an approvalRequestId without executing the command. Ask the user to explicitly approve or reject it using approval_decide. After approval, retry this tool with the same command and approvalRequestId. Output is limited to 1 MiB per stream and execution to 120 seconds.',
    inputSchema: executeCommandInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  })
  async execute(input: ExecuteCommandInput) {
    try {
      // TerminalService owns command validation, approval enforcement and execution.
      return await this.terminal.execute(input);
    } catch (error) {
      // Only approval-required conflicts carry an approvalRequestId.
      // Re-throw unrelated conflicts so their original meaning is preserved.
      if (!(error instanceof ConflictException)) {
        throw error;
      }

      const response = error.getResponse();

      // NestJS may return either a plain message or a structured response body.
      const approvalRequestId =
        typeof response === 'object' && response !== null
          ? (response as { approvalRequestId?: string }).approvalRequestId
          : undefined;

      if (!approvalRequestId) {
        throw error;
      }

      // Verify the request exists and belongs to this MCP client before
      // exposing its details or allowing the assistant to continue the flow.
      const request = await this.approvals.getRequest(approvalRequestId);
      if (!request || request.clientId !== input.clientId) {
        throw error;
      }

      // This is a pending approval response only: no command is executed here.
      // approval_decide records the user's decision; a later retry performs execution.
      return {
        status: 'approval_required',
        approvalRequestId: request.id,
        expiresAt: request.expiresAt,
        action: request.action,
        reason: request.reason,
        message:
          'The command was NOT executed. Ask the user to explicitly approve or reject this request with approval_decide. If approved, retry terminal_execute with the same approvalRequestId.',
      };
    }
  }
}