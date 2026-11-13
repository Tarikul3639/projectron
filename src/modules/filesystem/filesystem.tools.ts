import { Injectable } from '@nestjs/common';
import { Tool } from '@nestjs/mcp';
import {
  beginFileUploadInputSchema,
  bulkPathPairsInputSchema,
  createDirectoryInputSchema,
  createMultipleDirectoriesInputSchema,
  deleteDirectoryInputSchema,
  deleteFileInputSchema,
  deleteMultipleInputSchema,
  fileUploadIdInputSchema,
  finishFileUploadInputSchema,
  getTreeInputSchema,
  listFilesInputSchema,
  pathPairInputSchema,
  readFileChunkInputSchema,
  readFileInputSchema,
  renamePathInputSchema,
  writeFileChunkInputSchema,
  writeFileInputSchema,
  writeMultipleFilesInputSchema,
} from './filesystem.schemas.js';
import type {
  BeginFileUploadInput,
  BulkPathPairsInput,
  CreateDirectoryInput,
  CreateMultipleDirectoriesInput,
  DeleteDirectoryInput,
  DeleteFileInput,
  DeleteMultipleInput,
  FileUploadIdInput,
  FinishFileUploadInput,
  GetTreeInput,
  ListFilesInput,
  PathPairInput,
  ReadFileChunkInput,
  ReadFileInput,
  RenamePathInput,
  WriteFileChunkInput,
  WriteFileInput,
  WriteMultipleFilesInput,
} from './filesystem.type.js';
import { FilesystemService } from './filesystem.service.js';

// Keeps every MCP filesystem tool in one discoverable provider; operation logic stays in the service.
@Injectable()
export class FilesystemTools {
  constructor(private readonly filesystem: FilesystemService) {}

