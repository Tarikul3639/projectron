import { describe, expect, it } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { ProcessWorkspaceService } from './process-workspace.service.js';
describe('ProcessWorkspaceService', () => {
  const service = new ProcessWorkspaceService({
    filesystemAllowedRoots: '/tmp',
  } as never);
  it('resolves an allowed directory', async () => {
    expect(await service.resolveWorkingDirectory('/tmp')).toBe('/tmp');
  });
  it('rejects a directory outside configured roots', async () => {
    await expect(
      service.resolveWorkingDirectory('/etc'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
