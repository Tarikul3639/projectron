import { describe, expect, it } from 'vitest';
import type { McpRegistry } from '@nestjs/mcp';
import { McpRegistryService } from './mcp.registry.js';

describe('McpRegistryService', () => {
  it('returns tool metadata without exposing handlers', () => {
    const registry = {
      tools: [
        {
          name: 'workspaces_list',
          options: { description: 'List workspaces' },
          where: 'WorkspacesTools.list',
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
        name: 'workspaces_list',
        description: 'List workspaces',
        source: 'WorkspacesTools.list',
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
