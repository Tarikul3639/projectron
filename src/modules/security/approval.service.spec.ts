import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { ApprovalService } from './approval.service.js';

describe('ApprovalService', () => {
  it('creates and lists pending requests', () => {
    const service = new ApprovalService();
    const request = service.createRequest({
      clientId: 'client-a',
      action: 'filesystem.delete',
      reason: 'Remove generated file',
    });

    expect(request.status).toBe('pending');
    expect(service.listPending('client-a')).toHaveLength(1);
  });

  it('approves or rejects a request only once', () => {
    const service = new ApprovalService();
    const approved = service.createRequest({
      clientId: 'a',
      action: 'deploy',
      reason: 'Release',
    });
    expect(service.decide(approved.id, 'approved').status).toBe('approved');
    expect(() => service.decide(approved.id, 'rejected')).toThrow(
      /already approved/,
    );

    const rejected = service.createRequest({
      clientId: 'a',
      action: 'delete',
      reason: 'Cleanup',
    });
    expect(service.decide(rejected.id, 'rejected').status).toBe('rejected');
  });

  it('expires requests and rejects invalid TTL', () => {
    const service = new ApprovalService();
    const request = service.createRequest({
      clientId: 'a',
      action: 'deploy',
      reason: 'Release',
      ttlMs: 1,
    });
    const stored = (
      service as unknown as { requests: Map<string, { expiresAt: number }> }
    ).requests;
    stored.get(request.id)!.expiresAt = Date.now() - 1;
    expect(service.getRequest(request.id)?.status).toBe('expired');
    expect(() =>
      service.createRequest({
        clientId: 'a',
        action: 'deploy',
        reason: 'Release',
        ttlMs: 0,
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects incomplete requests and unknown IDs', () => {
    const service = new ApprovalService();
    expect(() =>
      service.createRequest({ clientId: '', action: 'x', reason: 'y' }),
    ).toThrow(BadRequestException);
    expect(() => service.decide('missing', 'approved')).toThrow(/not found/);
  });
});
