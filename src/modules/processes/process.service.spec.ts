import { describe, expect, it, vi } from 'vitest';
import { ProcessService } from './process.service.js';

// Verifies that the process manager rejects unowned process identifiers safely.
describe('ProcessService', () => {
  const config = { filesystemAllowedRoots: '/tmp' } as never;

  it('does not expose unknown processes', () => {
    const service = new ProcessService(config);
    expect(() => service.get(999999)).toThrow('Managed process not found');
  });

  it('does not stop an unknown process', async () => {
    const service = new ProcessService(config);
    await expect(service.stop(999999)).rejects.toThrow(
      'Managed process not found',
    );
  });

  it('returns an empty managed process list initially', () => {
    const service = new ProcessService(config);
    expect(service.list()).toEqual([]);
  });
});
