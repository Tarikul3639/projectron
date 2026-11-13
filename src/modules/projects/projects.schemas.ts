import * as z from 'zod';

const metadataSchema = z.record(z.string(), z.json()).optional();

export const createProjectSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().max(2000).optional(),
    metadata: metadataSchema,
  })
  .strict();

export const importProjectSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().max(2000).optional(),
    path: z.string().trim().min(1).max(4096),
    metadata: metadataSchema,
  })
  .strict();

export const projectIdSchema = z
  .object({
    projectId: z.string().uuid(),
  })
  .strict();

export const updateProjectSchema = z
  .object({
    projectId: z.string().uuid(),
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().max(2000).optional(),
    metadata: metadataSchema,
  })
  .strict();

export const projectListSchema = z
  .object({
    includeArchived: z.boolean().optional().default(false),
  })
  .strict();

export const discoverProjectsSchema = z
  .object({
    path: z.string().trim().min(1).max(4096).optional(),
    maxDepth: z.number().int().min(1).max(3).optional().default(2),
  })
  .strict();
