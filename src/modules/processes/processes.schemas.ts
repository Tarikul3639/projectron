import * as z from 'zod';

// Defines bounded inputs for starting, inspecting, and stopping managed processes.
export const startProcessSchema = z
  .object({
    command: z.string().trim().min(1).max(256),
    args: z.array(z.string().max(8192)).max(100).default([]),
    workingDirectory: z.string().trim().min(1),
    clientId: z.string().trim().min(1).max(128),
  })
  .strict();

export const processIdSchema = z
  .object({
    pid: z.number().int().positive(),
  })
  .strict();

export const stopProcessSchema = processIdSchema
  .extend({
    clientId: z.string().trim().min(1).max(128),
  })
  .strict();
