import type {
  ExecutionTraceStep,
  ToolExecutionLog,
} from '../interfaces/log.interface.js';

export type LogLevel = 'info' | 'warn' | 'error';
export type ToolExecutionStatus = 'running' | 'success' | 'error';
export type ToolExecutionEvent =
  | { eventType: 'tool.started'; executionId: string; record: ToolExecutionLog }
  | { eventType: 'tool.step'; executionId: string; step: ExecutionTraceStep }
  | {
      eventType: 'tool.completed';
      executionId: string;
      timestamp: string;
      durationMs: number;
      output: unknown;
    }
  | {
      eventType: 'tool.failed';
      executionId: string;
      timestamp: string;
      durationMs: number;
      error: ToolExecutionLog['error'];
    };
