import { describe, expect, it } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { ProcessExecutionService } from './process-execution.service.js';
import { ProcessRegistryService } from './process-registry.service.js';
describe('ProcessExecutionService', () => {
  const workspace = { resolveWorkingDirectory: async () => '/tmp' } as never;
  const service = new ProcessExecutionService(
    workspace,
    new ProcessRegistryService(),
  );
  it('rejects shell and interpreter executables', async () => {
    await expect(
      service.start({
        command: 'bash',
        args: [],
        workingDirectory: '/tmp',
        clientId: 'test',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('rejects shell metacharacters in executable names', async () => {
    await expect(
      service.start({
        command: 'echo;id',
        args: [],
        workingDirectory: '/tmp',
        clientId: 'test',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
