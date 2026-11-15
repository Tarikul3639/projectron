import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  CoordinationTask,
  ExecutionSession,
  ResourceLock,
} from '../interfaces/coordination.interface.js';
import type {
  CoordinationTaskStatus,
  LockAcquireResult,
  ResourceLockMode,
} from '../types/coordination.type.js';

const DEFAULT_LEASE_SECONDS = 60;

/**
 * Shared in-process coordination primitives. Feature modules enforce these
 * policies at their own resource-operation boundaries.
 */
@Injectable()
export class CoordinationService {
  private readonly sessions = new Map<string, ExecutionSession>();
  private readonly locks = new Map<string, Map<string, ResourceLock>>();
  private readonly tasks = new Map<string, CoordinationTask>();

  /** Registers one execution context; reuse sessionId only when reconnecting it. */
  registerSession(input: {
    clientId: string;
    clientName: string;
    sessionId?: string;
    leaseSeconds?: number;
  }): ExecutionSession {
    this.cleanupExpired();
    const sessionId = input.sessionId ?? randomUUID();
    const now = new Date();
    const existing = this.sessions.get(sessionId);
    if (existing && existing.clientId !== input.clientId) {
      throw new ConflictException('Session ID is already registered to another client');
    }
    const session: ExecutionSession = {
      sessionId,
      clientId: input.clientId,
      clientName: input.clientName,
      connectedAt: existing?.connectedAt ?? now.toISOString(),
      lastHeartbeatAt: now.toISOString(),
      expiresAt: this.expiry(input.leaseSeconds),
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  /** Renews one session and only the locks owned by that session. */
  heartbeatSession(sessionId: string, leaseSeconds?: number): ExecutionSession {
    this.cleanupExpired();
    const current = this.sessions.get(sessionId);
    if (!current) {
      throw new NotFoundException('Execution session not found; register this session first');
    }
    const now = new Date().toISOString();
    const session = {
      ...current,
      lastHeartbeatAt: now,
      expiresAt: this.expiry(leaseSeconds),
    };
    this.sessions.set(sessionId, session);
    for (const [resource, owners] of this.locks) {
      const lock = owners.get(sessionId);
      if (lock) owners.set(sessionId, { ...lock, expiresAt: session.expiresAt });
      if (owners.size === 0) this.locks.delete(resource);
    }
    return session;
  }

  /** Acquires shared read or exclusive write access for a resource. */
  acquireLock(input: {
    sessionId: string;
    resource: string;
    mode: ResourceLockMode;
    leaseSeconds?: number;
  }): LockAcquireResult {
    this.cleanupExpired();
    const session = this.requireSession(input.sessionId);
    const owners = this.locks.get(input.resource) ?? new Map<string, ResourceLock>();
    const own = owners.get(input.sessionId);
    const otherLocks = [...owners.values()].filter(
      (lock) => lock.ownerSessionId !== input.sessionId,
    );
    const incompatible =
      input.mode === 'write'
        ? otherLocks.length > 0
        : otherLocks.some((lock) => lock.mode === 'write');

    if (incompatible) {
      return {
        acquired: false,
        reason:
          input.mode === 'write'
            ? 'Resource has active readers or another writer'
            : 'Resource is exclusively locked for writing',
        currentOwners: otherLocks.map((lock) => lock.ownerSessionId),
      };
    }
    if (own?.mode === 'read' && input.mode === 'write') {
      return {
        acquired: false,
        reason: 'Release the read lock before requesting an exclusive write lock',
        currentOwners: [input.sessionId],
      };
    }

    const lock: ResourceLock = {
      resource: input.resource,
      mode: own?.mode === 'write' ? 'write' : input.mode,
      ownerSessionId: input.sessionId,
      ownerClientId: session.clientId,
      acquiredAt: own?.acquiredAt ?? new Date().toISOString(),
      expiresAt: this.expiry(input.leaseSeconds),
    };
    owners.set(input.sessionId, lock);
    this.locks.set(input.resource, owners);
    return { acquired: true, lock };
  }

  /** Releases a lock only when it belongs to the requesting session. */
  releaseLock(sessionId: string, resource: string): { released: boolean; resource: string } {
    this.cleanupExpired();
    const owners = this.locks.get(resource);
    if (!owners?.has(sessionId)) return { released: false, resource };
    owners.delete(sessionId);
    if (owners.size === 0) this.locks.delete(resource);
    return { released: true, resource };
  }

  /** Returns active sessions, locks, and tasks, optionally filtered by project. */
  listState(projectId?: string) {
    this.cleanupExpired();
    const tasks = [...this.tasks.values()].filter(
      (task) => !projectId || task.projectId === projectId,
    );
    return {
      sessions: [...this.sessions.values()],
      locks: [...this.locks.values()].flatMap((owners) => [...owners.values()]),
      tasks,
    };
  }

  /** Creates a pending task owned by a registered execution session. */
  createTask(input: {
    taskId: string;
    projectId: string;
    title: string;
    description?: string;
    ownerSessionId: string;
  }): CoordinationTask {
    this.cleanupExpired();
    const owner = this.requireSession(input.ownerSessionId);
    if (this.tasks.has(input.taskId)) {
      throw new ConflictException('Task ID already exists');
    }
    const now = new Date().toISOString();
    const task: CoordinationTask = {
      ...input,
      ownerClientId: owner.clientId,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };
    this.tasks.set(task.taskId, task);
    return task;
  }

  /** Updates a task as its owner, or explicitly transfers it to this session. */
  updateTask(input: {
    taskId: string;
    sessionId: string;
    status?: CoordinationTaskStatus;
    takeover?: boolean;
  }): CoordinationTask {
    this.cleanupExpired();
    const session = this.requireSession(input.sessionId);
    const task = this.tasks.get(input.taskId);
    if (!task) throw new NotFoundException('Task not found');
    if (task.ownerSessionId !== input.sessionId && input.takeover !== true) {
      throw new ConflictException(
        'Task is owned by another session; set takeover=true to take ownership',
      );
    }
    const updated = {
      ...task,
      ownerSessionId: input.takeover ? input.sessionId : task.ownerSessionId,
      ownerClientId: input.takeover ? session.clientId : task.ownerClientId,
      status: input.status ?? task.status,
      updatedAt: new Date().toISOString(),
    };
    this.tasks.set(input.taskId, updated);
    return updated;
  }

  private requireSession(sessionId: string): ExecutionSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new NotFoundException('Execution session not found; register this session first');
    }
    return session;
  }

  private expiry(seconds = DEFAULT_LEASE_SECONDS): string {
    return new Date(Date.now() + seconds * 1000).toISOString();
  }

  /** Removes expired sessions and every lock they own; sibling sessions remain active. */
  private cleanupExpired(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions) {
      if (Date.parse(session.expiresAt) <= now) {
        this.sessions.delete(sessionId);
        for (const [resource, owners] of this.locks) {
          owners.delete(sessionId);
          if (owners.size === 0) this.locks.delete(resource);
        }
      }
    }
  }
}
