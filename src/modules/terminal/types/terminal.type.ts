import type { z } from 'zod';
import type { executeCommandInputSchema } from '../schemas/terminal.schemas.js';

// Keeps the terminal service contract inferred from the MCP-facing Zod schema.
export type ExecuteCommandInput = z.infer<typeof executeCommandInputSchema>;
