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
import { catchError, tap, throwError } from 'rxjs';
import type { Observable } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // Identify the tool handler and track how long it takes.
    const operation = `${context.getClass().name}.${context.getHandler().name}`;
    const startedAt = Date.now();

    this.logger.log(`${operation} started`);

    return next.handle().pipe(
      // Log successful completion and execution time.
      tap({
        complete: () =>
          this.logger.log(
            `${operation} succeeded in ${Date.now() - startedAt}ms`,
          ),
      }),
      catchError((error: unknown) => {
        // Keep the actual error message and code in the logs and response.
        const message = error instanceof Error ? error.message : String(error);
        const code =
          error && typeof error === 'object' && 'code' in error
            ? `${String(error.code)}: `
            : '';
        const details = `${code}${message}`;

        this.logger.error(
          `${operation} failed: ${details}`,
          error instanceof Error ? error.stack : undefined,
        );

        // Preserve errors that NestJS and MCP already understand.
        if (error instanceof HttpException || error instanceof ProtocolError) {
          return throwError(() => error);
        }

        // The MCP adapter hides other errors, so return their real message.
        return throwError(
          () => new InternalServerErrorException(details, { cause: error }),
        );
      }),
    );
  }
}
