import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { access, mkdir, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { delimiter, isAbsolute, relative, resolve, sep } from 'node:path';
import { AppConfigService } from '../../../config/config.service.js';
import { JsonStorageService } from '../../storage/json-storage.service.js';
import type { ProjectRecord, ProjectStore } from '../projects.interface.js';
import type {
  CreateProjectInput,
  DiscoverProjectsInput,
  ImportProjectInput,
  ProjectIdInput,
  UpdateProjectInput,
} from '../projects.type.js';

const STORE_PATH = 'projects/projects.json';

/** Project catalog and workspace metadata only; it never executes or edits project files. */
@Injectable()
export class ProjectsService {
  private readonly roots: string[];

  constructor(
    private readonly storage: JsonStorageService,
    config: AppConfigService,
  ) {
    this.roots = config.filesystemAllowedRoots
      .split(delimiter)
      .map((item) => resolve(item.trim()))
      .filter(Boolean);
    if (this.roots.length === 0) {
      throw new BadRequestException(
        'At least one filesystem root must be configured',
      );
    }
  }

  /** Creates an empty workspace under the first configured root and registers it. */
  async create(input: CreateProjectInput): Promise<ProjectRecord> {
    const root = await this.getRoot(this.roots[0]);
    const id = randomUUID();
    const workspacePath = resolve(root, '.projectron', 'projects', id);
    await mkdir(workspacePath, { recursive: true });
    const actualPath = await realpath(workspacePath);
    this.assertInside(root, actualPath);
    return this.register({
      id,
      name: input.name.trim(),
      description: input.description ?? '',
      workspacePath: actualPath,
      metadata: input.metadata ?? {},
    });
  }

  /** Registers an existing allowed directory without moving or modifying its contents. */
  async import(input: ImportProjectInput): Promise<ProjectRecord> {
    const workspacePath = await this.resolveAllowedDirectory(input.path);
    const inferredName =
      workspacePath.split(sep).filter(Boolean).at(-1) ?? 'Imported project';
    return this.register({
      id: randomUUID(),
      name: (input.name ?? inferredName).trim(),
      description: input.description ?? '',
      workspacePath,
      metadata: input.metadata ?? {},
    });
  }

  /** Lists registered projects, excluding archived records unless requested. */
  async list(includeArchived = false): Promise<ProjectRecord[]> {
    const store = await this.readStore();
    return store.projects.filter(
      (item) => includeArchived || item.status === 'active',
    );
  }

  /** Returns a project record by its stable identifier. */
  async get(input: ProjectIdInput): Promise<ProjectRecord> {
    const store = await this.readStore();
    return this.requireProject(store, input.projectId);
  }

  /** Confirms that an active workspace still resolves inside an allowed root. */
  async getVerified(input: ProjectIdInput): Promise<ProjectRecord> {
    const project = await this.get(input);
    if (project.status !== 'active') {
      throw new BadRequestException('Archived projects are not active');
    }
    const workspacePath = await this.resolveAllowedDirectory(
      project.workspacePath,
    );
    if (workspacePath !== project.workspacePath) {
      throw new BadRequestException(
        'Registered project path no longer matches its canonical path',
      );
    }
    return project;
  }

  /** Updates editable project metadata and persists the registry. */
  async update(input: UpdateProjectInput): Promise<ProjectRecord> {
    const store = await this.readStore();
    const project = this.requireProject(store, input.projectId);
    if (input.name !== undefined) project.name = input.name.trim();
    if (input.description !== undefined)
      project.description = input.description;
    if (input.metadata !== undefined)
      project.metadata = { ...project.metadata, ...input.metadata };
    this.assertUniqueName(
      store.projects,
      project.name,
      project.workspacePath,
      project.id,
    );
    project.updatedAt = new Date().toISOString();
    await this.writeStore(store);
    return project;
  }

  /** Archives a project record without changing its workspace directory. */
  async archive(input: ProjectIdInput): Promise<ProjectRecord> {
    const store = await this.readStore();
    const project = this.requireProject(store, input.projectId);
    if (project.status === 'archived') return project;
    project.status = 'archived';
    project.archivedAt = new Date().toISOString();
    project.updatedAt = project.archivedAt;
    await this.writeStore(store);
    return project;
  }

  /** Reactivates an archived project record without changing its workspace. */
  async restore(input: ProjectIdInput): Promise<ProjectRecord> {
    const store = await this.readStore();
    const project = this.requireProject(store, input.projectId);
    if (project.status === 'active') return project;
    project.status = 'active';
    project.archivedAt = null;
    project.updatedAt = new Date().toISOString();
    await this.writeStore(store);
    return project;
  }

  /** Unregisters metadata only. It deliberately never deletes the user's workspace. */
  async remove(
    input: ProjectIdInput,
  ): Promise<{ projectId: string; workspacePath: string }> {
    const store = await this.readStore();
    const project = this.requireProject(store, input.projectId);
    store.projects = store.projects.filter((item) => item.id !== project.id);
    await this.writeStore(store);
    return { projectId: project.id, workspacePath: project.workspacePath };
  }

  /** Finds likely project roots by checking common manifest and repository markers. */
  async discover(input: DiscoverProjectsInput = {}) {
    const start = input.path
      ? await this.resolveAllowedDirectory(input.path)
      : await this.getRoot(this.roots[0]);
    const maxDepth = input.maxDepth ?? 2;
    const found: Array<{ name: string; path: string; indicators: string[] }> =
      [];
    const visit = async (directory: string, depth: number): Promise<void> => {
      if (found.length >= 100) return;
      const indicators: string[] = [];
      for (const marker of [
        'package.json',
        'pyproject.toml',
        'Cargo.toml',
        'go.mod',
        '.git',
        'README.md',
      ]) {
        try {
          await access(resolve(directory, marker), constants.F_OK);
          indicators.push(marker);
        } catch {
          // Marker is optional.
        }
      }
      if (indicators.length > 0) {
        found.push({
          name: directory.split(sep).filter(Boolean).at(-1) ?? directory,
          path: directory,
          indicators,
        });
        return;
      }
      if (depth >= maxDepth) return;
      const { readdir } = await import('node:fs/promises');
      const entries = await readdir(directory, { withFileTypes: true });
      for (const entry of entries) {
        if (
          !entry.isDirectory() ||
          entry.isSymbolicLink() ||
          entry.name.startsWith('.')
        )
          continue;
        const child = await realpath(resolve(directory, entry.name));
        this.assertInside(start, child);
        await visit(child, depth + 1);
      }
    };
    await visit(start, 0);
    return { root: start, projects: found };
  }

  /** Validates uniqueness, creates the registry record, and persists it. */
  private async register(input: {
    id: string;
    name: string;
    description: string;
    workspacePath: string;
    metadata: Record<string, unknown>;
  }): Promise<ProjectRecord> {
    const store = await this.readStore();
    this.assertUniqueName(store.projects, input.name, input.workspacePath);
    const duplicatePath = store.projects.find(
      (item) => item.workspacePath === input.workspacePath,
    );
    if (duplicatePath)
      throw new ConflictException('This workspace is already registered');
    const now = new Date().toISOString();
    const project: ProjectRecord = {
      ...input,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    };
    store.projects.push(project);
    await this.writeStore(store);
    return project;
  }

  /** Prevents duplicate project names, ignoring letter case. */
  private assertUniqueName(
    projects: ProjectRecord[],
    name: string,
    _path: string,
    exceptId?: string,
  ): void {
    if (
      projects.some(
        (item) =>
          item.id !== exceptId &&
          item.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
      )
    ) {
      throw new ConflictException('A project with this name already exists');
    }
  }

  /** Canonicalizes a directory and rejects paths outside configured allowed roots. */
  private async resolveAllowedDirectory(path: string): Promise<string> {
    const requested = isAbsolute(path)
      ? resolve(path)
      : resolve(this.roots[0], path);
    const actual = await realpath(requested).catch(() => null);
    if (!actual)
      throw new NotFoundException('Workspace directory does not exist');
    const allowed = await Promise.all(
      this.roots.map((root) => this.getRoot(root)),
    );
    if (!allowed.some((root) => this.isInside(root, actual))) {
      throw new BadRequestException(
        'Workspace must be inside a configured allowed root',
      );
    }
    const { stat } = await import('node:fs/promises');
    if (!(await stat(actual)).isDirectory())
      throw new BadRequestException('Workspace path must be a directory');
    return actual;
  }

  /** Ensures a configured root exists and returns its canonical path. */
  private async getRoot(root: string): Promise<string> {
    await mkdir(root, { recursive: true });
    return realpath(root);
  }

  /** Checks path containment using relative paths rather than string prefixes. */
  private isInside(root: string, target: string): boolean {
    const rel = relative(root, target);
    return (
      rel === '' ||
      (rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel))
    );
  }

  /** Throws when a discovered path escapes the directory being scanned. */
  private assertInside(root: string, target: string): void {
    if (!this.isInside(root, target)) {
      throw new BadRequestException(
        'Discovered path escaped the allowed workspace',
      );
    }
  }

  /** Loads and validates the persisted project registry, or returns an empty store. */
  private async readStore(): Promise<ProjectStore> {
    if (!(await this.storage.exists(STORE_PATH)))
      return { version: 1, projects: [] };
    const store = await this.storage.read<ProjectStore>(STORE_PATH);
    if (store.version !== 1 || !Array.isArray(store.projects)) {
      throw new BadRequestException(
        'Project registry is invalid or unsupported',
      );
    }
    return store;
  }

  /** Persists the complete project registry through the shared JSON storage service. */
  private writeStore(store: ProjectStore): Promise<void> {
    return this.storage.write(STORE_PATH, store);
  }

  /** Returns a registry record or raises a not-found error for an unknown ID. */
  private requireProject(store: ProjectStore, id: string): ProjectRecord {
    const project = store.projects.find((item) => item.id === id);
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }
}
