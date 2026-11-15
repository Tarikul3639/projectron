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
