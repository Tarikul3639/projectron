import { describe, expect, it, vi } from 'vitest';
import { ProjectsTools } from './projects.tools.js';

describe('ProjectsTools', () => {
  it('delegates project catalog actions to ProjectsService', async () => {
    const projects = {
      create: vi.fn().mockResolvedValue({ id: 'new-id' }),
      import: vi.fn().mockResolvedValue({ id: 'imported-id' }),
      list: vi.fn().mockResolvedValue([]),
      get: vi.fn().mockResolvedValue({ id: 'project-id' }),
      discover: vi.fn().mockResolvedValue({ projects: [] }),
    };
    const tools = new ProjectsTools(projects as never);
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
    await expect(tools.discover({})).resolves.toEqual({ projects: [] });
    expect(projects.create).toHaveBeenCalledOnce();
    expect(projects.import).toHaveBeenCalledOnce();
  });
});
