import { Injectable } from '@nestjs/common';
import { readFile, readdir } from 'node:fs/promises';
import * as os from 'node:os';

/** Linux sysfs locations for thermal and block-device telemetry. */
const DISK_SAMPLE_MS = 300;
const SYS_BLOCK = '/sys/class/block';
const SYS_THERMAL = '/sys/class/thermal';
const SYS_HWMON = '/sys/class/hwmon';

/** Collects read-only disk I/O and hardware temperature telemetry. */
@Injectable()
export class SystemHardwareService {
  /**
   * Samples Linux block-device counters and calculates read/write throughput.
   * Linux reports sectors in 512-byte units in /proc/diskstats.
   */
  async getDiskIO() {
    if (os.platform() !== 'linux') {
      return {
        status: 'unsupported' as const,
        devices: [],
        message: 'Disk I/O telemetry currently requires Linux /proc/diskstats',
      };
    }

    const before = await this.readDiskCounters();
    const startedAt = Date.now();
    await new Promise((resolve) => setTimeout(resolve, DISK_SAMPLE_MS));
    const after = await this.readDiskCounters();
    const elapsedSeconds = Math.max(1, Date.now() - startedAt) / 1000;
    const devices = [...after.values()]
      .map((item) => {
        const previous = before.get(item.name);
        const readBytesDelta = previous
          ? Math.max(0, item.readSectors - previous.readSectors) * 512
          : 0;
        const writeBytesDelta = previous
          ? Math.max(0, item.writeSectors - previous.writeSectors) * 512
          : 0;

        return {
          device: item.name,
          readBytesPerSecond: Math.round(readBytesDelta / elapsedSeconds),
          writeBytesPerSecond: Math.round(writeBytesDelta / elapsedSeconds),
          readBytes: item.readSectors * 512,
          writtenBytes: item.writeSectors * 512,
        };
      })
      .sort(
        (a, b) =>
          b.readBytesPerSecond +
          b.writeBytesPerSecond -
          (a.readBytesPerSecond + a.writeBytesPerSecond),
      );

    return {
      status:
        devices.length > 0 ? ('available' as const) : ('unavailable' as const),
      intervalMs: Math.round(elapsedSeconds * 1000),
      devices,
      totalReadBytesPerSecond: devices.reduce(
        (sum, item) => sum + item.readBytesPerSecond,
        0,
      ),
      totalWriteBytesPerSecond: devices.reduce(
        (sum, item) => sum + item.writeBytesPerSecond,
        0,
      ),
      note: 'Rates are sampled estimates. Device-mapper and underlying devices may represent overlapping I/O.',
    };
  }

  /**
   * Reads available thermal sensors from Linux thermal zones and hwmon.
   * Values are exposed only when the kernel makes them readable.
   */
  async getTemperatures() {
    if (os.platform() !== 'linux') {
      return {
        status: 'unsupported' as const,
        sensors: [],
        message: 'Temperature telemetry currently requires Linux thermal sysfs',
      };
    }

    const sensors: Array<{
      sensor: string;
      label: string;
      temperatureCelsius: number;
      source: 'thermal-zone' | 'hwmon';
    }> = [];

    try {
      const zones = await readdir(SYS_THERMAL, { withFileTypes: true });
      for (const zone of zones.filter(
        (entry) => entry.isDirectory() && /^thermal_zone\d+$/.test(entry.name),
      )) {
        try {
          const base = `${SYS_THERMAL}/${zone.name}`;
          const [raw, type] = await Promise.all([
            readFile(`${base}/temp`, 'utf8'),
            readFile(`${base}/type`, 'utf8').catch(() => zone.name),
          ]);
          const temperatureCelsius = Number(raw.trim()) / 1000;
          if (Number.isFinite(temperatureCelsius)) {
            sensors.push({
              sensor: zone.name,
              label: type.trim(),
              temperatureCelsius: Number(temperatureCelsius.toFixed(1)),
              source: 'thermal-zone',
            });
          }
        } catch {
          // Individual thermal zones may disappear or be unreadable.
        }
      }
    } catch {
      // Thermal zones are optional on Linux.
    }

    try {
      const controllers = await readdir(SYS_HWMON, { withFileTypes: true });
      for (const controller of controllers.filter((entry) =>
        entry.isDirectory(),
      )) {
        const base = `${SYS_HWMON}/${controller.name}`;
        const chipName = await readFile(`${base}/name`, 'utf8').catch(
          () => controller.name,
        );
        const files = await readdir(base).catch(() => []);
        const inputs = files.filter((file) => /^temp\d+_input$/.test(file));

        for (const input of inputs) {
          try {
            const index = input.match(/^temp(\d+)_input$/)?.[1] ?? '0';
            const [raw, label] = await Promise.all([
              readFile(`${base}/${input}`, 'utf8'),
              readFile(`${base}/temp${index}_label`, 'utf8').catch(
                () => `temperature ${index}`,
              ),
            ]);
            const temperatureCelsius = Number(raw.trim()) / 1000;
            if (
              Number.isFinite(temperatureCelsius) &&
              temperatureCelsius > -50 &&
              temperatureCelsius < 250
            ) {
              sensors.push({
                sensor: `${controller.name}/temp${index}`,
                label: `${chipName.trim()}: ${label.trim()}`,
                temperatureCelsius: Number(temperatureCelsius.toFixed(1)),
                source: 'hwmon',
              });
            }
          } catch {
            // Ignore sensors that cannot be read during sampling.
          }
        }
      }
    } catch {
      // Hardware monitoring is optional and driver-dependent.
    }

    return {
      status:
        sensors.length > 0 ? ('available' as const) : ('unavailable' as const),
      sensors,
      message:
        sensors.length > 0
          ? undefined
          : 'No readable temperature sensors were exposed by the kernel. This does not prove that hardware has no sensors.',
    };
  }

  /** Reads whole-device counters and skips partitions and pseudo block devices. */
  private async readDiskCounters() {
    const lines = (await readFile('/proc/diskstats', 'utf8'))
      .trim()
      .split('\n');
    const devices = new Map<
      string,
      { name: string; readSectors: number; writeSectors: number }
    >();

    await Promise.all(
      lines.map(async (line) => {
        const fields = line.trim().split(/\s+/);
        const name = fields[2];
        if (!name || /^(loop|ram|zram)\d+$/.test(name) || fields.length < 14) {
          return;
        }

        try {
          await readFile(`${SYS_BLOCK}/${name}/partition`, 'utf8');
          return;
        } catch {
          // No partition marker means this is a whole block device.
        }

        const readSectors = Number(fields[5]);
        const writeSectors = Number(fields[9]);
        if (Number.isFinite(readSectors) && Number.isFinite(writeSectors)) {
          devices.set(name, { name, readSectors, writeSectors });
        }
      }),
    );

    return devices;
  }
}
