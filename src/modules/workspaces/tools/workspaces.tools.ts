import { Injectable } from '@nestjs/common';
import { Tool } from '@nestjs/mcp';
import * as s from '../schemas/workspaces.schemas.js';
import type * as t from '../interfaces/workspace-input.interface.js';
import { WorkspacesService } from '../services/workspaces.service.js';

/** MCP interface for workspace registry operations; no other module consumes this service. */
@Injectable()
export class WorkspacesTools {
  /** Injects the workspace registry service used by all workspace registry MCP operations. */
  constructor(private readonly projects: WorkspacesService) { }

  /** Creates and registers a new empty workspace beneath an allowed filesystem root. */
  @Tool({
    name: 'workspaces_create',
    description:
      'Create a new empty, human-readable workspace under the default workspace root and register its location.',
    inputSchema: s.createWorkspaceSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
  })
  create(input: t.CreateWorkspaceInput) {
    return this.projects.create(input);
  }

  /** Registers an existing workspace directory without moving or changing any files in that workspace. */
  @Tool({
    name: 'workspaces_import',
    description:
      'Register an existing workspace directory at an absolute local path without moving or modifying its files.',
    inputSchema: s.importWorkspaceSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
  })
  import(input: t.ImportWorkspaceInput) {
    return this.projects.import(input);
  }

  /** Lists registered workspaces and optionally includes records that have been archived. */
  @Tool({
    name: 'workspaces_list',
    description:
      'List registered workspaces; optionally include archived workspaces.',
    inputSchema: s.workspaceListSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  list(input: t.WorkspaceListInput) {
    return this.projects.list(input.includeArchived);
  }

  /** Retrieves the registered workspace metadata for the supplied project identifier. */
  @Tool({
    name: 'workspaces_get',
    description:
      'Get workspace metadata and registered workspace path by workspace UUID.',
    inputSchema: s.workspaceIdSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  get(input: t.WorkspaceIdInput) {
    return this.projects.get(input);
  }

  /** Verifies that an active workspace's workspace still exists within a configured allowed root. */
  @Tool({
    name: 'workspaces_get_verified',
    description:
      'Verify that a registered active workspace still exists inside an allowed root.',
    inputSchema: s.workspaceIdSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  getVerified(input: t.WorkspaceIdInput) {
    return this.projects.getVerified(input);
  }

  /** Updates the editable name, description, or metadata of an existing workspace record. */
  @Tool({
    name: 'workspaces_update',
    description: 'Update project name, description, or metadata.',
    inputSchema: s.updateWorkspaceSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
  })
  update(input: t.UpdateWorkspaceInput) {
    return this.projects.update(input);
  }

  /** Archives a workspace registry record while leaving its workspace and files untouched. */
  @Tool({
    name: 'workspaces_archive',
    description: 'Archive a workspace record without touching its workspace.',
    inputSchema: s.workspaceIdSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  archive(input: t.WorkspaceIdInput) {
    return this.projects.archive(input);
  }

  /** Restores an archived workspace record to the active workspace list without changing its workspace. */
  @Tool({
    name: 'workspaces_restore',
    description: 'Restore an archived workspace record.',
    inputSchema: s.workspaceIdSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  restore(input: t.WorkspaceIdInput) {
    return this.projects.restore(input);
  }

  /** Removes a project from the registry only; the underlying workspace directory is preserved. */
  @Tool({
    name: 'workspaces_remove',
    description:
      'Remove a project from the registry only. Its workspace and source files are never deleted.',
    inputSchema: s.workspaceIdSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
  })
  remove(input: t.WorkspaceIdInput) {
    return this.projects.remove(input);
  }

  /** Scans an allowed root for likely workspace directories without importing or modifying discovered files. */
  @Tool({
    name: 'workspaces_discover',
    description:
      'Discover likely workspace directories under any supplied local directory. This does not import or modify them.',
    inputSchema: s.discoverWorkspacesSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  discover(input: t.DiscoverWorkspacesInput) {
    return this.projects.discover(input);
  }
}
