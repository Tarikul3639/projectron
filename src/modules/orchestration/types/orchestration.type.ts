export type OrchestrationTaskStatus =
  'planned' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

export type OrchestrationStepStatus =
  'queued' | 'running' | 'completed' | 'failed' | 'skipped';
