import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ApprovalTools } from './approval.tools.js';
import { ApprovalService } from '../services/approval.service.js';

describe('ApprovalTools', () => {
  it('lists pending requests for the supplied client', async () => {
    const requests = [{ id: 'request-1', status: 'pending' }];
    const approvals = {
      listPending: vi.fn().mockResolvedValue(requests),
    };
    const tools = new ApprovalTools(approvals as unknown as ApprovalService);

    await expect(tools.listPending({ clientId: 'client-a' })).resolves.toEqual(
      requests,
    );
    expect(approvals.listPending).toHaveBeenCalledWith('client-a');
  });

  it('records an explicit approval without executing the operation', async () => {
    const request = {
      id: '00000000-0000-4000-8000-000000000001',
      status: 'approved',
      decidedAt: 123,
    };
    const approvals = {
      decideForClient: vi.fn().mockResolvedValue(request),
    };
    const tools = new ApprovalTools(approvals as unknown as ApprovalService);

    await expect(
      tools.decide({
        approvalRequestId: request.id,
        clientId: 'client-a',
        decision: 'approve',
      }),
    ).resolves.toMatchObject({
      status: 'approved',
      approvalRequestId: request.id,
      message: expect.stringContaining('NOT been executed'),
    });
    expect(approvals.decideForClient).toHaveBeenCalledWith(
      request.id,
      'client-a',
      'approved',
    );
  });

  it('rejects attempts to decide another client request', async () => {
    const approvals = {
      decideForClient: vi.fn().mockRejectedValue(new NotFoundException()),
    };
    const tools = new ApprovalTools(approvals as unknown as ApprovalService);

    await expect(
      tools.decide({
        approvalRequestId: '00000000-0000-4000-8000-000000000001',
        clientId: 'client-a',
        decision: 'approve',
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