  /** Lists direct children of a configured workspace directory. */
  @Tool({
    name: 'filesystem_list',
    description:
      'List files and directories inside a configured filesystem root. Returns entry names, types, sizes, and modification times.',
    inputSchema: listFilesInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  list(input: ListFilesInput) {
    return this.filesystem.list(input);
  }

  /** Returns a bounded recursive tree without following symbolic links. */
  @Tool({
    name: 'filesystem_get_tree',
    description:
      'Return a recursive directory tree. Symbolic links are shown but never followed; maximum depth is 10.',
    inputSchema: getTreeInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  getTree(input: GetTreeInput) {
    return this.filesystem.getTree(input);
  }

  /** Reads a UTF-8 text file; use chunk reads for large or binary files. */
  @Tool({
    name: 'filesystem_read',
    description:
      'Read a UTF-8 text file inside a configured filesystem root. Use filesystem_read_chunk for bounded binary-safe reads of large files.',
    inputSchema: readFileInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  read(input: ReadFileInput) {
    return this.filesystem.read(input);
  }

  /** Creates or overwrites a UTF-8 file; overwrites require approval when enabled. */
  @Tool({
    name: 'filesystem_write',
    description:
      'Create a UTF-8 file. Existing files require user approval before overwrite. Use a chunked transfer workflow for large files.',
    inputSchema: writeFileInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  })
  async write(input: WriteFileInput) {
    await this.filesystem.write(input);
    return {
      success: true,
      path: input.path,
      message: 'File written successfully.',
    };
  }

  /** Writes multiple files in one request; existing destinations require one batch approval. */
  @Tool({
    name: 'filesystem_write_multiple',
    description:
      'Create or update up to 100 UTF-8 files in one request (20 MiB combined content maximum). Existing files require one approval for the batch. Returns per-file success and failure results; valid files continue when another item fails.',
    inputSchema: writeMultipleFilesInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  })
  writeMultiple(input: WriteMultipleFilesInput) {
    return this.filesystem.writeMultiple(input);
  }

  /** Creates a directory and any missing parent directories. */
  @Tool({
    name: 'filesystem_create_directory',
    description:
      'Create a directory, including missing parent directories, inside a configured filesystem root.',
    inputSchema: createDirectoryInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  async createDirectory(input: CreateDirectoryInput) {
    await this.filesystem.createDirectory(input);
    return { success: true, path: input.path };
  }

  /** Moves a file or symbolic link to Trash after the required approval. */
  @Tool({
    name: 'filesystem_delete',
    description:
      'Move a regular file or symbolic link to the user Trash. This does not permanently delete it. Requires approval when enabled.',
    inputSchema: deleteFileInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  })
  async delete(input: DeleteFileInput) {
    await this.filesystem.delete(input);
    return { success: true, path: input.path, message: 'File moved to Trash.' };
  }

  /** Moves a directory and its contents to Trash after approval. */
  @Tool({
    name: 'filesystem_delete_directory',
    description:
      'Move a directory and all its contents to the user Trash. Allowed roots cannot be deleted. Requires approval when enabled.',
    inputSchema: deleteDirectoryInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  })
  async deleteDirectory(input: DeleteDirectoryInput) {
    await this.filesystem.deleteDirectory(input);
    return {
      success: true,
      path: input.path,
      message: 'Directory moved to Trash.',
    };
  }

  /** Renames a file or symbolic link without replacing an existing destination. */
  @Tool({
    name: 'filesystem_rename_file',
    description:
      'Rename a file or symbolic link within the same allowed root. Existing destinations are never overwritten.',
    inputSchema: renamePathInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
  })
  async renameFile(input: RenamePathInput) {
    await this.filesystem.renameFile(input);
    return { success: true, from: input.path, to: input.newPath };
  }

  /** Renames a directory without replacing an existing destination. */
  @Tool({
    name: 'filesystem_rename_directory',
    description:
      'Rename a directory inside an allowed root. The destination must not exist and cannot be inside the source directory.',
    inputSchema: renamePathInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
  })
  async renameDirectory(input: RenamePathInput) {
    await this.filesystem.renameDirectory(input);
    return { success: true, from: input.path, to: input.newPath };
  }

  /** Copies a regular file without replacing an existing destination. */
  @Tool({
    name: 'filesystem_copy_file',
    description:
      'Copy a regular file to another relative path within the same allowed root. Existing destinations are never overwritten.',
    inputSchema: pathPairInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  async copyFile(input: PathPairInput) {
    await this.filesystem.copyFile(input);
    return { success: true, from: input.path, to: input.destination };
  }

  /** Copies a directory recursively without following symbolic links. */
  @Tool({
    name: 'filesystem_copy_directory',
    description:
      'Recursively copy a directory without following symbolic links. Existing destinations are never overwritten.',
    inputSchema: pathPairInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  async copyDirectory(input: PathPairInput) {
    await this.filesystem.copyDirectory(input);
    return { success: true, from: input.path, to: input.destination };
  }

  /** Moves a file or symbolic link without replacing an existing destination. */
  @Tool({
    name: 'filesystem_move_file',
    description:
      'Move a file or symbolic link to another relative path. Existing destinations are never overwritten.',
    inputSchema: pathPairInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
  })
  async moveFile(input: PathPairInput) {
    await this.filesystem.moveFile(input);
    return { success: true, from: input.path, to: input.destination };
  }

  /** Moves a directory tree, including a cross-device copy fallback. */
  @Tool({
    name: 'filesystem_move_directory',
    description:
      'Move a directory and its contents to another path. Existing destinations are never overwritten.',
    inputSchema: pathPairInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
  })
  async moveDirectory(input: PathPairInput) {
    await this.filesystem.moveDirectory(input);
    return { success: true, from: input.path, to: input.destination };
  }

  /** Moves a mixed batch of files, links, and directories to Trash. */
  @Tool({
    name: 'filesystem_delete_multiple',
    description:
      'Move multiple files, symbolic links, and directories to Trash. The batch requires one approval and returns succeeded and failed path lists.',
    inputSchema: deleteMultipleInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  })
  deleteMultiple(input: DeleteMultipleInput) {
    return this.filesystem.deleteMultiple(input);
  }

  /** Copies multiple files and directories with per-item success and failure results. */
  @Tool({
    name: 'filesystem_copy_multiple',
    description:
      'Copy multiple files and directories in one request. Existing destinations are never overwritten; the response reports succeeded and failed items separately.',
    inputSchema: bulkPathPairsInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  copyMultiple(input: BulkPathPairsInput) {
    return this.filesystem.copyMultiple(input);
  }

  /** Moves multiple files and directories with per-item success and failure results. */
  @Tool({
    name: 'filesystem_move_multiple',
    description:
      'Move multiple files and directories in one request. Existing destinations are never overwritten; the response reports succeeded and failed items separately.',
    inputSchema: bulkPathPairsInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
  })
  moveMultiple(input: BulkPathPairsInput) {
    return this.filesystem.moveMultiple(input);
  }

  /** Creates multiple directories and reports failures without stopping the batch. */
  @Tool({
    name: 'filesystem_create_multiple_directories',
    description:
      'Create multiple directories, including missing parent directories, and return per-path success or failure results.',
    inputSchema: createMultipleDirectoriesInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  createMultipleDirectories(input: CreateMultipleDirectoriesInput) {
    return this.filesystem.createMultipleDirectories(input);
  }

  /** Reads up to 1 MiB from a file at a byte offset, returning base64 data. */
  @Tool({
    name: 'filesystem_read_chunk',
    description:
      'Read up to 1 MiB from a file at a byte offset. Returns base64 data, bytes read, offset, and total file size; repeat with the next offset for large files.',
    inputSchema: readFileChunkInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  readChunk(input: ReadFileChunkInput) {
    return this.filesystem.readFileChunk(input);
  }

  /** Starts a staged upload for receiving a large file in sequential chunks. */
  @Tool({
    name: 'filesystem_begin_upload',
    description:
      'Start receiving a large file in sequential chunks. Returns a transfer ID and recommended 1 MiB chunk size. Upload data is staged until checksum and size verification pass.',
    inputSchema: beginFileUploadInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
  })
  beginUpload(input: BeginFileUploadInput) {
    return this.filesystem.beginFileUpload(input);
  }

  /** Appends the next base64 chunk to a staged upload. */
  @Tool({
    name: 'filesystem_write_chunk',
    description:
      'Append the next sequential base64 chunk to an upload. Each chunk is limited to 1 MiB; use the returned nextChunkIndex to continue.',
    inputSchema: writeFileChunkInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
  })
  writeChunk(input: WriteFileChunkInput) {
    return this.filesystem.writeFileChunk(input);
  }

  /** Verifies and publishes the completed upload; overwrite requires approval. */
  @Tool({
    name: 'filesystem_finish_upload',
    description:
      'Verify received byte count and optional SHA-256, then atomically publish the staged file. If overwriting an existing file, provide approvalRequestId after user approval.',
    inputSchema: finishFileUploadInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  })
  finishUpload(input: FinishFileUploadInput) {
    return this.filesystem.finishFileUpload(input);
  }

  /** Returns upload progress, including the next required chunk index. */
  @Tool({
    name: 'filesystem_get_upload_status',
    description:
      'Get the current progress and next expected chunk index for an active upload.',
    inputSchema: fileUploadIdInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  getUploadStatus(input: FileUploadIdInput) {
    return this.filesystem.getFileUploadStatus(input.transferId);
  }

  /** Cancels an upload and removes its staged temporary file. */
  @Tool({
    name: 'filesystem_abort_upload',
    description:
      'Cancel an active upload and remove its staged temporary file.',
    inputSchema: fileUploadIdInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  })
  abortUpload(input: FileUploadIdInput) {
    return this.filesystem.abortFileUpload(input.transferId);
  }
}
