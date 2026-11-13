import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ApprovalService } from '../../approval/services/approval.service.js';
import { TerminalService } from '../services/terminal.service.js';
import { TerminalTools } from './terminal.tools.js';

describe('TerminalTools', () => {
  it('delegates execution when the command is already authorized', async () => {
    const result = { exitCode: 0, stdout: 'ok' };
    const execute = vi.fn().mockResolvedValue(result);
    const tools = new TerminalTools(
      { execute } as unknown as TerminalService,
      {} as ApprovalService,
    );
    const input = {
      command: 'echo',
      args: ['ok'],
      clientId: 'test-client',
      timeoutMs: 1000,
    };

    await expect(tools.execute(input)).resolves.toEqual(result);
    expect(execute).toHaveBeenCalledWith(input);
  });

  it('returns the pending request without executing the command', async () => {
    const requestId = '00000000-0000-4000-8000-000000000001';
    const execute = vi.fn().mockRejectedValue(
      new ConflictException({
        message: 'Approval required',
        approvalRequestId: requestId,
      }),
    );
    const approvals = {
      getRequest: vi.fn().mockResolvedValue({
        id: requestId,
        clientId: 'test-client',
        action: 'terminal.execute:abc',
        reason: 'Execute echo',
        expiresAt: 123456,
        status: 'pending',
      }),
    };
    const tools = new TerminalTools(
      { execute } as unknown as TerminalService,
      approvals as unknown as ApprovalService,
    );

    await expect(
      tools.execute({
        command: 'echo',
        args: ['hello'],
        clientId: 'test-client',
        timeoutMs: 1000,
      }),
    ).resolves.toMatchObject({
      status: 'approval_required',
      approvalRequestId: requestId,
      expiresAt: 123456,
    });

    expect(execute).toHaveBeenCalledOnce();
  });

  it('does not expose a request belonging to another client', async () => {
    const requestId = '00000000-0000-4000-8000-000000000001';
    const execute = vi
      .fn()
      .mockRejectedValue(
        new ConflictException({ approvalRequestId: requestId }),
      );
    const approvals = {
      getRequest: vi.fn().mockResolvedValue({
        id: requestId,
        clientId: 'different-client',
      }),
    };
    const tools = new TerminalTools(
      { execute } as unknown as TerminalService,
      approvals as unknown as ApprovalService,
    );

    await expect(
      tools.execute({
        command: 'echo',
        args: [],
        clientId: 'test-client',
        timeoutMs: 1000,
      }),
    ).rejects.toThrow(ConflictException);
  });
});
