import { describe, expect, it, vi } from 'vitest';
import {
  processIdSchema,
  startProcessSchema,
  stopProcessSchema,
} from '../schemas/processes.schemas.js';
import { ProcessExecutionService } from '../services/process-execution.service.js';
import { ProcessRegistryService } from '../services/process-registry.service.js';
import { ProcessTools } from './process.tools.js';

describe('ProcessTools', () => {
  it('validates process-management input contracts', () => {
    expect(
      startProcessSchema.safeParse({
        command: 'sleep',
        workingDirectory: '/tmp',
      }).success,
    ).toBe(true);
    expect(
      startProcessSchema.safeParse({ command: '', workingDirectory: '/tmp' })
        .success,
    ).toBe(false);
    expect(processIdSchema.safeParse({ pid: 12 }).success).toBe(true);
    expect(processIdSchema.safeParse({ pid: -1 }).success).toBe(false);
    expect(stopProcessSchema.safeParse({ pid: 12 }).success).toBe(true);
  });

  it('delegates process actions directly to execution and registry services', async () => {
    const execution = {
      start: vi.fn().mockResolvedValue({ pid: 123 }),
      stop: vi.fn().mockResolvedValue({ stopped: true }),
    };
    const registry = {
      list: vi.fn().mockReturnValue([{ pid: 12 }]),
      get: vi.fn().mockReturnValue({ pid: 12, status: 'running' }),
      getLogs: vi.fn().mockReturnValue({ stdout: 'ok', stderr: '' }),
    };
    const tools = new ProcessTools(
      execution as unknown as ProcessExecutionService,
      registry as unknown as ProcessRegistryService,
    );
    const startInput = {
      command: 'sleep',
      args: ['10'],
      workingDirectory: '/tmp',
    };

    await expect(tools.start(startInput)).resolves.toEqual({ pid: 123 });
    await expect(tools.stop({ pid: 123 })).resolves.toEqual({ stopped: true });
    expect(tools.list()).toEqual([{ pid: 12 }]);
    expect(tools.status({ pid: 12 })).toEqual({ pid: 12, status: 'running' });
    expect(tools.logs({ pid: 12 })).toEqual({ stdout: 'ok', stderr: '' });
    expect(execution.start).toHaveBeenCalledWith(startInput);
    expect(execution.stop).toHaveBeenCalledWith(123);
  });
});
