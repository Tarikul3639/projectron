import { describe, expect, it, vi } from 'vitest';
import { LogRotationService } from './log-rotation.service.js';

describe('LogRotationService', () => {
  it('delegates rotation with the supplied reason', async () => {
    const logs = {
      archiveActive: vi.fn().mockResolvedValue({ archived: true }),
    };
    const service = new LogRotationService(logs as never);
    await expect(service.rotate('scheduled')).resolves.toEqual({
      archived: true,
    });
    expect(logs.archiveActive).toHaveBeenCalledWith('scheduled');
  });
});
