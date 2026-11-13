import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Tool, type McpContext } from '@nestjs/mcp';
import {
  acceptedContent,
  inputRequired,
  inputResponse,
} from '@modelcontextprotocol/server';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import * as z from 'zod';
import { ApprovalService } from '../../approval/services/approval.service.js';
import { executeCommandInputSchema } from '../schemas/terminal.schemas.js';
import type { ExecuteCommandInput } from '../types/terminal.type.js';
import { TerminalService } from '../services/terminal.service.js';

// Defines the decision collected from the human through MCP elicitation.
const approvalDecisionSchema = z.object({
  decision: z.enum(['approve', 'reject']),
});

// A process-local signing key protects multi-round-trip approval state from tampering.
const approvalStateSecret = randomBytes(32);

interface ApprovalState {
  requestId: string;
  clientId: string;
  inputDigest: string;
  expiresAt: number;
}

/** Publishes terminal execution and requests human approval through the MCP client. */
@Injectable()
export class TerminalTools {
  /** Initializes the tool handlers and their dependencies. */
  constructor(
    private readonly terminal: TerminalService,
    private readonly approvals: ApprovalService,
  ) {}

  /**
   * Executes one program after the MCP client has collected an explicit user decision.
   * Modern clients use input_required; legacy clients use push-style elicitation.
   */
  /** Handles execute for the component. */
  @Tool({
    name: 'terminal_execute',
    description:
      'Execute one local program inside a configured workspace. Pass the executable and each argument separately; shell syntax and interactive interpreters are blocked. When approval is enabled, Projectron asks the connected MCP client to collect an explicit user decision before execution. Output is limited to 1 MiB per stream and execution to 120 seconds.',
    inputSchema: executeCommandInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  })
  async execute(input: ExecuteCommandInput, context: McpContext) {
    // A modern MCP client retries the same tool call with the user's elicitation response.
    if (context.era === 'modern') {
      const state = context.server.mcpReq.requestState<string>();
      if (state) return this.resumeModernApproval(input, context, state);
    }

    try {
      return await this.terminal.execute(input);
    } catch (error) {
      if (!(error instanceof ConflictException)) throw error;

      const response = error.getResponse();
      const requestId =
        typeof response === 'object' && response !== null
          ? (response as { approvalRequestId?: string }).approvalRequestId
          : undefined;
      if (!requestId) throw error;

      const request = await this.approvals.getRequest(requestId);
      if (!request || request.clientId !== input.clientId) throw error;

      // Keep the legacy protocol compatible while using the modern multi-round-trip flow by default.
      if (context.era === 'legacy') {
        return this.requestLegacyApproval(input, context, requestId);
      }

      return this.requestModernApproval(input, requestId, request.expiresAt);
    }
  }

  /** Returns an input_required result that the client renders as its native approval prompt. */
  private requestModernApproval(
    input: ExecuteCommandInput,
    requestId: string,
    expiresAt: number,
  ) {
    const state = this.signApprovalState({
      requestId,
      clientId: input.clientId,
      inputDigest: this.createInputDigest(input),
      expiresAt,
    });

    return inputRequired({
      requestState: state,
      inputRequests: {
        approval: inputRequired.elicit({
          message: this.createApprovalMessage(input),
          requestedSchema: approvalDecisionSchema,
        }),
      },
    });
  }

  /** Validates the client response and resumes the exact command that requested approval. */
  private async resumeModernApproval(
    input: ExecuteCommandInput,
    context: McpContext,
    signedState: string,
  ) {
    const state = this.verifyApprovalState(signedState);
    if (
      state.clientId !== input.clientId ||
      state.inputDigest !== this.createInputDigest(input) ||
      Date.now() >= state.expiresAt
    ) {
      throw new BadRequestException(
        'Approval state is invalid, expired, or does not match this command',
      );
    }

    const request = await this.approvals.getRequest(state.requestId);
    if (!request || request.clientId !== input.clientId) {
      throw new BadRequestException('Approval request is no longer available');
    }

    const response = inputResponse(
      context.server.mcpReq.inputResponses,
      'approval',
    );

    // Re-issue the prompt when the client did not return a usable response.
    if (response.kind !== 'elicit') {
      return this.requestModernApproval(
        input,
        state.requestId,
        state.expiresAt,
      );
    }

    if (response.action !== 'accept') {
      await this.approvals.decide(state.requestId, 'rejected');
      return {
        status: 'rejected',
        approvalRequestId: state.requestId,
        message: 'The user declined or cancelled this terminal operation.',
      };
    }

    const decision = acceptedContent(
      context.server.mcpReq.inputResponses,
      'approval',
      approvalDecisionSchema,
    );
    if (!decision) {
      return this.requestModernApproval(
        input,
        state.requestId,
        state.expiresAt,
      );
    }

    await this.approvals.decide(
      state.requestId,
      decision.decision === 'approve' ? 'approved' : 'rejected',
    );

    if (decision.decision === 'reject') {
      return {
        status: 'rejected',
        approvalRequestId: state.requestId,
        message: 'The user rejected this terminal operation.',
      };
    }

    // TerminalService re-checks the approved request and its command fingerprint before spawning.
    return this.terminal.execute({
      ...input,
      approvalRequestId: state.requestId,
    });
  }

