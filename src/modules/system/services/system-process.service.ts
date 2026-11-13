import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { readFile, readdir } from 'node:fs/promises';
import * as os from 'node:os';

interface ProcSample {
  pid: number;
  name: string;
  cpuTicks: number;
  memoryBytes: number;
  state: string;
}

/** Linux procfs location used for read-only process diagnostics. */
const PROC = '/proc';
/** Sampling interval used to estimate per-process CPU utilization. */
const CPU_TICK_MS = 500;

/** Collects read-only process-level performance metrics. */
@Injectable()
export class SystemProcessService {
  /**
   * Ranks Linux processes by CPU usage over a short sampling window.
   * Process memory is reported as resident set size (RSS).
   */
  async getTopProcesses(limit = 10) {
    if (os.platform() !== 'linux') {
      throw new ServiceUnavailableException(
        'Per-process live metrics are currently supported on Linux (/proc) only',
      );
    }

    const before = await this.readProcesses();
    const cpuBefore = await this.readCpuTotal();

    await new Promise((resolve) => setTimeout(resolve, CPU_TICK_MS));

    const after = await this.readProcesses();
    const cpuAfter = await this.readCpuTotal();
    const totalDelta = Math.max(1, cpuAfter - cpuBefore);
    const previous = new Map(before.map((item) => [item.pid, item]));

    return after
      .map((item) => {
        const old = previous.get(item.pid);
        const cpuDelta = old ? Math.max(0, item.cpuTicks - old.cpuTicks) : 0;

        return {
          pid: item.pid,
          name: item.name,
          state: item.state,
          cpuUsagePercent: Number(
            ((cpuDelta / totalDelta) * os.cpus().length * 100).toFixed(2),
          ),
          memoryBytes: item.memoryBytes,
          memoryUsagePercent: this.percent(item.memoryBytes, os.totalmem()),
        };
      })
      .sort((a, b) => b.cpuUsagePercent - a.cpuUsagePercent)
      .slice(0, limit);
  }
  /** Converts a part/whole pair into a percentage while handling zero totals. */
  private percent(part: number, whole: number) {
    return whole > 0 ? Number(((part / whole) * 100).toFixed(2)) : 0;
  }

  /** Reads aggregate CPU ticks from the Linux procfs stat file. */
  private async readCpuTotal(): Promise<number> {
    const line = (await readFile(`${PROC}/stat`, 'utf8')).split('\n')[0];
    const values = line.trim().split(/\s+/).slice(1).map(Number);

    return values.reduce((sum, value) => sum + value, 0);
  }

  /** Reads process state, CPU ticks, and resident memory from Linux procfs. */
  private async readProcesses(): Promise<ProcSample[]> {
    const entries = await readdir(PROC, { withFileTypes: true });
    const pids = entries
      .filter((entry) => entry.isDirectory() && /^\d+$/.test(entry.name))
      .map((entry) => Number(entry.name));

    const results = await Promise.all(
      pids.map(async (pid) => {
        try {
          const stat = await readFile(`${PROC}/${pid}/stat`, 'utf8');
          const close = stat.lastIndexOf(')');
          const name = stat.slice(stat.indexOf('(') + 1, close);
          const fields = stat
            .slice(close + 2)
            .trim()
            .split(/\s+/);
          const state = fields[0] ?? '?';
          const cpuTicks = Number(fields[11] ?? 0) + Number(fields[12] ?? 0);
          const rssPages = Number(fields[21] ?? 0);

          return {
            pid,
            name,
            state,
            cpuTicks,
            memoryBytes: Math.max(0, rssPages) * 4096,
          };
        } catch {
          // Processes may exit or become inaccessible while the snapshot is collected.
          return null;
        }
      }),
    );

    return results.filter((item): item is ProcSample => item !== null);
  }
}
