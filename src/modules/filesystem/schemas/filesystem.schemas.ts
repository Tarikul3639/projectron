import * as z from 'zod';

const rootIndexSchema = z
  .number()
  .int()
  .min(0)
  .optional()
  .describe('Zero-based index of the configured allowed root.');
const relativePathSchema = z
  .string()
  .min(1)
  .describe('Path relative to the selected allowed root.');

// Defines the bounded listing request for a workspace directory.
export const listFilesInputSchema = z
  .object({
    path: z
      .string()
      .optional()
      .describe('Relative directory path; omit to list the workspace root.'),
    rootIndex: rootIndexSchema,
  })
  .strict();

// Defines a UTF-8 text file read request.
export const readFileInputSchema = z
  .object({
    path: relativePathSchema,
    rootIndex: rootIndexSchema,
  })
  .strict();

// Defines a UTF-8 file write request. Large transfers should use chunked transfer tools.
export const writeFileInputSchema = z
  .object({
    path: relativePathSchema,
    content: z
      .string()
      .describe(
        'UTF-8 content to write. For large files, use chunked transfer instead.',
      ),
    rootIndex: rootIndexSchema,
  })
  .strict();

// Defines a bounded batch of UTF-8 file writes.
export const writeMultipleFilesInputSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            path: relativePathSchema,
            content: z.string().max(5_242_880),
          })
          .strict(),
      )
      .min(1)
      .max(100),
    rootIndex: rootIndexSchema,
  })
  .strict()
  .refine(
    (input) =>
      input.items.reduce(
        (total, item) => total + Buffer.byteLength(item.content, 'utf8'),
        0,
      ) <= 20_971_520,
    'Combined file content must not exceed 20 MiB',
  );

// Defines a recursive directory creation request.
export const createDirectoryInputSchema = z
  .object({
    path: relativePathSchema,
    rootIndex: rootIndexSchema,
  })
  .strict();

// Defines a file deletion request.
export const deleteFileInputSchema = z
  .object({
    path: relativePathSchema,
    rootIndex: rootIndexSchema,
  })
  .strict();

// Defines a source/destination pair for file and directory operations.
export const pathPairInputSchema = z
  .object({
    path: relativePathSchema,
    destination: relativePathSchema,
    rootIndex: rootIndexSchema,
  })
  .strict();

// Defines a rename request with a separate destination path.
export const renamePathInputSchema = z
  .object({
    path: relativePathSchema,
    newPath: relativePathSchema,
    rootIndex: rootIndexSchema,
  })
  .strict();

// Defines directory deletion.
export const deleteDirectoryInputSchema = deleteFileInputSchema;

// Defines a bounded bulk delete request.
export const deleteMultipleInputSchema = z
  .object({
    paths: z.array(relativePathSchema).min(1).max(500),
    rootIndex: rootIndexSchema,
  })
  .strict();

// Defines a recursive tree request with a bounded maximum depth.
export const getTreeInputSchema = z
  .object({
    path: z.string().optional(),
    maxDepth: z.number().int().min(1).max(10).optional(),
    rootIndex: rootIndexSchema,
  })
  .strict();

// Defines a binary-safe bounded read request for large files.
export const readFileChunkInputSchema = z
  .object({
    path: relativePathSchema,
    offset: z.number().int().min(0),
    length: z.number().int().min(1).max(1_048_576),
    rootIndex: rootIndexSchema,
  })
  .strict();

/** Starts a chunked file upload; checksum verification is optional but recommended. */
export const beginFileUploadInputSchema = z
  .object({
    path: relativePathSchema,
    totalBytes: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    sha256: z
      .string()
      .regex(/^[a-fA-F0-9]{64}$/)
      .optional(),
    overwrite: z.boolean().optional(),
    rootIndex: rootIndexSchema,
  })
  .strict();

/** Supplies one ordered chunk to an active upload. */
export const writeFileChunkInputSchema = z
  .object({
    transferId: z.string().uuid(),
    chunkIndex: z.number().int().min(0),
    base64Data: z.string().min(4).max(1_398_104),
  })
  .strict();

/** Finishes a verified upload and publishes the staged file. */
export const finishFileUploadInputSchema = z
  .object({
    transferId: z.string().uuid(),
  })
  .strict();

/** Identifies an active upload for status or cancellation. */
export const fileUploadIdInputSchema = z
  .object({
    transferId: z.string().uuid(),
  })
  .strict();

/** Defines a batch of source/destination pairs for copy or move operations. */
export const bulkPathPairsInputSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            path: relativePathSchema,
            destination: relativePathSchema,
          })
          .strict(),
      )
      .min(1)
      .max(200),
    rootIndex: rootIndexSchema,
  })
  .strict();

/** Defines a batch of directory paths to create. */
export const createMultipleDirectoriesInputSchema = z
  .object({
    paths: z.array(relativePathSchema).min(1).max(500),
    rootIndex: rootIndexSchema,
  })
  .strict();

/** Defines an append operation for a UTF-8 file. */
export const appendFileInputSchema = writeFileInputSchema;
/** Defines an exact-match replacement request for an existing text file. */
export const editFileInputSchema = z
  .object({
    path: relativePathSchema,
    oldText: z.string().min(1),
    newText: z.string(),
    rootIndex: rootIndexSchema,
  })
  .strict();
/** Defines a one-based inclusive line range read. */
export const readFileRangeInputSchema = z
  .object({
    path: relativePathSchema,
    startLine: z.number().int().min(1),
    endLine: z.number().int().min(1),
    rootIndex: rootIndexSchema,
  })
  .strict();
/** Defines a bounded recursive filename search. */
export const searchFilesInputSchema = z
  .object({
    query: z.string().min(1),
    path: z.string().optional(),
    maxResults: z.number().int().min(1).max(500).optional(),
    rootIndex: rootIndexSchema,
  })
  .strict();
/** Defines a bounded recursive search inside UTF-8 text files. */
export const searchInFilesInputSchema = searchFilesInputSchema;
