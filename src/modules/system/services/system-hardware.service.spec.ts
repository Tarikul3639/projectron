import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  readdir: vi.fn(),
}));
vi.mock('node:os', () => ({
  platform: vi.fn(),
}));

import { readFile, readdir } from 'node:fs/promises';
import * as os from 'node:os';
import { SystemHardwareService } from './system-hardware.service.js';

describe('SystemHardwareService.getTemperatures', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(os.platform).mockReturnValue('linux');
  });

  it('discovers thermal and hwmon sysfs symlinks', async () => {
    vi.mocked(readdir).mockImplementation(async (path) => {
      const location = String(path);
      if (location === '/sys/class/thermal') {
        return [
          {
            name: 'thermal_zone0',
            isDirectory: () => false,
            isSymbolicLink: () => true,
          },
        ] as never;
      }
      if (location === '/sys/class/hwmon') {
        return [
          {
            name: 'hwmon7',
            isDirectory: () => false,
            isSymbolicLink: () => true,
          },
        ] as never;
      }
      if (location === '/sys/class/hwmon/hwmon7') {
        return ['name', 'temp1_input', 'temp1_label'] as never;
      }
      throw new Error('Unexpected directory');
    });

    vi.mocked(readFile).mockImplementation(async (path) => {
      const location =
        typeof path === 'string'
          ? path
          : path instanceof URL
            ? path.pathname
            : Buffer.from(path).toString('utf8');
      const values: Record<string, string> = {
        '/sys/class/thermal/thermal_zone0/temp': '53000',
        '/sys/class/thermal/thermal_zone0/type': 'acpitz',
        '/sys/class/hwmon/hwmon7/name': 'coretemp',
        '/sys/class/hwmon/hwmon7/temp1_input': '52000',
        '/sys/class/hwmon/hwmon7/temp1_label': 'Package id 0',
      };
      if (location in values) return values[location] as never;
      throw new Error('Sensor file unavailable');
    });

    const result = await new SystemHardwareService().getTemperatures();

    expect(result.status).toBe('available');
    expect(result.sensors).toEqual(
      expect.arrayContaining([
        {
          sensor: 'thermal_zone0',
          label: 'acpitz',
          temperatureCelsius: 53,
          source: 'thermal-zone',
        },
        {
          sensor: 'hwmon7/temp1',
          label: 'coretemp: Package id 0',
          temperatureCelsius: 52,
          source: 'hwmon',
        },
      ]),
    );
  });

  it('reports unsupported outside Linux without probing sysfs', async () => {
    vi.mocked(os.platform).mockReturnValue('darwin');

    const result = await new SystemHardwareService().getTemperatures();

    expect(result.status).toBe('unsupported');
    expect(result.sensors).toEqual([]);
    expect(readdir).not.toHaveBeenCalled();
    expect(readFile).not.toHaveBeenCalled();
  });
});
