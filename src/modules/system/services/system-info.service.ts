import { Injectable } from '@nestjs/common';
import * as os from 'node:os';

/** Provides stable host, hardware, runtime, and memory information. */
@Injectable()
export class SystemInfoService {
  /** Returns stable host, hardware, runtime, and memory information. */
  getInfo() {
    const cpus = os.cpus();

    return {
      platform: os.platform(),
      release: os.release(),
      architecture: os.arch(),
      hostname: os.hostname(),
      uptimeSeconds: os.uptime(),
      cpu: {
        model: cpus[0]?.model ?? 'unknown',
        cores: cpus.length,
        speedMHz: cpus[0]?.speed ?? 0,
      },
      memory: {
        totalBytes: os.totalmem(),
        freeBytes: os.freemem(),
      },
      nodeVersion: process.version,
    };
  }
}
