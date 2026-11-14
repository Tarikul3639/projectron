export type OrchestrationTaskStatus =
  'planned' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

export type OrchestrationStepStatus =
  'queued' | 'running' | 'completed' | 'failed' | 'skipped';

export interface OrchestrationStep {
  id: string;
  title: string;
  toolName: string;
  input: Record<string, unknown>;
  dependsOn: string[];
  status: OrchestrationStepStatus;
  result?: unknown;
  error?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  maxAttempts?: number;
  attempts?: OrchestrationStepAttempt[];
}

export interface OrchestrationStepAttempt {
  attempt: number;
  startedAt: string;
  finishedAt?: string;
  status: 'running' | 'completed' | 'failed';
  error?: string;
}

export interface OrchestrationTask {
  id: string;
  goal: string;
  status: OrchestrationTaskStatus;
  steps: OrchestrationStep[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface CreateOrchestrationPlanInput {
  goal: string;
  steps: Array<{
    id: string;
    title: string;
    toolName: string;
    input?: Record<string, unknown>;
    dependsOn?: string[];
    maxAttempts?: number;
  }>;
}

export interface UpdateOrchestrationStepInput {
  taskId: string;
  stepId: string;
  status: OrchestrationStepStatus;
  result?: unknown;
  error?: string;
}
