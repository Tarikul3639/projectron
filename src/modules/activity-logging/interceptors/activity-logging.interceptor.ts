import { Injectable, Logger } from '@nestjs/common';
import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common';
import { McpExecutionContext } from '@nestjs/mcp';
import {
  catchError,
  concatMap,
  concatWith,
  defer,
  from,
  ignoreElements,
  tap,
  throwError,
} from 'rxjs';
import type { Observable } from 'rxjs';
import { ActivityLoggingService } from '../services/activity-logging.service.js';

@Injectable()
export class ActivityLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ActivityLoggingInterceptor.name);

  constructor(private readonly logs: ActivityLoggingService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const mcp = McpExecutionContext.create(context);
    if (mcp.getKind() !== 'tool') return next.handle();

    const tool = mcp.getName() ?? context.getHandler().name;
    const input = mcp.getInput();
    const timestamp = new Date().toISOString();
    const startedAt = Date.now();

    const persist = (status: 'success' | 'error', value: unknown) =>
      this.logs
        .recordExecution({
          tool,
          input,
          ...(status === 'success' ? { output: value } : { error: value }),
          status,
          timestamp,
          durationMs: Date.now() - startedAt,
        })
        .catch((error: unknown) => {
          this.logger.warn('Could not persist tool activity: ' + String(error));
        });

    return defer(() => {
      let output: unknown;
      return next.handle().pipe(
        tap((value) => {
          output = value;
        }),
        concatWith(
          defer(() => from(persist('success', output))).pipe(ignoreElements()),
        ),
        catchError((error: unknown) =>
          from(persist('error', error)).pipe(
            concatMap(() => throwError(() => error)),
          ),
        ),
      );
    });
  }
}
