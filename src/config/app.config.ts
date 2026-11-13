import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  HOST: z.string().trim().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3639),

  MCP_HTTP_ENABLED: z.enum(['true', 'false']).default('true'),
  MCP_STDIO_ENABLED: z.enum(['true', 'false']).default('true'),

  APPROVAL_REQUIRED: z.enum(['true', 'false']).default('true'),
  AI_BASE_URL: z.string().trim().url().default('https://api.openai.com/v1'),
  AI_API_KEY: z.string().trim().optional(),
  AI_MODEL: z.string().trim().min(1).default('gpt-4.1-mini'),
  AI_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(300_000).default(60_000),
  FILESYSTEM_ALLOWED_ROOTS: z.string().trim().min(1).default('./workspace'),
  LOG_LEVEL: z
    .enum(['error', 'warn', 'log', 'debug', 'verbose'])
    .default('debug'),
});

export type Environment = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Environment {
  return envSchema.parse(config);
}
