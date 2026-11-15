import { InternalServerErrorException } from '@nestjs/common';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ActivityLoggingInterceptor } from './activity-logging.interceptor.js';

class ExampleHandler {}
const exampleHandler = (): void => {};

function createContext(): ExecutionContext {
  return {
    getClass: () => ExampleHandler,
    getHandler: () => exampleHandler,
    getArgs: () => [{ file: 'src/index.ts' }],
  } as unknown as ExecutionContext;
}

describe('ActivityLoggingInterceptor', () => {
  it('preserves successful results and records complete input/output', async () => {
    const logs = {
      startToolExecution: vi.fn().mockResolvedValue('execution-1'),
      recordExecutionStep: vi.fn().mockResolvedValue(undefined),
      completeToolExecution: vi.fn().mockResolvedValue(undefined),
      failToolExecution: vi.fn().mockResolvedValue(undefined),
    };
    const interceptor = new ActivityLoggingInterceptor(logs as never);
    const result = { success: true };
    const next = { handle: () => of(result) } as CallHandler;
    await expect(
      lastValueFrom(interceptor.intercept(createContext(), next)),
    ).resolves.toEqual(result);
    await vi.waitFor(() =>
      expect(logs.completeToolExecution).toHaveBeenCalledWith(
        'execution-1',
        result,
      ),
    );
    expect(logs.startToolExecution).toHaveBeenCalledWith({
      tool: 'ExampleHandler.exampleHandler',
      input: { file: 'src/index.ts' },
    });
    expect(logs.recordExecutionStep).toHaveBeenCalledWith(
      'execution-1',
      expect.objectContaining({
        name: 'MCP tool handler invoked',
        status: 'started',
      }),
    );
  });

  it('maps unexpected errors while preserving the original cause', async () => {
    const logs = {
      startToolExecution: vi.fn().mockResolvedValue('execution-2'),
      recordExecutionStep: vi.fn().mockResolvedValue(undefined),
      completeToolExecution: vi.fn().mockResolvedValue(undefined),
      failToolExecution: vi.fn().mockResolvedValue(undefined),
    };
    const interceptor = new ActivityLoggingInterceptor(logs as never);
    const error = Object.assign(new Error('underlying failure'), {
      code: 'E_TEST',
    });
    const next = { handle: () => throwError(() => error) } as CallHandler;
    const mapped = await lastValueFrom(
      interceptor.intercept(createContext(), next),
    ).catch((caught: unknown) => caught);
    expect(mapped).toBeInstanceOf(InternalServerErrorException);
    expect(
      (mapped as InternalServerErrorException).getResponse(),
    ).toMatchObject({ statusCode: 500, message: 'E_TEST: underlying failure' });
    expect((mapped as Error & { cause?: unknown }).cause).toBe(error);
    await vi.waitFor(() =>
      expect(logs.failToolExecution).toHaveBeenCalledWith('execution-2', error),
    );
  });
});
