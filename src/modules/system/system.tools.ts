import { Injectable } from '@nestjs/common';
import { Tool } from '@nestjs/mcp';
import * as z from 'zod';
import { SystemInfoService } from './services/system-info.service.js';
import { SystemMetricsService } from './services/system-metrics.service.js';
import { SystemHardwareService } from './services/system-hardware.service.js';
import { SystemProcessService } from './services/system-process.service.js';
import { SystemDiagnosticsService } from './services/system-diagnostics.service.js';

/** Exposes read-only system diagnostics through Projectron MCP tools. */
@Injectable()
export class SystemTools {
  constructor(
    private readonly infoService: SystemInfoService,
    private readonly metricsService: SystemMetricsService,
    private readonly hardwareService: SystemHardwareService,
    private readonly processService: SystemProcessService,
    private readonly diagnosticsService: SystemDiagnosticsService,
  ) {}

  /** Returns operating-system, hardware, runtime, and uptime information. */
  @Tool({
    name: 'system_info',
    description:
      'Get operating system, hardware summary, Node.js version, and uptime.',
    inputSchema: z.object({}).strict(),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  info() {
    return this.infoService.getInfo();
  }

  /** Returns a fresh sample of overall CPU and memory metrics. */
  @Tool({
    name: 'system_metrics',
    description:
      'Sample overall CPU, memory, load average, and uptime metrics.',
    inputSchema: z.object({}).strict(),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  metrics() {
    return this.metricsService.getMetrics();
  }

  /** Returns sampled read/write throughput and counters for block devices. */
  @Tool({
    name: 'system_disk_io',
    description:
      'Sample Linux block-device read/write throughput and cumulative byte counters. Read-only; reports unsupported when procfs is unavailable.',
    inputSchema: z.object({}).strict(),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  diskIO() {
    return this.hardwareService.getDiskIO();
  }

  /** Returns temperatures exposed by Linux thermal and hardware-monitoring drivers. */
  @Tool({
    name: 'system_temperatures',
    description:
      'Read CPU, board, and other temperatures exposed by Linux thermal sysfs and hwmon drivers. Sensors may be unavailable on some systems.',
    inputSchema: z.object({}).strict(),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  temperatures() {
    return this.hardwareService.getTemperatures();
  }

  /** Lists processes ranked by CPU utilization; available on Linux. */
  @Tool({
    name: 'system_top_processes',
    description:
      'On Linux, sample and rank the top processes by CPU usage and report their memory use. This is read-only.',
    inputSchema: z
      .object({
        limit: z.number().int().min(1).max(25).default(10),
      })
      .strict(),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  topProcesses(input: { limit: number }) {
    return this.processService.getTopProcesses(input.limit);
  }

  /** Explains likely CPU or memory bottlenecks without changing system state. */
  @Tool({
    name: 'system_diagnose_performance',
    description:
      'Analyze CPU and memory pressure and identify likely top process bottlenecks. Read-only; does not terminate processes.',
    inputSchema: z.object({}).strict(),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  diagnose() {
    return this.diagnosticsService.diagnose();
  }
}
