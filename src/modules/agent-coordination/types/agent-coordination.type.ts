export type ResourceLockMode = 'read' | 'write';
export type CoordinationTaskStatus =
  'pending' | 'in_progress' | 'blocked' | 'completed';

export type LockAcquireResult =
  | {
      acquired: true;
      lock: import('../interfaces/agent-coordination.interface.js').ResourceLock;
    }
  | { acquired: false; reason: string; currentOwners: string[] };
