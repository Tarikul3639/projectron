import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  AgentSession,
  CoordinationTask,
  ResourceLock,
} from '../interfaces/agent-coordination.interface.js';
import type {
  LockAcquireResult,
  ResourceLockMode,
  CoordinationTaskStatus,
} from '../types/agent-coordination.type.js';

const DEFAULT_LEASE_SECONDS = 60;

@Injectable()
export class AgentCoordinationService {
  /** Session ID is the coordination principal; client ID is descriptive metadata only. */
  private readonly agents = new Map<string, AgentSession>();
  private readonly locks = new Map<string, Map<string, ResourceLock>>();
  private readonly tasks = new Map<string, CoordinationTask>();

  /**
   * Registers one independent execution session (for example, one browser tab).
   * Omitting sessionId creates a fresh identity; pass an existing sessionId only to reconnect it.
   */
  registerAgent(input: {
    clientId: string;
    clientName: string;
    sessionId?: string;
    leaseSeconds?: number;
  }): AgentSession {
    this.cleanupExpired();
    const sessionId = input.sessionId ?? randomUUID();
    const now = new Date();
    const existing = this.agents.get(sessionId);
    if (existing && existing.clientId !== input.clientId) {
      throw new ConflictException('Session ID is already registered to another client');
    }
    const session: AgentSession = {
      sessionId,
      clientId: input.clientId,
      clientName: input.clientName,
      connectedAt: existing?.connectedAt ?? now.toISOString(),
      lastHeartbeatAt: now.toISOString(),
      expiresAt: this.expiry(input.leaseSeconds),
    };
    this.agents.set(sessionId, session);
    return session;
  }

  /** Renews only the specified session and the locks owned by that session. */
  heartbeat(sessionId: string, leaseSeconds?: number): AgentSession {
    this.cleanupExpired();
    const current = this.agents.get(sessionId);
    if (!current) {
      throw new NotFoundException('Agent session not found; register this session first');
    }
    const now = new Date().toISOString();
    const session = {
      ...current,
      lastHeartbeatAt: now,
      expiresAt: this.expiry(leaseSeconds),
    };
    this.agents.set(sessionId, session);
    for (const [resource, owners] of this.locks) {
      const lock = owners.get(sessionId);
      if (lock) owners.set(sessionId, { ...lock, expiresAt: session.expiresAt });
      if (owners.size === 0) this.locks.delete(resource);
    }
    return session;
  }

  /**
   * Acquires a shared read lock or exclusive write lock.
   * Locks are isolated by session, even when multiple sessions share one clientId.
   */
  acquireLock(input: {
    sessionId: string;
    resource: string;
    mode: ResourceLockMode;
    leaseSeconds?: number;
  }): LockAcquireResult {
    this.cleanupExpired();
    const session = this.requireAgent(input.sessionId);
    const owners =
      this.locks.get(input.resource) ?? new Map<string, ResourceLock>();
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

    if (own && own.mode === 'read' && input.mode === 'write') {
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

  /** Releases a resource lock only when it belongs to the requesting session. */
  releaseLock(
    sessionId: string,
    resource: string,
  ): { released: boolean; resource: string } {
    this.cleanupExpired();
    const owners = this.locks.get(resource);
    if (!owners?.has(sessionId)) return { released: false, resource };
    owners.delete(sessionId);
    if (owners.size === 0) this.locks.delete(resource);
    return { released: true, resource };
  }

  /** Returns active sessions, locks, and tasks; optional project filtering applies to tasks. */
  listState(projectId?: string) {
    this.cleanupExpired();
    const tasks = [...this.tasks.values()].filter(
      (task) => !projectId || task.projectId === projectId,
    );
    return {
      agents: [...this.agents.values()],
      sessions: [...this.agents.values()],
      locks: [...this.locks.values()].flatMap((owners) => [...owners.values()]),
      tasks,
    };
  }

  /** Creates a pending task owned by a registered session. */
  createTask(input: {
    taskId: string;
    projectId: string;
    title: string;
    description?: string;
    ownerSessionId: string;
  }): CoordinationTask {
    this.cleanupExpired();
    const owner = this.requireAgent(input.ownerSessionId);
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

  /** Updates a task as its owning session, or explicitly transfers it to the requesting session. */
  updateTask(input: {
    taskId: string;
    sessionId: string;
    status?: CoordinationTaskStatus;
    takeover?: boolean;
  }): CoordinationTask {
    this.cleanupExpired();
    const session = this.requireAgent(input.sessionId);
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

  private requireAgent(sessionId: string): AgentSession {
    const agent = this.agents.get(sessionId);
    if (!agent) {
      throw new NotFoundException('Agent session not found; register this session first');
    }
    return agent;
  }

  private expiry(seconds = DEFAULT_LEASE_SECONDS): string {
    return new Date(Date.now() + seconds * 1000).toISOString();
  }

  /** Removes expired sessions and every lock they own; sibling sessions remain active. */
  private cleanupExpired(): void {
    const now = Date.now();
    for (const [sessionId, agent] of this.agents) {
      if (Date.parse(agent.expiresAt) <= now) {
        this.agents.delete(sessionId);
        for (const [resource, owners] of this.locks) {
          owners.delete(sessionId);
          if (owners.size === 0) this.locks.delete(resource);
        }
      }
    }
  }
}
