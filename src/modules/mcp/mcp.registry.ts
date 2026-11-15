import { Injectable } from '@nestjs/common';
import { McpRegistry } from '@nestjs/mcp';
import type {
  McpRegistrySummary,
  McpToolSummary,
} from './interfaces/mcp-registry.interface.js';

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
