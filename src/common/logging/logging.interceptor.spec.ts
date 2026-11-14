import { InternalServerErrorException } from '@nestjs/common';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { LoggingInterceptor } from './logging.interceptor.js';

class ExampleHandler {}

const exampleHandler = (): void => {};

function createContext(): ExecutionContext {
  return {
    getClass: () => ExampleHandler,
    getHandler: () => exampleHandler,
  } as unknown as ExecutionContext;
}

describe('LoggingInterceptor', () => {
  it('preserves successful handler results', async () => {
    const interceptor = new LoggingInterceptor();
    const result = { success: true };
    const next = { handle: () => of(result) } as CallHandler;

    await expect(
      lastValueFrom(interceptor.intercept(createContext(), next)),
    ).resolves.toEqual(result);
  });

  it('logs the error and exposes its diagnostic message to MCP callers', async () => {
    const interceptor = new LoggingInterceptor();
    const error = Object.assign(new Error('underlying failure'), {
      code: 'E_TEST',
    });
    const logger = (
      interceptor as unknown as {
        logger: { error: (message: string, stack?: string) => void };
      }
    ).logger;
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
    const next = { handle: () => throwError(() => error) } as CallHandler;

    const mappedError = await lastValueFrom(
      interceptor.intercept(createContext(), next),
    ).catch((caught: unknown) => caught);

    expect(mappedError).toBeInstanceOf(InternalServerErrorException);
    expect(
      (mappedError as InternalServerErrorException).getResponse(),
    ).toMatchObject({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'E_TEST: underlying failure',
    });
    expect((mappedError as Error & { cause?: unknown }).cause).toBe(error);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('E_TEST: underlying failure'),
      error.stack,
    );
  });
});
