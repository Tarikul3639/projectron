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

const officeRelativePath = z
  .string()
  .trim()
  .min(1)
  .max(4096)
  .refine(
    (value) => !value.startsWith('/') && !/^[A-Za-z]:[\\\\/]/.test(value),
    'Document paths must be relative to an allowed workspace root',
  );
const officeClientId = z.string().trim().min(1).max(128);
const officeRootIndex = z.number().int().min(0).max(31).optional();
const cellValue = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const wordCreateSchema = z
  .object({
    path: officeRelativePath,
    title: z.string().trim().min(1).max(300).optional(),
    author: z.string().trim().max(200).optional(),
    subject: z.string().trim().max(500).optional(),
    sections: z
      .array(
        z
          .object({
            heading: z.string().trim().max(300).optional(),
            level: z.number().int().min(1).max(3).optional(),
            paragraphs: z.array(z.string().max(20000)).max(100).optional(),
            bullets: z.array(z.string().max(2000)).max(100).optional(),
            table: z
              .object({
                headers: z.array(z.string().max(300)).min(1).max(30),
                rows: z.array(z.array(z.string().max(2000)).max(30)).max(1000),
              })
              .strict()
              .optional(),
          })
          .strict(),
      )
      .min(1)
      .max(200),
    overwrite: z.boolean().optional().default(false),
    clientId: officeClientId,
    rootIndex: officeRootIndex,
  })
  .strict();

export const spreadsheetCreateSchema = z
  .object({
    path: officeRelativePath,
    title: z.string().trim().min(1).max(300).optional(),
    author: z.string().trim().max(200).optional(),
    sheets: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(31),
            headers: z.array(z.string().max(300)).min(1).max(200),
            rows: z.array(z.array(cellValue).max(200)).max(10000),
            freezeHeader: z.boolean().optional().default(true),
            autoFilter: z.boolean().optional().default(true),
          })
          .strict(),
      )
      .min(1)
      .max(50),
    overwrite: z.boolean().optional().default(false),
    clientId: officeClientId,
    rootIndex: officeRootIndex,
  })
  .strict();

export const presentationCreateSchema = z
  .object({
    path: officeRelativePath,
    title: z.string().trim().min(1).max(300),
    author: z.string().trim().max(200).optional(),
    subject: z.string().trim().max(500).optional(),
    slides: z
      .array(
        z
          .object({
            title: z.string().trim().min(1).max(300),
            body: z.string().max(10000).optional(),
            bullets: z.array(z.string().max(2000)).max(30).optional(),
            notes: z.string().max(5000).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(100),
    overwrite: z.boolean().optional().default(false),
    clientId: officeClientId,
    rootIndex: officeRootIndex,
  })
  .strict();

export const pdfCreateSchema = z
  .object({
    path: officeRelativePath,
    title: z.string().trim().min(1).max(300),
    author: z.string().trim().max(200).optional(),
    sections: z
      .array(
        z
          .object({
            heading: z.string().trim().max(300).optional(),
            paragraphs: z.array(z.string().max(20000)).max(100),
          })
          .strict(),
      )
      .min(1)
      .max(200),
    pageSize: z.enum(['A4', 'Letter']).optional().default('A4'),
    overwrite: z.boolean().optional().default(false),
    clientId: officeClientId,
    rootIndex: officeRootIndex,
  })
  .strict();

export const officeReadSchema = z
  .object({
    path: officeRelativePath,
    maxCharacters: z.number().int().min(1).max(500000).optional(),
    rootIndex: officeRootIndex,
  })
  .strict();

export const spreadsheetReadSchema = z
  .object({
    path: officeRelativePath,
    maxRows: z.number().int().min(1).max(10000).optional(),
    rootIndex: officeRootIndex,
  })
  .strict();

export const officeInspectSchema = z
  .object({
    path: officeRelativePath,
    rootIndex: officeRootIndex,
  })
  .strict();

export const officeConvertSchema = z
  .object({
    sourcePath: officeRelativePath,
    destinationPath: officeRelativePath,
    overwrite: z.boolean().optional().default(false),
    clientId: officeClientId,
    rootIndex: officeRootIndex,
  })
  .strict();
