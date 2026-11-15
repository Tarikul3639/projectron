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
import { LogRedactionService } from '../services/log-redaction.service.js';

const ANSI_ESCAPE = String.fromCharCode(27);
const ANSI_RESET = `${ANSI_ESCAPE}[0m`;
const ANSI_BOLD = `${ANSI_ESCAPE}[1m`;
const ANSI_RED = `${ANSI_ESCAPE}[31m`;

/**
 * Gives each Projectron module a stable console color so tool activity is
 * easy to scan when several modules are running through the same MCP server.
 */
const MODULE_LOG_STYLES: Record<string, { label: string; color: string }> = {
  browser: { label: 'BROWSER', color: `${ANSI_ESCAPE}[36m` },
  documents: { label: 'DOCUMENTS', color: `${ANSI_ESCAPE}[35m` },
  filesystem: { label: 'FILESYSTEM', color: `${ANSI_ESCAPE}[34m` },
  terminal: { label: 'TERMINAL', color: `${ANSI_ESCAPE}[32m` },
  process: { label: 'PROCESSES', color: `${ANSI_ESCAPE}[33m` },
  workspaces: { label: 'WORKSPACES', color: `${ANSI_ESCAPE}[96m` },
  network: { label: 'NETWORK', color: `${ANSI_ESCAPE}[95m` },
  system: { label: 'SYSTEM', color: `${ANSI_ESCAPE}[94m` },
  activity: { label: 'ACTIVITY', color: `${ANSI_ESCAPE}[93m` },
  storage: { label: 'DATABASE', color: `${ANSI_ESCAPE}[92m` },
  mcp: { label: 'MCP', color: `${ANSI_ESCAPE}[97m` },
};

/** Resolves the console style from the MCP tool's module prefix. */
function getModuleLogStyle(toolName: string) {
  const moduleName = toolName.split('_', 1)[0];

  return (
    MODULE_LOG_STYLES[moduleName] ?? {
      label: moduleName.toUpperCase() || 'TOOL',
      color: `${ANSI_ESCAPE}[37m`,
    }
  );
}

@Injectable()
export class ActivityLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ActivityLoggingInterceptor.name);

  constructor(
    private readonly logs: ActivityLoggingService,
    private readonly redaction: LogRedactionService,
  ) {}

  /**
   * Intercepts MCP tool calls, prints color-coded lifecycle logs, and stores
   * the execution result without changing the tool's returned value or error.
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const mcp = McpExecutionContext.create(context);

    // Only MCP tools are activity records; resources and prompts pass through.
    if (mcp.getKind() !== 'tool') {
      return next.handle();
    }

    const tool = mcp.getName() ?? context.getHandler().name;
    const input = mcp.getInput();
    const moduleStyle = getModuleLogStyle(tool);

    // Persistence failures must never cause an otherwise successful tool call to fail.
    const persist = (
      status: 'success' | 'error',
      value: unknown,
      timestamp: string,
      startedAt: number,
    ) =>
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
      const startedAt = Date.now();
      const timestamp = new Date(startedAt).toISOString();
      const safeInput = this.redaction.sanitize(input);
      const moduleTag = `${moduleStyle.color}[${moduleStyle.label}]${ANSI_RESET}`;
      const toolName = `${ANSI_BOLD}${tool}${ANSI_RESET}`;

      this.logger.log(
        `${moduleTag} ${toolName} started (input: ${JSON.stringify(safeInput)})`,
      );

      let output: unknown;

      return next.handle().pipe(
        tap((value) => {
          output = value;
        }),
        concatWith(
          defer(() =>
            from(
              persist('success', output, timestamp, startedAt).then(() => {
                this.logger.log(
                  `${moduleTag} ${toolName} completed successfully (${Date.now() - startedAt} ms)`,
                );
              }),
            ),
          ).pipe(ignoreElements()),
        ),
        catchError((error: unknown) =>
          from(
            persist('error', error, timestamp, startedAt).then(() => {
              const safeError = this.redaction.sanitizeError(error);
              this.logger.error(
                `${moduleTag} ${ANSI_RED}${tool} failed: ${safeError.name}: ${safeError.message}${ANSI_RESET} (${Date.now() - startedAt} ms)`,
              );
            }),
          ).pipe(concatMap(() => throwError(() => error))),
        ),
      );
    });
  }
}
