import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { TerminalService } from './terminal.service.js';
import type { AppConfigService } from '../../../config/config.service.js';
import type { ApprovalService } from '../../approval/services/approval.service.js';

// Uses a minimal validated-config substitute so service policy can be tested in isolation.
function createService(approvalRequired = false) {
  const config = {
    filesystemAllowedRoots: process.cwd(),
    approvalRequired,
  } as unknown as AppConfigService;
  const createRequest = vi.fn(async () => ({
      id: '00000000-0000-4000-8000-000000000001',
      clientId: 'test-client',
      action: '',
      reason: '',
      createdAt: Date.now(),
      expiresAt: Date.now() + 60_000,
      status: 'pending',
    }));
  const approvals = {
    createRequest,
    getRequest: vi.fn(async () => undefined),
  } as unknown as ApprovalService;
  return { service: new TerminalService(config, approvals), createRequest };
}

describe('TerminalService', () => {
  it('rejects shell and interpreter executables', async () => {
    const { service } = createService();
    await expect(
      service.execute({
        command: 'bash',
        args: ['-c', 'echo unsafe'],
        clientId: 'test-client',
        timeoutMs: 1000,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks protected environment file arguments', async () => {
    const { service } = createService();
    await expect(
      service.execute({
        command: 'cat',
        args: ['.env.production'],
        clientId: 'test-client',
        timeoutMs: 1000,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks protected environment paths embedded in option values', async () => {
    const { service } = createService();
    await expect(
      service.execute({
        command: 'tool',
        args: ['--env-file=.env.production'],
        clientId: 'test-client',
        timeoutMs: 1000,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires approval before starting a command', async () => {
    const { service, createRequest } = createService(true);
    await expect(
      service.execute({
        command: 'echo',
        args: ['hello'],
        clientId: 'test-client',
        timeoutMs: 1000,
      }),
    ).rejects.toThrow();
    expect(createRequest).toHaveBeenCalledOnce();
  });

  it('stops a process when its execution timeout is reached', async () => {
    const { service } = createService();
    const result = await service.execute({
      command: 'sleep',
      args: ['1'],
      clientId: 'test-client',
      timeoutMs: 100,
    });
    expect(result.timedOut).toBe(true);
    expect(result.signal).toBe('SIGKILL');
  });

  it('runs an executable and captures its output', async () => {
    const { service } = createService();
    const result = await service.execute({
      command: 'echo',
      args: ['projectron-terminal-test'],
      clientId: 'test-client',
      timeoutMs: 2000,
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('projectron-terminal-test');
    expect(result.timedOut).toBe(false);
  });
});