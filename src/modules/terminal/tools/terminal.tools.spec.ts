import { ConflictException } from '@nestjs/common';
import type { McpContext } from '@nestjs/mcp';
import { describe, expect, it, vi } from 'vitest';
import { ApprovalService } from '../../approval/services/approval.service.js';
import { TerminalService } from '../services/terminal.service.js';
import { TerminalTools } from './terminal.tools.js';

// Provides the MCP context fields used by the modern multi-round-trip flow.
function createModernContext(
  requestState?: string,
  inputResponses?: Record<string, unknown>,
) {
  return {
    era: 'modern',
    server: {
      mcpReq: {
        requestState: () => requestState,
        inputResponses,
      },
    },
  } as unknown as McpContext;
}

// Verifies MCP terminal tool behavior without spawning real local processes.
describe('TerminalTools', () => {
  it('delegates an execution request to TerminalService', async () => {
    const execute = vi.fn().mockResolvedValue({ exitCode: 0, stdout: 'ok' });
    const approvals = { getRequest: vi.fn() };
    const tools = new TerminalTools(
      { execute } as unknown as TerminalService,
      approvals as unknown as ApprovalService,
    );
    const input = {
      command: 'echo',
      args: ['ok'],
      clientId: 'test-client',
      timeoutMs: 1000,
    };

    await expect(tools.execute(input, createModernContext())).resolves.toEqual({
      exitCode: 0,
      stdout: 'ok',
    });
    expect(execute).toHaveBeenCalledWith(input);
  });

  it('asks the MCP client for native approval when execution is pending', async () => {
    const requestId = '00000000-0000-4000-8000-000000000001';
    const execute = vi.fn().mockRejectedValue(
      new ConflictException({
        message: 'Approval required',
        approvalRequestId: requestId,
      }),
    );
    const approvals = {
      getRequest: vi.fn(() => ({
        id: requestId,
        clientId: 'test-client',
        action: 'terminal.execute',
        reason: 'Execute echo',
        createdAt: Date.now(),
        expiresAt: Date.now() + 60_000,
        status: 'pending',
      })),
      decide: vi.fn(),
    };
    const tools = new TerminalTools(
      { execute } as unknown as TerminalService,
      approvals as unknown as ApprovalService,
    );

    const result = await tools.execute(
      {
        command: 'echo',
        args: ['approved'],
        clientId: 'test-client',
        timeoutMs: 1000,
      },
      createModernContext(),
    );

    expect(result).toHaveProperty('inputRequests.approval');
    expect(result).toHaveProperty('requestState');
    expect(approvals.getRequest).toHaveBeenCalledWith(requestId);
    expect(execute).toHaveBeenCalledOnce();
  });

  it('executes only after the modern client returns an explicit approval', async () => {
    const requestId = '00000000-0000-4000-8000-000000000001';
    const pendingRequest = {
      id: requestId,
      clientId: 'test-client',
      action: 'terminal.execute',
      reason: 'Execute echo',
      createdAt: Date.now(),
      expiresAt: Date.now() + 60_000,
      status: 'pending',
    };
    const execute = vi
      .fn()
      .mockRejectedValueOnce(
        new ConflictException({
          message: 'Approval required',
          approvalRequestId: requestId,
        }),
      )
      .mockResolvedValueOnce({ exitCode: 0, stdout: 'approved' });
    const approvals = {
      getRequest: vi.fn(() => pendingRequest),
      decide: vi.fn(),
    };
    const tools = new TerminalTools(
      { execute } as unknown as TerminalService,
      approvals as unknown as ApprovalService,
    );
    const input = {
      command: 'echo',
      args: ['approved'],
      clientId: 'test-client',
      timeoutMs: 1000,
    };

    const prompt = (await tools.execute(input, createModernContext())) as {
      requestState: string;
    };
    const result = await tools.execute(
      input,
      createModernContext(prompt.requestState, {
        approval: {
          action: 'accept',
          content: { decision: 'approve' },
        },
      }),
    );

    expect(result).toEqual({ exitCode: 0, stdout: 'approved' });
    expect(approvals.decide).toHaveBeenCalledWith(requestId, 'approved');
    expect(execute).toHaveBeenLastCalledWith({
      ...input,
      approvalRequestId: requestId,
    });
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('does not execute when the user rejects the native approval prompt', async () => {
    const requestId = '00000000-0000-4000-8000-000000000001';
    const execute = vi.fn().mockRejectedValue(
      new ConflictException({
        message: 'Approval required',
        approvalRequestId: requestId,
      }),
    );
    const approvals = {
      getRequest: vi.fn(() => ({
        id: requestId,
        clientId: 'test-client',
        action: 'terminal.execute',
        reason: 'Execute echo',
        createdAt: Date.now(),
        expiresAt: Date.now() + 60_000,
        status: 'pending',
      })),
      decide: vi.fn(),
    };
    const tools = new TerminalTools(
      { execute } as unknown as TerminalService,
      approvals as unknown as ApprovalService,
    );
    const input = {
      command: 'echo',
      args: ['rejected'],
      clientId: 'test-client',
      timeoutMs: 1000,
    };
    const prompt = (await tools.execute(input, createModernContext())) as {
      requestState: string;
    };

    const result = await tools.execute(
      input,
      createModernContext(prompt.requestState, {
        approval: { action: 'accept', content: { decision: 'reject' } },
      }),
    );

    expect(result).toMatchObject({ status: 'rejected' });
    expect(approvals.decide).toHaveBeenCalledWith(requestId, 'rejected');
    expect(execute).toHaveBeenCalledOnce();
  });
});
