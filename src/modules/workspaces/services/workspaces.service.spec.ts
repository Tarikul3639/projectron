import { BadRequestException, ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  access,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WorkspacesService } from './workspaces.service.js';

describe('WorkspacesService', () => {
  let root: string;
  let service: WorkspacesService;
  const records = new Map<string, string>();

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'projectron-workspaces-'));
    records.clear();
    const storage = {
      exists: vi.fn(async (path: string) => records.has(path)),
      read: vi.fn(async (path: string) => JSON.parse(records.get(path)!)),
      write: vi.fn(async (path: string, value: unknown) => {
        records.set(path, JSON.stringify(value));
      }),
    };
    service = new WorkspacesService(
      storage as never,
      {
        filesystemAllowedRoots: root,
      } as never,
    );
  });

  it('creates a registered workspace inside the configured root', async () => {
    const project = await service.create({ name: 'Alpha' });
    expect(project.status).toBe('active');
    expect(project.workspacePath.startsWith(root)).toBe(true);
    expect(project.workspacePath).toContain('alpha-');
    expect((await service.list()).map((item) => item.id)).toContain(project.id);
  });

  it('imports an existing directory without modifying its files', async () => {
    const workspace = join(root, 'existing-app');
    await mkdir(workspace);
    await writeFile(join(workspace, 'README.md'), 'keep me');
    const project = await service.import({ path: workspace });
    expect(project.name).toBe('existing-app');
    expect(await readFile(join(workspace, 'README.md'), 'utf8')).toBe(
      'keep me',
    );
  });

  it('imports an existing directory outside configured roots', async () => {
    const outside = await mkdtemp(join(tmpdir(), 'outside-project-'));
    const project = await service.import({ path: outside });
    expect(project.workspacePath).toBe(outside);
    await rm(outside, { recursive: true, force: true });
  });

  it('rejects duplicate names and duplicate workspace registration', async () => {
    const workspace = join(root, 'app');
    await mkdir(workspace);
    await service.import({ name: 'Alpha', path: workspace });
    await expect(
      service.import({ name: 'alpha', path: workspace }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('archives and restores a project without touching its workspace', async () => {
    const project = await service.create({ name: 'Alpha' });
    await service.archive({ workspaceId: project.id });
    expect(await service.list()).toHaveLength(0);
    expect(await service.list(true)).toHaveLength(1);
    await service.restore({ workspaceId: project.id });
    expect(await service.list()).toHaveLength(1);
  });

  it('removes only the registry entry and preserves workspace files', async () => {
    const project = await service.create({ name: 'Alpha' });
    const marker = join(project.workspacePath, 'keep.txt');
    await writeFile(marker, 'source remains');
    await service.remove({ workspaceId: project.id });
    await expect(service.get({ workspaceId: project.id })).rejects.toThrow();
    expect(await readFile(marker, 'utf8')).toBe('source remains');
    await expect(access(project.workspacePath)).resolves.toBeUndefined();
  });

  it('verifies an active workspace and rejects archived context', async () => {
    const project = await service.create({ name: 'Alpha' });
    expect((await service.getVerified({ workspaceId: project.id })).id).toBe(
      project.id,
    );
    await service.archive({ workspaceId: project.id });
    await expect(
      service.getVerified({ workspaceId: project.id }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
