import * as z from 'zod';

const metadataSchema = z.record(z.string(), z.json()).optional();

export const createWorkspaceSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().max(2000).optional(),
    metadata: metadataSchema,
  })
  .strict();

export const importWorkspaceSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().max(2000).optional(),
    path: z.string().trim().min(1).max(4096),
    metadata: metadataSchema,
  })
  .strict();

export const workspaceIdSchema = z
  .object({
    workspaceId: z.string().uuid(),
  })
  .strict();

export const updateWorkspaceSchema = z
  .object({
    workspaceId: z.string().uuid(),
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().max(2000).optional(),
    metadata: metadataSchema,
  })
  .strict();

export const workspaceListSchema = z
  .object({
    includeArchived: z.boolean().optional().default(false),
  })
  .strict();

export const discoverWorkspacesSchema = z
  .object({
    path: z.string().trim().min(1).max(4096).optional(),
    maxDepth: z.number().int().min(1).max(3).optional().default(2),
  })
  .strict();
