import { describe, expect, it } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { TerminalService } from './terminal.service.js';
import type { AppConfigService } from '../../../config/config.service.js';

function createService() {
  const config = {
    filesystemAllowedRoots: process.cwd(),
  } as unknown as AppConfigService;
  return new TerminalService(config);
}

describe('TerminalService', () => {
  it('rejects shell and interpreter executables', async () => {
    await expect(
      createService().execute({
        command: 'bash',
        args: ['-c', 'echo unsafe'],
        timeoutMs: 1000,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks protected environment file arguments', async () => {
    await expect(
      createService().execute({
        command: 'cat',
        args: ['.env.production'],
        timeoutMs: 1000,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks protected environment paths embedded in option values', async () => {
    await expect(
      createService().execute({
        command: 'tool',
        args: ['--env-file=.env.production'],
        timeoutMs: 1000,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('runs an executable and captures its output', async () => {
    const result = await createService().execute({
      command: 'echo',
      args: ['projectron-terminal-test'],
      timeoutMs: 2000,
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('projectron-terminal-test');
    expect(result.timedOut).toBe(false);
  });
});
