export type ToolExecutionStatus = 'running' | 'success' | 'error';

export interface ToolExecutionLog {
  id: string;
  timestamp: string;
  tool: string;
  input: unknown;
  output?: unknown;
  error?: { name: string; message: string };
  status: ToolExecutionStatus;
  durationMs: number;
  completedAt: string;
}
