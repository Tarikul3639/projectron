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
import { ApprovalService } from '../security/approval.service.js';
import {
  processIdSchema,
  startProcessSchema,
  stopProcessSchema,
} from './processes.schemas.js';
import { ProcessService } from './process.service.js';
import type { StartProcessInput } from './processes.type.js';

const decisionSchema = z.object({ decision: z.enum(['approve', 'reject']) });
const stateSecret = randomBytes(32);

interface ProcessApprovalState {
  requestId: string;
  clientId: string;
  digest: string;
  operation: 'start' | 'stop';
  expiresAt: number;
}

/** Publishes process supervision tools and collects approval for process changes. */
@Injectable()
export class ProcessTools {
  constructor(
    private readonly processes: ProcessService,
    private readonly approvals: ApprovalService,
  ) {}

  @Tool({
    name: 'process_start',
    description:
      'Request user approval, then start a non-interactive executable in an allowed workspace. Returns its managed PID.',
    inputSchema: startProcessSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  })
  async start(input: StartProcessInput, context: McpContext) {
    return this.withApproval('start', input, context, async () =>
      this.processes.start(input),
    );
  }

  @Tool({
    name: 'process_list',
    description:
      'List processes started and managed by this Projectron instance; unrelated OS processes are not included.',
    inputSchema: z.object({}).strict(),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  list() {
    return this.processes.list();
  }

  @Tool({
    name: 'process_status',
    description: 'Get status and metadata for a process started by Projectron.',
    inputSchema: processIdSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  status(input: { pid: number }) {
    return this.processes.get(input.pid);
  }

  @Tool({
    name: 'process_logs',
    description:
      'Read captured stdout and stderr for a Projectron-managed process.',
    inputSchema: processIdSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  logs(input: { pid: number }) {
    return this.processes.getLogs(input.pid);
  }

  @Tool({
    name: 'process_stop',
    description:
      'Request user approval, then send SIGTERM to a process started by Projectron. Cannot stop unrelated processes or Projectron itself.',
    inputSchema: stopProcessSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  })
  async stop(input: { pid: number; clientId: string }, context: McpContext) {
    return this.withApproval('stop', input, context, async () =>
      this.processes.stop(input.pid),
    );
  }

  /** Uses native MCP elicitation so only an explicit user decision authorizes the operation. */
  private async withApproval<T>(
    operation: 'start' | 'stop',
    input: StartProcessInput | { pid: number; clientId: string },
    context: McpContext,
    execute: () => Promise<T>,
  ): Promise<T | object> {
    const digest = this.digest(operation, input);
    if (context.era === 'modern') {
      const signedState = context.server.mcpReq.requestState<string>();
      if (signedState) {
        const state = this.verifyState(signedState);
        if (
          state.operation !== operation ||
          state.clientId !== input.clientId ||
          state.digest !== digest ||
          Date.now() >= state.expiresAt
        ) {
          throw new BadRequestException(
            'Process approval state is invalid or expired',
          );
        }
        const response = inputResponse(
          context.server.mcpReq.inputResponses,
          'approval',
        );
        if (response.kind !== 'elicit') {
          return this.prompt(
            operation,
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
            operation,
            input,
            state.requestId,
            state.expiresAt,
          );
        await this.approvals.decide(
          state.requestId,
          decision.decision === 'approve' ? 'approved' : 'rejected',
        );
        if (decision.decision === 'reject')
          return { status: 'rejected', approvalRequestId: state.requestId };
        return execute();
      }
    }

    const request = await this.approvals.createRequest({
      clientId: input.clientId,
      action: `process.${operation}:${digest}`,
      reason:
        operation === 'start'
          ? `Start process: ${(input as StartProcessInput).command} ${(input as StartProcessInput).args.join(' ')}`
          : `Stop Projectron-managed process PID ${(input as { pid: number }).pid}`,
    });

    if (context.era === 'modern') {
      return this.prompt(operation, input, request.id, request.expiresAt);
    }

    const response = await context.server.mcpReq.elicitInput({
      message: this.message(operation, input),
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
      throw new BadRequestException('Invalid process approval response');
    await this.approvals.decide(
      request.id,
      decision.data.decision === 'approve' ? 'approved' : 'rejected',
    );
    if (decision.data.decision === 'reject')
      return { status: 'rejected', approvalRequestId: request.id };
    return execute();
  }

  /** Creates the modern multi-round-trip approval prompt with signed request state. */
  private prompt(
    operation: 'start' | 'stop',
    input: StartProcessInput | { pid: number; clientId: string },
    requestId: string,
    expiresAt: number,
  ) {
    const state: ProcessApprovalState = {
      requestId,
      clientId: input.clientId,
      digest: this.digest(operation, input),
      operation,
      expiresAt,
    };
    return inputRequired({
      requestState: this.signState(state),
      inputRequests: {
        approval: inputRequired.elicit({
          message: this.message(operation, input),
          requestedSchema: decisionSchema,
        }),
      },
    });
  }

  /** Describes the exact process operation presented to the human approver. */
  private message(
    operation: 'start' | 'stop',
    input: StartProcessInput | { pid: number; clientId: string },
  ) {
    if (operation === 'stop')
      return `Projectron requests permission to stop managed process PID ${(input as { pid: number }).pid}. Choose approve or reject.`;
    const start = input as StartProcessInput;
    return [
      'Projectron requests permission to start a local process.',
      `Command: ${start.command} ${start.args.join(' ')}`,
      `Working directory: ${start.workingDirectory}`,
      'Choose approve to start this process, or reject to cancel.',
    ].join('\\n');
  }

  /** Binds an approval to the exact operation and input parameters. */
  private digest(
    operation: 'start' | 'stop',
    input: StartProcessInput | { pid: number; clientId: string },
  ) {
    return createHmac('sha256', stateSecret)
      .update(JSON.stringify({ operation, ...input }))
      .digest('hex');
  }

  /** Signs approval state before returning it to an MCP client. */
  private signState(state: ProcessApprovalState): string {
    const payload = Buffer.from(JSON.stringify(state)).toString('base64url');
    const signature = createHmac('sha256', stateSecret)
      .update(payload)
      .digest('base64url');
    return `${payload}.${signature}`;
  }

  /** Verifies state integrity before accepting a decision from a later tool round-trip. */
  private verifyState(token: string): ProcessApprovalState {
    const [payload, signature, extra] = token.split('.');
    if (!payload || !signature || extra !== undefined)
      throw new BadRequestException('Malformed process approval state');
    const expected = createHmac('sha256', stateSecret).update(payload).digest();
    const supplied = Buffer.from(signature, 'base64url');
    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    ) {
      throw new BadRequestException(
        'Process approval state signature is invalid',
      );
    }
    try {
      const state = JSON.parse(
        Buffer.from(payload, 'base64url').toString('utf8'),
      ) as ProcessApprovalState;
      if (
        !state.requestId ||
        !state.clientId ||
        !state.digest ||
        !['start', 'stop'].includes(state.operation) ||
        typeof state.expiresAt !== 'number'
      )
        throw new Error();
      return state;
    } catch {
      throw new BadRequestException('Process approval state is invalid');
    }
  }
}
