import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ActivityLoggingInterceptor } from './activity-logging.interceptor.js';

function createContext(input: unknown, kind = 'tool'): ExecutionContext {
  return {
    getClass: () => ({ name: 'ExampleTools' }),
    getHandler: () => ({ name: 'echo' }),
    getArgs: () => [input, { kind, name: 'example_echo' }],
    getType: () => 'rpc',
  } as unknown as ExecutionContext;
}

describe('ActivityLoggingInterceptor', () => {
  it('captures only MCP tool input and returned output', async () => {
    const logs = { recordExecution: vi.fn().mockResolvedValue({ id: '1' }) };
    const interceptor = new ActivityLoggingInterceptor(logs as never);
    const result = { echoed: true };
    await expect(
      lastValueFrom(
        interceptor.intercept(createContext({ value: 'input' }), {
          handle: () => of(result),
        } as CallHandler),
      ),
    ).resolves.toEqual(result);
    await vi.waitFor(() =>
      expect(logs.recordExecution).toHaveBeenCalledWith(
        expect.objectContaining({
          tool: 'example_echo',
          input: { value: 'input' },
          output: result,
          status: 'success',
        }),
      ),
    );
  });

  it('does not log non-tool MCP handlers', async () => {
    const logs = { recordExecution: vi.fn() };
    const interceptor = new ActivityLoggingInterceptor(logs as never);
    await expect(
      lastValueFrom(
        interceptor.intercept(createContext({ value: 'input' }, 'resource'), {
          handle: () => of('result'),
        } as CallHandler),
      ),
    ).resolves.toBe('result');
    expect(logs.recordExecution).not.toHaveBeenCalled();
  });

  it('records errors without changing the tool error', async () => {
    const logs = { recordExecution: vi.fn().mockResolvedValue({ id: '1' }) };
    const interceptor = new ActivityLoggingInterceptor(logs as never);
    const error = new Error('tool failed');
    await expect(
      lastValueFrom(
        interceptor.intercept(createContext({ value: 'input' }), {
          handle: () => throwError(() => error),
        } as CallHandler),
      ),
    ).rejects.toBe(error);
    await vi.waitFor(() =>
      expect(logs.recordExecution).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'error', error }),
      ),
    );
  });
});
