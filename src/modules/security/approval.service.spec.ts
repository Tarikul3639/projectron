import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ApprovalService } from './approval.service.js';

// Supplies an in-memory JSON store so approval persistence can be tested without disk I/O.
function createService() {
  let stored: unknown;
  const storage = {
    exists: vi.fn(async () => stored !== undefined),
    read: vi.fn(async () => stored),
    write: vi.fn(async (_path: string, value: unknown) => {
      stored = value;
    }),
  };
  const service = new ApprovalService(storage as never);
  return { service, storage, getStored: () => stored };
}

describe('ApprovalService', () => {
  it('creates and lists pending requests and persists them', async () => {
    const { service, storage, getStored } = createService();
    const request = await service.createRequest({
      clientId: 'client-a',
      action: 'filesystem.delete',
      reason: 'Remove generated file',
    });

    expect(request.status).toBe('pending');
    await expect(service.listPending('client-a')).resolves.toHaveLength(1);
    expect(storage.write).toHaveBeenCalledOnce();
    expect(getStored()).toEqual([request]);
  });

  it('restores requests from storage after service recreation', async () => {
    const first = createService();
    const request = await first.service.createRequest({
      clientId: 'client-a',
      action: 'terminal.execute',
      reason: 'Run a command',
    });

    const secondStorage = {
      exists: vi.fn(async () => true),
      read: vi.fn(async () => first.getStored()),
      write: vi.fn(),
    };
    const second = new ApprovalService(secondStorage as never);
    await second.onModuleInit();

    await expect(second.getRequest(request.id)).resolves.toMatchObject(request);
  });

  it('approves or rejects a request only once and persists the decision', async () => {
    const { service, storage } = createService();
    const approved = await service.createRequest({
      clientId: 'a',
      action: 'deploy',
      reason: 'Release',
    });
    expect((await service.decide(approved.id, 'approved')).status).toBe(
      'approved',
    );
    await expect(service.decide(approved.id, 'rejected')).rejects.toThrow(
      /already approved/,
    );

    const rejected = await service.createRequest({
      clientId: 'a',
      action: 'delete',
      reason: 'Cleanup',
    });
    expect((await service.decide(rejected.id, 'rejected')).status).toBe(
      'rejected',
    );
    expect(storage.write).toHaveBeenCalledTimes(4);
  });

  it('expires requests and rejects invalid TTL', async () => {
    const { service } = createService();
    const request = await service.createRequest({
      clientId: 'a',
      action: 'deploy',
      reason: 'Release',
      ttlMs: 1,
    });
    const stored = (
      service as unknown as { requests: Map<string, { expiresAt: number }> }
    ).requests;
    stored.get(request.id)!.expiresAt = Date.now() - 1;
    await expect(service.getRequest(request.id)).resolves.toMatchObject({
      status: 'expired',
    });
    await expect(
      service.createRequest({
        clientId: 'a',
        action: 'deploy',
        reason: 'Release',
        ttlMs: 0,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects incomplete requests and unknown IDs', async () => {
    const { service } = createService();
    await expect(
      service.createRequest({ clientId: '', action: 'x', reason: 'y' }),
    ).rejects.toThrow(BadRequestException);
    await expect(service.decide('missing', 'approved')).rejects.toThrow(
      /not found/,
    );
  });
});
