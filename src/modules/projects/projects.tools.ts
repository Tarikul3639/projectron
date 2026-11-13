import { Injectable } from '@nestjs/common';
import { Tool } from '@nestjs/mcp';
import * as s from './projects.schemas.js';
import type * as t from './projects.type.js';
import { ProjectsService } from './services/projects.service.js';

/** MCP interface for project catalog operations; no other module consumes this service. */
@Injectable()
export class ProjectsTools {
  constructor(private readonly projects: ProjectsService) {}

  @Tool({
    name: 'projects_create',
    description:
      'Create a new empty project workspace under a configured allowed root and register it.',
    inputSchema: s.createProjectSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
  })
  create(input: t.CreateProjectInput) {
    return this.projects.create(input);
  }

  @Tool({
    name: 'projects_import',
    description:
      'Import an existing project directory inside a configured allowed root without moving or modifying its files.',
    inputSchema: s.importProjectSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
  })
  import(input: t.ImportProjectInput) {
    return this.projects.import(input);
  }

  @Tool({
    name: 'projects_list',
    description:
      'List registered projects; optionally include archived projects.',
    inputSchema: s.projectListSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  list(input: t.ProjectListInput) {
    return this.projects.list(input.includeArchived);
  }

  @Tool({
    name: 'projects_get',
    description:
      'Get project metadata and registered workspace path by project UUID.',
    inputSchema: s.projectIdSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  get(input: t.ProjectIdInput) {
    return this.projects.get(input);
  }

  @Tool({
    name: 'projects_get_verified',
    description:
      'Verify that a registered active project workspace still exists inside an allowed root.',
    inputSchema: s.projectIdSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  getVerified(input: t.ProjectIdInput) {
    return this.projects.getVerified(input);
  }

  @Tool({
    name: 'projects_update',
    description: 'Update project name, description, or metadata.',
    inputSchema: s.updateProjectSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
  })
  update(input: t.UpdateProjectInput) {
    return this.projects.update(input);
  }

  @Tool({
    name: 'projects_archive',
    description: 'Archive a project record without touching its workspace.',
    inputSchema: s.projectIdSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  archive(input: t.ProjectIdInput) {
    return this.projects.archive(input);
  }

  @Tool({
    name: 'projects_restore',
    description: 'Restore an archived project record.',
    inputSchema: s.projectIdSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  restore(input: t.ProjectIdInput) {
    return this.projects.restore(input);
  }

  @Tool({
    name: 'projects_remove',
    description:
      'Remove a project from the registry only. Its workspace and source files are never deleted.',
    inputSchema: s.projectIdSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
  })
  remove(input: t.ProjectIdInput) {
    return this.projects.remove(input);
  }

  @Tool({
    name: 'projects_discover',
    description:
      'Discover likely project directories under a configured allowed root. This does not import or modify them.',
    inputSchema: s.discoverProjectsSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
  })
  discover(input: t.DiscoverProjectsInput) {
    return this.projects.discover(input);
  }
}
