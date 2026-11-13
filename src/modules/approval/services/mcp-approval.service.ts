import { BadRequestException, Injectable } from '@nestjs/common';
import type { McpContext } from '@nestjs/mcp';
import {
  acceptedContent,
  inputRequired,
  inputResponse,
} from '@modelcontextprotocol/server';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import * as z from 'zod';
import { ApprovalService } from './approval.service.js';

const decisionSchema = z.object({ decision: z.enum(['approve', 'reject']) });
const stateSecret = randomBytes(32);

interface ApprovalState {
  scope: string;
  requestId: string;
  clientId: string;
  digest: string;
  expiresAt: number;
}

/** Centralizes MCP elicitation and binds approval to the exact operation input. */
@Injectable()
export class McpApprovalService {
  /** Creates the service and initializes its dependencies. */
  constructor(private readonly approvals: ApprovalService) {}

  /** Requests approval, resumes modern elicitation, or handles legacy clients. */
  async run<T>(
    scope: string,
    reason: string,
    input: { clientId: string },
    context: McpContext,
    execute: () => Promise<T>,
  ): Promise<T | object> {
    const digest = this.digest(input);

    if (context.era === 'modern') {
      const token = context.server.mcpReq.requestState<string>();
      if (token) {
        const state = this.verifyState(token);
        if (
          state.scope !== scope ||
          state.clientId !== input.clientId ||
          state.digest !== digest ||
          Date.now() >= state.expiresAt
        ) {
          throw new BadRequestException(
            'Approval state is invalid, expired, or does not match this operation',
          );
        }
        const response = inputResponse(
          context.server.mcpReq.inputResponses,
          'approval',
        );
        if (response.kind !== 'elicit') {
          return this.prompt(
            scope,
            reason,
            input,
            state.requestId,
            state.expiresAt,
          );
        }
        if (response.action !== 'accept') {
          await this.approvals.decide(state.requestId, 'rejected');
          return { status: 'rejected', approvalRequestId: state.requestId };
        }
        const decision = acceptedContent(
          context.server.mcpReq.inputResponses,
          'approval',
          decisionSchema,
        );
        if (!decision)
          return this.prompt(
            scope,
            reason,
            input,
            state.requestId,
            state.expiresAt,
          );
        await this.approvals.decide(
          state.requestId,
          decision.decision === 'approve' ? 'approved' : 'rejected',
        );
        if (decision.decision === 'reject') {
          return { status: 'rejected', approvalRequestId: state.requestId };
        }
        return execute();
      }
    }

    const request = await this.approvals.createRequest({
      clientId: input.clientId,
      action: scope + '.operation:' + digest,
      reason,
    });
    if (context.era === 'modern') {
      return this.prompt(scope, reason, input, request.id, request.expiresAt);
    }

    const response = await context.server.mcpReq.elicitInput({
      message: this.message(reason),
      requestedSchema: {
        type: 'object',
        properties: {
          decision: { type: 'string', enum: ['approve', 'reject'] },
        },
        required: ['decision'],
      },
    });
    if (response.action !== 'accept') {
      await this.approvals.decide(request.id, 'rejected');
      return { status: 'rejected', approvalRequestId: request.id };
    }
    const decision = decisionSchema.safeParse(response.content);
    if (!decision.success)
      throw new BadRequestException('Invalid approval response');
    await this.approvals.decide(
      request.id,
      decision.data.decision === 'approve' ? 'approved' : 'rejected',
    );
    if (decision.data.decision === 'reject') {
      return { status: 'rejected', approvalRequestId: request.id };
    }
    return execute();
  }

  /** Formats one consistent human-readable approval prompt. */
  private message(reason: string): string {
    return [
      'Projectron requests permission for this operation.',
      reason,
      'Choose approve or reject.',
    ].join('\n');
  }

  /** Creates a signed modern MCP prompt for the exact operation. */
  private prompt(
    scope: string,
    reason: string,
    input: { clientId: string },
    requestId: string,
    expiresAt: number,
  ) {
    const state: ApprovalState = {
      scope,
      requestId,
      clientId: input.clientId,
      digest: this.digest(input),
      expiresAt,
    };
    const payload = Buffer.from(JSON.stringify(state)).toString('base64url');
    const signature = createHmac('sha256', stateSecret)
      .update(payload)
      .digest('base64url');
    return inputRequired({
      requestState: payload + '.' + signature,
      inputRequests: {
        approval: inputRequired.elicit({
          message: this.message(reason),
          requestedSchema: decisionSchema,
        }),
      },
    });
  }

  /** Hashes all operation fields to prevent approval replay with altered arguments. */
  private digest(input: object): string {
    return createHmac('sha256', stateSecret)
      .update(JSON.stringify(input))
      .digest('hex');
  }

  /** Verifies the signature and required fields of returned approval state. */
  private verifyState(token: string): ApprovalState {
    const [payload, signature, extra] = token.split('.');
    if (!payload || !signature || extra !== undefined)
      throw new BadRequestException('Malformed approval state');
    const expected = createHmac('sha256', stateSecret).update(payload).digest();
    const supplied = Buffer.from(signature, 'base64url');
    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    ) {
      throw new BadRequestException('Approval state signature is invalid');
    }
    try {
      const state = JSON.parse(
        Buffer.from(payload, 'base64url').toString('utf8'),
      ) as ApprovalState;
      if (
        !state.scope ||
        !state.requestId ||
        !state.clientId ||
        !state.digest ||
        typeof state.expiresAt !== 'number'
      )
        throw new Error();
      return state;
    } catch {
      throw new BadRequestException('Approval state is invalid');
    }
  }
}
