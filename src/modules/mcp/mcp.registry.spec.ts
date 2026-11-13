import { describe, expect, it } from 'vitest';
import type { McpRegistry } from '@nestjs/mcp';
import { McpRegistryService } from './mcp.registry.js';

describe('McpRegistryService', () => {
  it('returns tool metadata without exposing handlers', () => {
    const registry = {
      tools: [
        {
          name: 'projects_list',
          options: { description: 'List projects' },
          where: 'ProjectsTools.list',
          handler: () => undefined,
        },
      ],
      resources: [],
      resourceTemplates: [],
      prompts: [],
    } as unknown as McpRegistry;
    const service = new McpRegistryService(registry);

    expect(service.listTools()).toEqual([
      {
        name: 'projects_list',
        description: 'List projects',
        source: 'ProjectsTools.list',
      },
    ]);
    expect(service.listTools()[0]).not.toHaveProperty('handler');
  });

  it('summarizes all registered primitive types', () => {
    const registry = {
      tools: [{ name: 'tool', options: {}, where: 'Tools.run' }],
      resources: [{}],
      resourceTemplates: [{}],
      prompts: [{}, {}],
    } as unknown as McpRegistry;
    const summary = new McpRegistryService(registry).getSummary();

    expect(summary).toMatchObject({
      resources: 1,
      resourceTemplates: 1,
      prompts: 2,
      total: 5,
    });
    expect(summary.tools).toHaveLength(1);
  });
});
