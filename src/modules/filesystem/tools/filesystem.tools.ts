import { Injectable } from '@nestjs/common';
import { Tool } from '@nestjs/mcp';
import * as s from '../schemas/filesystem.schemas.js';
import type * as t from '../types/filesystem.type.js';
import { FileService } from '../services/file.service.js';
import { DirectoryService } from '../services/directory.service.js';
import { FileEditService } from '../services/file-edit.service.js';
import { FileTransferService } from '../services/file-transfer.service.js';

/** Exposes all filesystem capabilities through one MCP tools provider. */
@Injectable()
export class FilesystemTools {
  /** Initializes the tool handlers and their dependencies. */
  constructor(
    private readonly files: FileService,
    private readonly directories: DirectoryService,
    private readonly edits: FileEditService,
    private readonly transfers: FileTransferService,
  ) {}

  /** Lists direct workspace children with metadata. */
  /** Lists active browser sessions and their open pages. */
  @Tool({
    name: 'filesystem_list',
    description:
      'List files and directories inside a configured filesystem root.',
    inputSchema: s.listFilesInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  list(input: t.ListFilesInput) {
    return this.directories.list(input);
  }

  /** Returns a bounded recursive tree without following symlinks. */
  /** Returns tree from the service. */
  @Tool({
    name: 'filesystem_get_tree',
    description:
      'Return a recursive directory tree; symlinks are never followed.',
    inputSchema: s.getTreeInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  getTree(input: t.GetTreeInput) {
    return this.directories.getTree(input);
  }

  /** Reads a UTF-8 file. */
  /** Handles read for the component. */
  @Tool({
    name: 'filesystem_read',
    description: 'Read a UTF-8 file within an allowed root.',
    inputSchema: s.readFileInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  read(input: t.ReadFileInput) {
    return this.files.read(input);
  }

  /** Creates or overwrites a regular file. */
  /** Handles write for the component. */
  @Tool({
    name: 'filesystem_write',
    description:
      'Create a UTF-8 file; an existing regular file is overwritten.',
    inputSchema: s.writeFileInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  })
  async write(input: t.WriteFileInput) {
    await this.files.write(input);
    return { success: true, path: input.path };
  }

  /** Writes a batch of files with per-file results. */
  /** Writes multiple to the requested destination. */
  @Tool({
    name: 'filesystem_write_multiple',
    description:
      'Write up to 100 files with per-file results; existing regular files are overwritten.',
    inputSchema: s.writeMultipleFilesInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  })
  writeMultiple(input: t.WriteMultipleFilesInput) {
    return this.files.writeMultiple(input);
  }

  /** Appends UTF-8 content to a file. */
  /** Handles append for the component. */
  @Tool({
    name: 'filesystem_append',
    description:
      'Append UTF-8 text to a file, creating it when it does not exist.',
    inputSchema: s.appendFileInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  })
  async append(input: t.AppendFileInput) {
    await this.files.append(input);
    return { success: true, path: input.path };
  }

  /** Replaces exactly one occurrence of text in an existing file. */
  /** Handles edit for the component. */
  @Tool({
    name: 'filesystem_edit',
    description:
      'Replace one exact occurrence in a text file. Ambiguous matches are rejected.',
    inputSchema: s.editFileInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  })
  edit(input: t.EditFileInput) {
    return this.edits.edit(input);
  }

  /** Reads an inclusive one-based line range. */
  /** Reads range and returns the requested content. */
  @Tool({
    name: 'filesystem_read_range',
    description:
      'Read an inclusive one-based line range, limited to 1000 lines.',
    inputSchema: s.readFileRangeInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  readRange(input: t.ReadFileRangeInput) {
    return this.edits.readRange(input);
  }

  /** Searches names recursively under an allowed root. */
  /** Searches files using the supplied query. */
  @Tool({
    name: 'filesystem_search_files',
    description:
      'Search file and directory names recursively; symlinks are skipped.',
    inputSchema: s.searchFilesInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  searchFiles(input: t.SearchFilesInput) {
    return this.edits.searchFiles(input);
  }

  /** Searches inside UTF-8 text files and skips binary files. */
  /** Searches in files using the supplied query. */
  @Tool({
    name: 'filesystem_search_in_files',
    description:
      'Search UTF-8 text file contents recursively; binary files and symlinks are skipped.',
    inputSchema: s.searchInFilesInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  searchInFiles(input: t.SearchInFilesInput) {
    return this.edits.searchInFiles(input);
  }

  /** Creates a directory recursively. */
  /** Creates directory using the supplied input. */
  @Tool({
    name: 'filesystem_create_directory',
    description: 'Create a directory and missing parent directories.',
    inputSchema: s.createDirectoryInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  async createDirectory(input: t.CreateDirectoryInput) {
    await this.directories.createDirectory(input);
    return { success: true, path: input.path };
  }

  /** Moves a file to Trash. */
  /** Handles delete for the component. */
  @Tool({
    name: 'filesystem_delete',
    description: 'Move a file or symlink to the user Trash.',
    inputSchema: s.deleteFileInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  })
  async delete(input: t.DeleteFileInput) {
    await this.files.delete(input);
    return { success: true, path: input.path };
  }

  /** Moves a directory to Trash. */
  /** Deletes directory after validating the request. */
  @Tool({
    name: 'filesystem_delete_directory',
    description: 'Move a directory and its contents to Trash.',
    inputSchema: s.deleteDirectoryInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  })
  async deleteDirectory(input: t.DeleteDirectoryInput) {
    await this.directories.deleteDirectory(input);
    return { success: true, path: input.path };
  }

  /** Renames a directory without replacing its destination. */
  /** Renames directory to the requested name. */
  @Tool({
    name: 'filesystem_rename_directory',
    description:
      'Rename a directory without replacing an existing destination.',
    inputSchema: s.renamePathInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
  })
  async renameDirectory(input: t.RenamePathInput) {
    await this.directories.renameDirectory(input);
    return { success: true, from: input.path, to: input.newPath };
  }

  /** Copies a regular file without replacing the destination. */
  /** Copies file to the requested destination. */
  @Tool({
    name: 'filesystem_copy_file',
    description:
      'Copy a regular file without replacing an existing destination.',
    inputSchema: s.pathPairInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  async copyFile(input: t.PathPairInput) {
    await this.transfers.copyFile(input);
    return { success: true, from: input.path, to: input.destination };
  }

  /** Renames a file using the same safe move primitive. */
  /** Renames file to the requested name. */
  @Tool({
    name: 'filesystem_rename_file',
    description:
      'Rename a file or symlink without replacing an existing destination.',
    inputSchema: s.renamePathInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
  })
  async renameFile(input: t.RenamePathInput) {
    await this.transfers.moveFile({
      path: input.path,
      destination: input.newPath,
      rootIndex: input.rootIndex,
    });
    return { success: true, from: input.path, to: input.newPath };
  }

  /** Copies a directory recursively. */
  /** Copies directory to the requested destination. */
  @Tool({
    name: 'filesystem_copy_directory',
    description: 'Recursively copy a directory without following symlinks.',
    inputSchema: s.pathPairInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  async copyDirectory(input: t.PathPairInput) {
    await this.transfers.copyDirectory(input);
    return { success: true, from: input.path, to: input.destination };
  }

  /** Moves a file or symlink without replacing the destination. */
  /** Moves file to the requested destination. */
  @Tool({
    name: 'filesystem_move_file',
    description:
      'Move a file or symlink without replacing an existing destination.',
    inputSchema: s.pathPairInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
  })
  async moveFile(input: t.PathPairInput) {
    await this.transfers.moveFile(input);
    return { success: true, from: input.path, to: input.destination };
  }

  /** Moves a directory recursively. */
  /** Moves directory to the requested destination. */
  @Tool({
    name: 'filesystem_move_directory',
    description:
      'Move a directory tree without replacing an existing destination.',
    inputSchema: s.pathPairInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
  })
  async moveDirectory(input: t.PathPairInput) {
    await this.transfers.moveDirectory(input);
    return { success: true, from: input.path, to: input.destination };
  }

  /** Deletes a mixed batch and reports per-path outcomes. */
  /** Deletes multiple after validating the request. */
  @Tool({
    name: 'filesystem_delete_multiple',
    description: 'Move multiple files, links, and directories to Trash.',
    inputSchema: s.deleteMultipleInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  })
  deleteMultiple(input: t.DeleteMultipleInput) {
    return this.directories.deleteMultiple(input);
  }

  /** Copies a batch with per-item outcomes. */
  /** Copies multiple to the requested destination. */
  @Tool({
    name: 'filesystem_copy_multiple',
    description: 'Copy multiple files and directories with per-item outcomes.',
    inputSchema: s.bulkPathPairsInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  copyMultiple(input: t.BulkPathPairsInput) {
    return this.transfers.copyMultiple(input);
  }

  /** Moves a batch with per-item outcomes. */
  /** Moves multiple to the requested destination. */
  @Tool({
    name: 'filesystem_move_multiple',
    description: 'Move multiple files and directories with per-item outcomes.',
    inputSchema: s.bulkPathPairsInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
  })
  moveMultiple(input: t.BulkPathPairsInput) {
    return this.transfers.moveMultiple(input);
  }

  /** Creates a batch of directories. */
  /** Creates multiple directories using the supplied input. */
  @Tool({
    name: 'filesystem_create_multiple_directories',
    description: 'Create multiple directories and return per-path outcomes.',
    inputSchema: s.createMultipleDirectoriesInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  createMultipleDirectories(input: t.CreateMultipleDirectoriesInput) {
    return this.directories.createMultipleDirectories(input);
  }

  /** Reads up to 1 MiB from a file at a byte offset. */
  /** Reads chunk and returns the requested content. */
  @Tool({
    name: 'filesystem_read_chunk',
    description: 'Read a binary-safe file chunk of up to 1 MiB as base64.',
    inputSchema: s.readFileChunkInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  readChunk(input: t.ReadFileChunkInput) {
    return this.files.readFileChunk(input);
  }

  /** Starts a staged large-file upload. */
  /** Handles begin upload for the component. */
  @Tool({
    name: 'filesystem_begin_upload',
    description: 'Begin a staged large-file upload and return its transfer ID.',
    inputSchema: s.beginFileUploadInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
  })
  beginUpload(input: t.BeginFileUploadInput) {
    return this.transfers.beginFileUpload(input);
  }

  /** Writes the next sequential upload chunk. */
  /** Writes chunk to the requested destination. */
  @Tool({
    name: 'filesystem_write_chunk',
    description: 'Append the next sequential base64 chunk to an upload.',
    inputSchema: s.writeFileChunkInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
  })
  writeChunk(input: t.WriteFileChunkInput) {
    return this.transfers.writeFileChunk(input);
  }

  /** Verifies and publishes a staged upload. */
  /** Handles finish upload for the component. */
  @Tool({
    name: 'filesystem_finish_upload',
    description:
      'Verify size and checksum, then publish the staged upload; set overwrite=true to replace an existing file.',
    inputSchema: s.finishFileUploadInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  })
  finishUpload(input: t.FinishFileUploadInput) {
    return this.transfers.finishFileUpload(input);
  }

  /** Returns staged upload progress. */
  /** Returns upload status from the service. */
  @Tool({
    name: 'filesystem_get_upload_status',
    description:
      'Get progress and next expected chunk index for an active upload.',
    inputSchema: s.fileUploadIdInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  getUploadStatus(input: t.FileUploadIdInput) {
    return this.transfers.getFileUploadStatus(input.transferId);
  }

  /** Aborts an upload and removes its temporary file. */
  /** Handles abort upload for the component. */
  @Tool({
    name: 'filesystem_abort_upload',
    description: 'Cancel an active upload and remove its staged file.',
    inputSchema: s.fileUploadIdInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
  })
  abortUpload(input: t.FileUploadIdInput) {
    return this.transfers.abortFileUpload(input.transferId);
  }
}
