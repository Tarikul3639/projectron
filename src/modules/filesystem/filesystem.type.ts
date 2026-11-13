import type { z } from 'zod';
import type {
  bulkPathPairsInputSchema,
  createMultipleDirectoriesInputSchema,
  beginFileUploadInputSchema,
  fileUploadIdInputSchema,
  finishFileUploadInputSchema,
  writeFileChunkInputSchema,
  createDirectoryInputSchema,
  deleteDirectoryInputSchema,
  deleteFileInputSchema,
  deleteMultipleInputSchema,
  getTreeInputSchema,
  listFilesInputSchema,
  pathPairInputSchema,
  readFileChunkInputSchema,
  readFileInputSchema,
  renamePathInputSchema,
  writeFileInputSchema,
  writeMultipleFilesInputSchema,
} from './filesystem.schemas.js';

// Keeps service input types inferred from the same Zod contracts exposed to MCP.
export type ListFilesInput = z.infer<typeof listFilesInputSchema>;
export type ReadFileInput = z.infer<typeof readFileInputSchema>;
export type WriteFileInput = z.infer<typeof writeFileInputSchema>;
export type WriteMultipleFilesInput = z.infer<
  typeof writeMultipleFilesInputSchema
>;
export type CreateDirectoryInput = z.infer<typeof createDirectoryInputSchema>;
export type DeleteFileInput = z.infer<typeof deleteFileInputSchema>;
export type DeleteDirectoryInput = z.infer<typeof deleteDirectoryInputSchema>;
export type PathPairInput = z.infer<typeof pathPairInputSchema>;
export type RenamePathInput = z.infer<typeof renamePathInputSchema>;
export type DeleteMultipleInput = z.infer<typeof deleteMultipleInputSchema>;
export type GetTreeInput = z.infer<typeof getTreeInputSchema>;
export type ReadFileChunkInput = z.infer<typeof readFileChunkInputSchema>;

// Upload types stay synchronized with the MCP-facing transfer schemas.
export type BeginFileUploadInput = z.infer<typeof beginFileUploadInputSchema>;
export type WriteFileChunkInput = z.infer<typeof writeFileChunkInputSchema>;
export type FinishFileUploadInput = z.infer<typeof finishFileUploadInputSchema>;
export type FileUploadIdInput = z.infer<typeof fileUploadIdInputSchema>;

// Batch operation inputs are inferred from their shared MCP schemas.
export type BulkPathPairsInput = z.infer<typeof bulkPathPairsInputSchema>;
export type CreateMultipleDirectoriesInput = z.infer<
  typeof createMultipleDirectoriesInputSchema
>;
