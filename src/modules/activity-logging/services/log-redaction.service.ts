import { Injectable } from '@nestjs/common';

const SECRET_KEY =
  /(authorization|cookie|password|passwd|secret|token|api[-_]?key|access[-_]?key|private[-_]?key|credential)/i;
const SECRET_VALUE =
  /(Bearer\s+)[A-Za-z0-9._~+/-]+=*|((?:sk|rk|pk)-[A-Za-z0-9_-]{12,})/g;
const MAX_STRING = 8_192;
const MAX_ITEMS = 50;
const MAX_DEPTH = 8;

@Injectable()
export class LogRedactionService {
  sanitize(value: unknown): unknown {
    return this.visit(value, new WeakSet<object>(), 0);
  }

  sanitizeError(error: unknown): { name: string; message: string } {
    const value =
      error instanceof Error
        ? { name: error.name, message: error.message }
        : { name: 'UnknownError', message: String(error) };
    return this.sanitize(value) as { name: string; message: string };
  }

  private visit(value: unknown, seen: WeakSet<object>, depth: number): unknown {
    if (typeof value === 'string') {
      const redacted = value.replace(
        SECRET_VALUE,
        (_match, bearer: string | undefined) =>
          bearer ? bearer + '[REDACTED]' : '[REDACTED]',
      );
      return redacted.length > MAX_STRING
        ? redacted.slice(0, MAX_STRING) + '[TRUNCATED]'
        : redacted;
    }
    if (value === null || ['number', 'boolean'].includes(typeof value))
      return value;
    if (typeof value === 'undefined') return null;
    if (typeof value === 'bigint') return value.toString();
    if (typeof value === 'function' || typeof value === 'symbol')
      return '[OMITTED]';
    if (value instanceof Date) return value.toISOString();
    if (value instanceof Error) return this.sanitizeError(value);
    if (Buffer.isBuffer(value)) return '[BINARY OMITTED]';
    if (depth >= MAX_DEPTH) return '[MAX DEPTH]';
    if (seen.has(value as object)) return '[CIRCULAR]';

    seen.add(value as object);
    if (Array.isArray(value)) {
      const result = value
        .slice(0, MAX_ITEMS)
        .map((item) => this.visit(item, seen, depth + 1));
      if (value.length > MAX_ITEMS) result.push('[ITEMS TRUNCATED]');
      seen.delete(value);
      return result;
    }

    const result: Record<string, unknown> = {};
    const entries = Object.entries(value as Record<string, unknown>);
    for (const [key, item] of entries.slice(0, MAX_ITEMS)) {
      result[key] = SECRET_KEY.test(key)
        ? '[REDACTED]'
        : this.visit(item, seen, depth + 1);
    }
    if (entries.length > MAX_ITEMS) result.__truncated = true;
    seen.delete(value as object);
    return result;
  }
}
