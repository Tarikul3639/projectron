import type { ToolExecutionStatus } from '../types/log.type.js';

export interface ExecutionTraceStep {
  timestamp: string;
  name: string;
  status: 'started' | 'completed' | 'info' | 'warning' | 'error';
  durationMs?: number;
  details?: unknown;
}

export interface ToolExecutionLog {
  id: string;
  timestamp: string;
  sessionId: string;
  event: 'mcp_tool_execution';
  tool: string;
  input: unknown;
  output?: unknown;
  status: ToolExecutionStatus;
  durationMs?: number;
  completedAt?: string;
  taskId?: string;
  steps?: ExecutionTraceStep[];
  error?: { name: string; message: string; code?: string; stack?: string };
}

export interface UserActivity {
  id: string;
  timestamp: string;
  sessionId: string;
  type: string;
  description: string;
  status: 'completed' | 'failed' | 'partial';
  executionIds?: string[];
  metadata?: Record<string, unknown>;
}

export interface ArchiveResult {
  date: string;
  archived: boolean;
  technicalRecords: number;
  activityRecords: number;
  textLogBytes: number;
}
