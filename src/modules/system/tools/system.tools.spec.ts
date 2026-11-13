import { describe, expect, it, vi } from 'vitest';
import { SystemInfoService } from '../services/system-info.service.js';
import { SystemMetricsService } from '../services/system-metrics.service.js';
import { SystemHardwareService } from '../services/system-hardware.service.js';
import { SystemProcessService } from '../services/system-process.service.js';
import { SystemDiagnosticsService } from '../services/system-diagnostics.service.js';
import { SystemTools } from './system.tools.js';

describe('SystemTools', () => {
  it('delegates read-only tools to their focused services', async () => {
    const info = { getInfo: vi.fn().mockReturnValue({ platform: 'linux' }) };
    const metrics = {
      getMetrics: vi.fn().mockResolvedValue({ cpu: { usagePercent: 10 } }),
    };
    const hardware = {
      getDiskIO: vi
        .fn()
        .mockResolvedValue({ status: 'available', devices: [] }),
      getTemperatures: vi.fn().mockResolvedValue({
        status: 'unavailable',
        sensors: [],
      }),
    };
    const processes = {
      getTopProcesses: vi.fn().mockResolvedValue([{ pid: 1 }]),
    };
    const diagnostics = {
      diagnose: vi.fn().mockResolvedValue({ findings: [] }),
    };
    const tools = new SystemTools(
      info as unknown as SystemInfoService,
      metrics as unknown as SystemMetricsService,
      hardware as unknown as SystemHardwareService,
      processes as unknown as SystemProcessService,
      diagnostics as unknown as SystemDiagnosticsService,
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