  /** Uses the legacy server-to-client elicitation request for 2025-era clients. */
  private async requestLegacyApproval(
    input: ExecuteCommandInput,
    context: McpContext,
    requestId: string,
  ) {
    const response = await context.server.mcpReq.elicitInput({
      message: this.createApprovalMessage(input),
      requestedSchema: {
        type: 'object',
        properties: {
          decision: {
            type: 'string',
            enum: ['approve', 'reject'],
            description: 'The human user’s decision for this operation.',
          },
        },
        required: ['decision'],
      },
    });

    if (response.action !== 'accept') {
      await this.approvals.decide(requestId, 'rejected');
      return {
        status: 'rejected',
        approvalRequestId: requestId,
        message: 'The user declined or cancelled this terminal operation.',
      };
    }

    const parsed = approvalDecisionSchema.safeParse(response.content);
    if (!parsed.success) {
      throw new BadRequestException(
        'The MCP client returned an invalid approval decision',
      );
    }

    await this.approvals.decide(
      requestId,
      parsed.data.decision === 'approve' ? 'approved' : 'rejected',
    );

    if (parsed.data.decision === 'reject') {
      return {
        status: 'rejected',
        approvalRequestId: requestId,
        message: 'The user rejected this terminal operation.',
      };
    }

    return this.terminal.execute({
      ...input,
      approvalRequestId: requestId,
    });
  }

  /** Creates a clear approval prompt containing the exact command and its execution directory. */
  private createApprovalMessage(input: ExecuteCommandInput): string {
    const args = input.args
      .map((argument) => JSON.stringify(argument))
      .join(' ');
    return [
      'Projectron is requesting permission to execute this local program.',
      `Command: ${input.command} ${args}`.trim(),
      `Working directory: ${input.workingDirectory ?? '(configured workspace root)'}`,
      `Timeout: ${input.timeoutMs} ms`,
      'Choose approve to run this exact operation, or reject to cancel it.',
    ].join('\n');
  }

  /** Hashes all execution inputs so an approval cannot be replayed for altered arguments. */
  private createInputDigest(input: ExecuteCommandInput): string {
    return createHmac('sha256', approvalStateSecret)
      .update(
        JSON.stringify({
          command: input.command,
          args: input.args,
          workingDirectory: input.workingDirectory,
          timeoutMs: input.timeoutMs,
          clientId: input.clientId,
        }),
      )
      .digest('hex');
  }

  /** Signs opaque state that the modern MCP client must echo on the next tool round-trip. */
  private signApprovalState(state: ApprovalState): string {
    const payload = Buffer.from(JSON.stringify(state)).toString('base64url');
    const signature = createHmac('sha256', approvalStateSecret)
      .update(payload)
      .digest('base64url');
    return `${payload}.${signature}`;
  }

  /** Verifies the state signature before trusting any approval identifier from the client. */
  private verifyApprovalState(token: string): ApprovalState {
    const [payload, signature, extra] = token.split('.');
    if (!payload || !signature || extra !== undefined) {
      throw new BadRequestException('Malformed terminal approval state');
    }

    const expected = createHmac('sha256', approvalStateSecret)
      .update(payload)
      .digest();
    const supplied = Buffer.from(signature, 'base64url');
    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    ) {
      throw new BadRequestException(
        'Terminal approval state signature is invalid',
      );
    }

    try {
      const state = JSON.parse(
        Buffer.from(payload, 'base64url').toString('utf8'),
      ) as ApprovalState;
      if (
        typeof state.requestId !== 'string' ||
        typeof state.clientId !== 'string' ||
        typeof state.inputDigest !== 'string' ||
        typeof state.expiresAt !== 'number'
      ) {
        throw new Error('Invalid approval state fields');
      }
      return state;
    } catch {
      throw new BadRequestException('Terminal approval state is invalid');
    }
  }
}
