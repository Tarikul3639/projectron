import { describe, expect, it, vi } from 'vitest';
import { SystemTools } from './system.tools.js';

describe('SystemTools', () => {
  it('delegates each read-only tool to its focused service', async () => {
    const info = { getInfo: vi.fn().mockReturnValue({ platform: 'linux' }) };
    const metrics = {
      getMetrics: vi.fn().mockResolvedValue({ cpu: { usagePercent: 10 } }),
    };
    const hardware = {
      getDiskIO: vi
        .fn()
        .mockResolvedValue({ status: 'available', devices: [] }),
      getTemperatures: vi
        .fn()
        .mockResolvedValue({ status: 'unavailable', sensors: [] }),
    };
    const processes = {
      getTopProcesses: vi.fn().mockResolvedValue([{ pid: 1 }]),
    };
    const diagnostics = {
      diagnose: vi.fn().mockResolvedValue({ findings: [] }),
    };
    const tools = new SystemTools(
      info as never,
      metrics as never,
      hardware as never,
      processes as never,
      diagnostics as never,
    );

    expect(tools.info()).toEqual({ platform: 'linux' });
    await expect(tools.diskIO()).resolves.toEqual({
      status: 'available',
      devices: [],
    });
    await expect(tools.temperatures()).resolves.toEqual({
      status: 'unavailable',
      sensors: [],
    });
    await expect(tools.metrics()).resolves.toEqual({
      cpu: { usagePercent: 10 },
    });
    await expect(tools.topProcesses({ limit: 5 })).resolves.toEqual([
      { pid: 1 },
    ]);
    await expect(tools.diagnose()).resolves.toEqual({ findings: [] });

    expect(info.getInfo).toHaveBeenCalledOnce();
    expect(metrics.getMetrics).toHaveBeenCalledOnce();
    expect(hardware.getDiskIO).toHaveBeenCalledOnce();
    expect(hardware.getTemperatures).toHaveBeenCalledOnce();
    expect(processes.getTopProcesses).toHaveBeenCalledWith(5);
    expect(diagnostics.diagnose).toHaveBeenCalledOnce();
  });
});
