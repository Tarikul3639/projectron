import { describe, expect, it } from 'vitest';
import { LogRedactionService } from './log-redaction.service.js';

describe('LogRedactionService', () => {
  const service = new LogRedactionService();

  it('redacts credentials and preserves ordinary values', () => {
    expect(
      service.sanitize({
        password: 'secret-value',
        nested: { message: 'keep this text' },
      }),
    ).toEqual({
      password: '[REDACTED]',
      nested: { message: 'keep this text' },
    });
  });

  it('redacts bearer tokens and bounds large strings', () => {
    expect(service.sanitize('Bearer abc.def')).toBe('Bearer [REDACTED]');
    expect(String(service.sanitize('x'.repeat(20_000))).length).toBeLessThan(
      8_300,
    );
  });

  it('omits binary data and handles circular values', () => {
    const value: Record<string, unknown> = { data: Buffer.from('hello') };
    value.self = value;
    expect(service.sanitize(value)).toEqual({
      data: '[BINARY OMITTED]',
      self: '[CIRCULAR]',
    });
  });
});
