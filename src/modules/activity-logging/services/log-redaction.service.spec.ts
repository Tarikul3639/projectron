import { describe, expect, it } from 'vitest';
import { LogRedactionService } from './log-redaction.service.js';

describe('LogRedactionService', () => {
  const service = new LogRedactionService();
  it('redacts sensitive keys but preserves the rest of the payload', () => {
    const value = {
      password: 'secret-value',
      nested: { message: 'keep this full text' },
    };
    expect(service.sanitize(value)).toEqual({
      password: '[REDACTED]',
      nested: { message: 'keep this full text' },
    });
  });
  it('redacts bearer and provider keys embedded in text', () => {
    expect(
      service.sanitize('Bearer abc.def token sk-12345678901234567890'),
    ).toBe('Bearer [REDACTED] token [REDACTED]');
  });
  it('handles circular values and buffers', () => {
    const value: Record<string, unknown> = { data: Buffer.from('hello') };
    value.self = value;
    expect(service.sanitize(value)).toMatchObject({
      data: { type: 'Buffer', base64: 'aGVsbG8=' },
      self: '[CIRCULAR]',
    });
  });
});
