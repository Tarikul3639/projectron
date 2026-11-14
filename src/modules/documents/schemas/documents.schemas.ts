import * as z from 'zod';

const relativePath = z
  .string()
  .trim()
  .min(1)
  .max(4096)
  .refine(
    (value) => !value.startsWith('/') && !/^[A-Za-z]:[\\/]/.test(value),
    'Document paths must be relative to an allowed workspace root',
  );
const rootIndex = z.number().int().min(0).max(31).optional();

// Defines the bounded inputs accepted by document tools.
export const documentPathSchema = z
  .object({ path: relativePath, rootIndex })
  .strict();
export const documentReadSchema = documentPathSchema
  .extend({
    maxCharacters: z.number().int().min(1).max(500000).optional(),
  })
  .strict();
export const documentInspectSchema = documentPathSchema;
export const documentCreateSchema = z
  .object({
    path: relativePath,
    content: z.string().max(1_000_000),
    overwrite: z.boolean().optional().default(false),
    rootIndex,
  })
  .strict();
export const documentConvertSchema = z
  .object({
    sourcePath: relativePath,
    destinationPath: relativePath,
    overwrite: z.boolean().optional().default(false),
    rootIndex,
  })
  .strict();
export const documentTemplateSchema = z
  .object({
    template: z.enum([
      'readme',
      'api',
      'architecture',
      'user-guide',
      'changelog',
    ]),
    title: z.string().trim().min(1).max(200),
    path: relativePath,
    projectName: z.string().trim().min(1).max(200).optional(),
    overwrite: z.boolean().optional().default(false),
    rootIndex,
  })
  .strict();
export const documentEmptySchema = z.object({}).strict();
