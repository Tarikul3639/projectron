import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { McpModule } from '../mcp/mcp.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { ActivityLoggingInterceptor } from './interceptors/activity-logging.interceptor.js';
import { ActivityLoggingTools } from './tools/activity-logging.tools.js';
import { ActivityLoggingService } from './services/activity-logging.service.js';
import { LogRedactionService } from './services/log-redaction.service.js';

@Module({
  imports: [StorageModule, McpModule],
  providers: [
    ActivityLoggingService,
    LogRedactionService,
    ActivityLoggingTools,
    { provide: APP_INTERCEPTOR, useClass: ActivityLoggingInterceptor },
  ],
  exports: [ActivityLoggingService],
})
export class ActivityLoggingModule {}
