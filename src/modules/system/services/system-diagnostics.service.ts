import { Injectable } from '@nestjs/common';
import { SystemMetricsService } from './system-metrics.service.js';
import { SystemProcessService } from './system-process.service.js';

/** Produces actionable, read-only performance findings from system samples. */
@Injectable()
export class SystemDiagnosticsService {
  /** Creates the service and initializes its dependencies. */
  constructor(
    private readonly metricsService: SystemMetricsService,
    private readonly processes: SystemProcessService,
  ) {}

  /** Combines host metrics and process samples into actionable findings. */
  async diagnose() {
    const metrics = await this.metricsService.getMetrics();
    let topProcesses: Awaited<
      ReturnType<SystemProcessService['getTopProcesses']>
    > = [];
    let processMonitoring: 'available' | 'unsupported' = 'available';

    try {
      topProcesses = await this.processes.getTopProcesses(10);
    } catch {
      processMonitoring = 'unsupported';
    }

    const findings: string[] = [];
    if (metrics.cpu.usagePercent >= 85)
      findings.push('High overall CPU utilization');
    if (metrics.memory.usagePercent >= 85) {
      findings.push(
        'High memory utilization; memory pressure may slow applications',
      );
    }
    if (topProcesses[0]?.cpuUsagePercent >= 50) {
      findings.push('A single process is consuming a large share of CPU');
    }
    if (topProcesses[0]?.memoryUsagePercent >= 20) {
      findings.push(
        'A process is using a significant share of physical memory',
      );
    }
    if (findings.length === 0) {
      findings.push(
        'No major CPU or memory bottleneck detected in this sample',
      );
    }

    return {
      sampledAt: metrics.sampledAt,
      metrics,
      processMonitoring,
      topProcesses,
      findings,
      limitations: [
        'A short sample is indicative, not proof of root cause.',
        'Disk I/O rates are short-window estimates; stacked or device-mapper devices can overlap.',
        'Temperature readings depend on kernel sensor drivers and may be unavailable.',
        'GPU utilization and thermal-throttling state are not currently collected.',
        'Process-level live metrics require Linux /proc.',
      ],
    };
  }
}
