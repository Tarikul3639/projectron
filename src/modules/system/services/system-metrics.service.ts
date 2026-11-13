import { Injectable } from '@nestjs/common';
import * as os from 'node:os';
import { SystemHardwareService } from './system-hardware.service.js';

/** Sampling interval used to estimate aggregate CPU utilization. */
const CPU_SAMPLE_MS = 250;

/** Samples host CPU, memory, load, disk I/O, and temperature metrics. */
@Injectable()
export class SystemMetricsService {
  /** Creates the service and initializes its dependencies. */
  constructor(private readonly hardware: SystemHardwareService) {}

  /** Samples overall CPU, memory, load average, and uptime metrics. */
  async getMetrics() {
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const load = os.loadavg();
    const [cpuUsagePercent, diskIO, temperatures] = await Promise.all([
      this.sampleCpuUsage(),
      this.hardware.getDiskIO(),
      this.hardware.getTemperatures(),
    ]);

    return {
      cpu: {
        usagePercent: cpuUsagePercent,
        cores: cpus.length,
        loadAverage: {
          '1m': load[0],
          '5m': load[1],
          '15m': load[2],
        },
      },
      memory: {
        totalBytes: totalMemory,
        usedBytes: totalMemory - freeMemory,
        freeBytes: freeMemory,
        usagePercent: this.percent(totalMemory - freeMemory, totalMemory),
      },
      diskIO,
      temperatures,
      uptimeSeconds: os.uptime(),
      sampledAt: new Date().toISOString(),
    };
  }
  /** Calculates CPU utilization from two snapshots of cumulative CPU times. */
  private async sampleCpuUsage(): Promise<number> {
    const first = this.cpuTimes();

    await new Promise((resolve) => setTimeout(resolve, CPU_SAMPLE_MS));

    const second = this.cpuTimes();
    const total = second.total - first.total;
    const idle = second.idle - first.idle;

    return total > 0 ? Number((100 * (1 - idle / total)).toFixed(2)) : 0;
  }

  /** Aggregates CPU time counters across all logical CPU cores. */
  private cpuTimes() {
    const values = os.cpus().reduce(
      (acc, cpu) => {
        for (const [key, value] of Object.entries(cpu.times)) {
          acc[key as keyof typeof acc] += value;
        }

        return acc;
      },
      { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 },
    );

    return {
      total: values.user + values.nice + values.sys + values.idle + values.irq,
      idle: values.idle,
    };
  }
  /** Converts a part/whole pair into a percentage while handling zero totals. */
  private percent(part: number, whole: number) {
    return whole > 0 ? Number(((part / whole) * 100).toFixed(2)) : 0;
  }
}
