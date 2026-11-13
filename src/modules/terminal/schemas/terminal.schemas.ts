import * as z from 'zod';

// Defines one bounded process execution request for MCP clients.
export const executeCommandInputSchema = z
  .object({
    command: z
      .string()
      .trim()
      .min(1)
      .max(256)
      .describe(
        'Executable name or absolute executable path; shell syntax is not interpreted.',
      ),
    args: z
      .array(z.string().max(8192))
      .max(100)
      .default([])
      .describe(
        'Arguments passed directly to the executable without shell expansion.',
      ),
    workingDirectory: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe(
        'Working directory inside one configured filesystem root; defaults to the first root.',
      ),
    timeoutMs: z
      .number()
      .int()
      .min(100)
      .max(120_000)
      .default(30_000)
      .describe('Maximum execution time, from 100 ms to 120 seconds.'),
    clientId: z
      .string()
      .trim()
      .min(1)
      .max(128)
      .describe(
        'Stable MCP client identifier used to bind execution approval.',
      ),
    approvalRequestId: z
      .string()
      .uuid()
      .optional()
      .describe('Approved request ID returned by the approval workflow.'),
  })
  .strict();
