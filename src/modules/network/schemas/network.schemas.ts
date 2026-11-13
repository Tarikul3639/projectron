import * as z from 'zod';

// Defines bounded inputs for network diagnostics and outbound HTTP requests.
export const hostSchema = z
  .string()
  .trim()
  .min(1)
  .max(253)
  .describe('A hostname or IP address without a URL scheme.');

export const dnsLookupSchema = z
  .object({
    hostname: hostSchema,
    recordType: z.enum(['A', 'AAAA', 'ANY']).default('ANY'),
  })
  .strict();

export const connectivitySchema = z
  .object({
    hostname: hostSchema,
    port: z.number().int().min(1).max(65535).default(443),
    timeoutMs: z.number().int().min(100).max(10000).default(3000),
  })
  .strict();

export const portCheckSchema = z
  .object({
    hostname: hostSchema,
    port: z.number().int().min(1).max(65535),
    timeoutMs: z.number().int().min(100).max(10000).default(3000),
  })
  .strict();

export const httpRequestSchema = z
  .object({
    url: z.string().url().max(2048),
    method: z
      .enum(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'])
      .default('GET'),
    headers: z.record(z.string(), z.string().max(8192)).default({}),
    body: z.string().max(65536).optional(),
    timeoutMs: z.number().int().min(100).max(30000).default(10000),
    maxResponseBytes: z.number().int().min(1024).max(1048576).default(262144),
    clientId: z.string().trim().min(1).max(128),
  })
  .strict();
