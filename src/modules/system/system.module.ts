import { Module } from '@nestjs/common';
import { SystemTools } from './system.tools.js';
import { SystemInfoService } from './services/system-info.service.js';
import { SystemMetricsService } from './services/system-metrics.service.js';
import { SystemHardwareService } from './services/system-hardware.service.js';
import { SystemProcessService } from './services/system-process.service.js';
import { SystemDiagnosticsService } from './services/system-diagnostics.service.js';

// Registers focused system services and their single MCP tools provider.
@Module({
  providers: [
    SystemInfoService,
    SystemMetricsService,
    SystemHardwareService,
    SystemProcessService,
    SystemDiagnosticsService,
    SystemTools,
  ],
  exports: [
    SystemInfoService,
    SystemMetricsService,
    SystemHardwareService,
    SystemProcessService,
    SystemDiagnosticsService,
    SystemTools,
  ],
})
export class SystemModule {}
