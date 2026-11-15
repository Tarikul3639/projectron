import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common';
import { ProtocolError } from '@modelcontextprotocol/server';
import {
  catchError,
  concatMap,
  concatWith,
  defer,
  from,
  ignoreElements,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import type { Observable } from 'rxjs';
import { ActivityLoggingService } from '../services/activity-logging.service.js';

@Injectable()
export class ActivityLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ActivityLoggingInterceptor.name);

  constructor(private readonly activityLogs: ActivityLoggingService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const operation = `${context.getClass().name}.${context.getHandler().name}`;
    const args = typeof context.getArgs === 'function' ? context.getArgs() : [];
    const input = args.length === 1 ? args[0] : args;
    const startedAt = Date.now();

    return defer(() =>
      from(this.activityLogs.startToolExecution({ tool: operation, input })),
    ).pipe(
      switchMap((executionId) =>
        from(
          this.activityLogs.recordExecutionStep(executionId, {
            name: 'MCP tool handler invoked',
            status: 'started',
          }),
        ).pipe(
          switchMap(() => {
            let output: unknown;
            return next.handle().pipe(
              tap({
                next: (value: unknown) => {
                  output = value;
                },
              }),
              concatWith(
                defer(() =>
                  from(
                    this.activityLogs.recordExecutionStep(executionId, {
                      name: 'MCP tool handler completed',
                      status: 'completed',
                      details: {
                        outputType: output === null ? 'null' : typeof output,
                      },
                    }),
                  ).pipe(
                    concatMap(() =>
                      from(
                        this.activityLogs.completeToolExecution(
                          executionId,
                          output,
                        ),
                      ),
                    ),
                    ignoreElements(),
                  ),
                ),
              ),
              catchError((error: unknown) => {
                const message =
                  error instanceof Error ? error.message : String(error);
                const code =
                  error && typeof error === 'object' && 'code' in error
                    ? String(error.code)
                    : undefined;
                const details = code ? `${code}: ${message}` : message;
                return from(
                  this.activityLogs.failToolExecution(executionId, error),
                ).pipe(
                  catchError((loggingError: unknown) => {
                    this.logPersistenceError(loggingError);
                    return from([undefined]);
                  }),
                  concatMap(() => {
                    this.logger.error(
                      `${operation} failed after ${Date.now() - startedAt}ms: ${details}`,
                      error instanceof Error ? error.stack : undefined,
                    );
                    if (
                      error instanceof HttpException ||
                      error instanceof ProtocolError
                    )
                      return throwError(() => error);
                    return throwError(
                      () =>
                        new InternalServerErrorException(details, {
                          cause: error,
                        }),
                    );
                  }),
                );
              }),
            );
          }),
        ),
      ),
    );
  }

  private logPersistenceError(error: unknown): void {
    this.logger.error(
      'Could not persist MCP execution details',
      error instanceof Error ? error.stack : String(error),
    );
  }
}
