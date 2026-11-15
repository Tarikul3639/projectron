import { Injectable } from '@nestjs/common';

const SECRET_KEY =
  /(authorization|cookie|password|passwd|secret|token|api[-_]?key|access[-_]?key|private[-_]?key|credential)/i;
const SECRET_VALUE =
  /(Bearer\s+)[A-Za-z0-9._~+/-]+=*|((?:sk|rk|pk)-[A-Za-z0-9_-]{12,})/g;

/** Redacts credentials while preserving the complete non-sensitive payload. */
@Injectable()
export class LogRedactionService {
  /** Recursively removes credential-like values before data is persisted or displayed. */
  sanitize(value: unknown): unknown {
    return this.visit(value, new WeakSet<object>());
  }

  /** Normalizes nested values, masks secret keys/tokens, and safely marks circular references. */
  private visit(value: unknown, seen: WeakSet<object>): unknown {
    if (typeof value === 'string') {
      return value.replace(
        SECRET_VALUE,
        (_match, bearer: string | undefined) =>
          bearer ? `${bearer}[REDACTED]` : '[REDACTED]',
      );
    }
    if (
      value === null ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      typeof value === 'undefined'
    )
      return value;
    if (typeof value === 'bigint') return value.toString();
    if (typeof value === 'function' || typeof value === 'symbol')
      return String(value);
    if (value instanceof Date) return value.toISOString();
    if (value instanceof Error) {
      return {
        name: value.name,
        message: this.visit(value.message, seen),
        ...(value.stack ? { stack: value.stack } : {}),
      };
    }
    if (Buffer.isBuffer(value))
      return { type: 'Buffer', base64: value.toString('base64') };
    if (seen.has(value as object)) return '[CIRCULAR]';
    seen.add(value as object);
    if (Array.isArray(value)) {
      const result = value.map((item) => this.visit(item, seen));
      seen.delete(value);
      return result;
    }
    if (typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, item] of Object.entries(
        value as Record<string, unknown>,
      )) {
        result[key] = SECRET_KEY.test(key)
          ? '[REDACTED]'
          : this.visit(item, seen);
      }
      seen.delete(value as object);
      return result;
    }
    seen.delete(value as object);
    return JSON.stringify(value) ?? '[UNSERIALIZABLE]';
  }
}
