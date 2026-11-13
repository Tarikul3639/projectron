import { Injectable } from '@nestjs/common';
import { McpRegistry } from '@nestjs/mcp';

export interface McpToolSummary {
  name: string;
  description: string;
  source: string;
}

export interface McpRegistrySummary {
  tools: McpToolSummary[];
  resources: number;
  resourceTemplates: number;
  prompts: number;
  total: number;
}

/** Exposes a read-only view of the primitives discovered by NestJS MCP. */
@Injectable()
export class McpRegistryService {
  constructor(private readonly registry: McpRegistry) {}

  /** Lists registered tools without exposing executable handlers or schema internals. */
  listTools(): McpToolSummary[] {
    return this.registry.tools.map(({ name, options, where }) => ({
      name,
      description: options.description ?? '',
      source: where,
    }));
  }

  /** Returns counts for every MCP primitive registered at application startup. */
  getSummary(): McpRegistrySummary {
    const tools = this.listTools();
    const resources = this.registry.resources.length;
    const resourceTemplates = this.registry.resourceTemplates.length;
    const prompts = this.registry.prompts.length;

    return {
      tools,
      resources,
      resourceTemplates,
      prompts,
      total: tools.length + resources + resourceTemplates + prompts,
    };
  }
}
