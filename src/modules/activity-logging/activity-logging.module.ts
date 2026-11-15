import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { McpModule } from '../mcp/mcp.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { ActivityLoggingInterceptor } from './interceptors/activity-logging.interceptor.js';
import { ActivityLoggingTools } from './tools/activity-logging.tools.js';
import { ActivityCollectorService } from './services/activity-collector.service.js';
import { ActivityLoggingService } from './services/activity-logging.service.js';
import { ActivityQueryService } from './services/activity-query.service.js';
import { ActivityReportService } from './services/activity-report.service.js';
import { ActivitySummaryService } from './services/activity-summary.service.js';
import { LogRedactionService } from './services/log-redaction.service.js';
import { LogRotationService } from './services/log-rotation.service.js';

@Module({
  imports: [StorageModule, McpModule],
  providers: [
    ActivityLoggingService,
    LogRedactionService,
    ActivityCollectorService,
    ActivityQueryService,
    ActivitySummaryService,
    ActivityReportService,
    LogRotationService,
    ActivityLoggingTools,
    { provide: APP_INTERCEPTOR, useClass: ActivityLoggingInterceptor },
  ],
  exports: [
    ActivityLoggingService,
    ActivityCollectorService,
    ActivityQueryService,
    ActivitySummaryService,
    ActivityReportService,
    LogRotationService,
  ],
})
export class ActivityLoggingModule {}
