import { describe, expect, it, vi } from 'vitest';
import { ProjectsService } from './services/projects.service.js';
import { ProjectsTools } from './projects.tools.js';

describe('ProjectsTools', () => {
  it('delegates project catalog actions to ProjectsService', async () => {
    const projects = {
      create: vi.fn().mockResolvedValue({ id: 'new-id' }),
      import: vi.fn().mockResolvedValue({ id: 'imported-id' }),
      list: vi.fn().mockResolvedValue([]),
      get: vi.fn().mockResolvedValue({ id: 'project-id' }),
      getVerified: vi.fn().mockResolvedValue({ id: 'verified-id' }),
      update: vi.fn().mockResolvedValue({ id: 'updated-id' }),
      archive: vi.fn().mockResolvedValue({ id: 'archived-id' }),
      restore: vi.fn().mockResolvedValue({ id: 'restored-id' }),
      remove: vi.fn().mockResolvedValue({ id: 'removed-id' }),
      discover: vi.fn().mockResolvedValue({ projects: [] }),
    };
    const tools = new ProjectsTools(projects as unknown as ProjectsService);

    await expect(tools.create({ name: 'Alpha' })).resolves.toEqual({
      id: 'new-id',
    });
    await expect(tools.import({ path: '/workspace/app' })).resolves.toEqual({
      id: 'imported-id',
    });
    await expect(tools.list({ includeArchived: false })).resolves.toEqual([]);
    await expect(tools.get({ projectId: 'id' })).resolves.toEqual({
      id: 'project-id',
    });
    await expect(tools.getVerified({ projectId: 'id' })).resolves.toEqual({
      id: 'verified-id',
    });
    await expect(
      tools.update({ projectId: 'id', name: 'Updated' }),
    ).resolves.toEqual({ id: 'updated-id' });
    await expect(tools.archive({ projectId: 'id' })).resolves.toEqual({
      id: 'archived-id',
    });
    await expect(tools.restore({ projectId: 'id' })).resolves.toEqual({
      id: 'restored-id',
    });
    await expect(tools.remove({ projectId: 'id' })).resolves.toEqual({
      id: 'removed-id',
    });
    await expect(tools.discover({})).resolves.toEqual({ projects: [] });

    expect(projects.create).toHaveBeenCalledOnce();
    expect(projects.import).toHaveBeenCalledOnce();
    expect(projects.list).toHaveBeenCalledWith(false);
    expect(projects.get).toHaveBeenCalledWith({ projectId: 'id' });
    expect(projects.getVerified).toHaveBeenCalledWith({ projectId: 'id' });
    expect(projects.update).toHaveBeenCalledOnce();
    expect(projects.archive).toHaveBeenCalledOnce();
    expect(projects.restore).toHaveBeenCalledOnce();
    expect(projects.remove).toHaveBeenCalledOnce();
    expect(projects.discover).toHaveBeenCalledWith({});
  });
});
