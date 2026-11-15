import { Logger } from '@nestjs/common';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActivityLoggingInterceptor } from './activity-logging.interceptor.js';

const ANSI_ESCAPE = String.fromCharCode(27);

function createContext(
  input: unknown,
  kind = 'tool',
  name = 'example_echo',
): ExecutionContext {
  return {
    getClass: () => ({ name: 'ExampleTools' }),
    getHandler: () => ({ name: 'echo' }),
    getArgs: () => [input, { kind, name }],
    getType: () => 'rpc',
  } as unknown as ExecutionContext;
}

function createRedaction() {
  return {
    sanitize: vi.fn((value: unknown) => value),
    sanitizeError: vi.fn((error: unknown) => ({
      name: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : String(error),
    })),
  };
}

function createInterceptor() {
  const logs = { recordExecution: vi.fn().mockResolvedValue({ id: '1' }) };
  const redaction = createRedaction();

  return {
    logs,
    interceptor: new ActivityLoggingInterceptor(
      logs as never,
      redaction as never,
    ),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ActivityLoggingInterceptor', () => {
  it('captures MCP tool input and returned output', async () => {
    const { interceptor, logs } = createInterceptor();
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
    const { interceptor, logs } = createInterceptor();

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
    const { interceptor, logs } = createInterceptor();
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

  it('uses a distinct ANSI color for each module in console logs', async () => {
    const loggerSpy = vi
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    const { interceptor } = createInterceptor();

    for (const [toolName, color, label] of [
      ['browser_navigate', 36, 'BROWSER'],
      ['filesystem_read', 34, 'FILESYSTEM'],
      ['terminal_execute', 32, 'TERMINAL'],
      ['network_dns_lookup', 95, 'NETWORK'],
    ] as const) {
      await lastValueFrom(
        interceptor.intercept(createContext({}, 'tool', toolName), {
          handle: () => of({ ok: true }),
        } as CallHandler),
      );

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining(`${ANSI_ESCAPE}[${color}m[${label}]`),
      );
    }
  });
});
