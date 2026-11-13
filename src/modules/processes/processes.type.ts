import type { z } from 'zod';
import type {
  processIdSchema,
  startProcessSchema,
  stopProcessSchema,
} from './processes.schemas.js';

// Keeps process tool inputs inferred from their MCP-facing Zod schemas.
export type StartProcessInput = z.infer<typeof startProcessSchema>;
export type ProcessIdInput = z.infer<typeof processIdSchema>;
export type StopProcessInput = z.infer<typeof stopProcessSchema>;
