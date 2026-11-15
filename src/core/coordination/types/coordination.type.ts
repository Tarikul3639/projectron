import type { ResourceLock } from '../interfaces/coordination.interface.js';

export type ResourceLockMode = 'read' | 'write';
export type CoordinationTaskStatus =
  'pending' | 'in_progress' | 'blocked' | 'completed';

export type LockAcquireResult =
  | { acquired: true; lock: ResourceLock }
  | { acquired: false; reason: string; currentOwners: string[] };
