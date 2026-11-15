import { Injectable } from '@nestjs/common';
import { Tool } from '@nestjs/mcp';
import * as s from '../schemas/agent-coordination.schemas.js';
import { AgentCoordinationService } from '../services/agent-coordination.service.js';

@Injectable()
export class AgentCoordinationTools {
  constructor(private readonly coordination: AgentCoordinationService) {}

  /** Creates a distinct session by default; reuse sessionId only to reconnect the same tab or execution context. */
  @Tool({
    name: 'agent_register',
    description:
      'Register one execution session in Projectron. Each browser tab or independent task should register separately; the returned sessionId must be used for all subsequent coordination calls in that session.',
    inputSchema: s.registerAgentSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  })
  register(input: {
    clientId: string;
    clientName: string;
    sessionId?: string;
    leaseSeconds?: number;
  }) {
    return this.coordination.registerAgent(input);
  }

  /** Renews the specified session lease and only that session's resource-lock leases. */
  @Tool({
    name: 'agent_heartbeat',
    description:
      'Renew the current execution session and its resource-lock leases. Use the sessionId returned by agent_register; call periodically while this session is active.',
    inputSchema: s.heartbeatAgentSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  })
  heartbeat(input: { sessionId: string; leaseSeconds?: number }) {
    return this.coordination.heartbeat(input.sessionId, input.leaseSeconds);
  }

  /** Requests a shared or exclusive lock owned by this execution session, not the whole client. */
  @Tool({
    name: 'agent_acquire_resource_lock',
    description:
      'Acquire a shared read lock or exclusive write lock for a resource. Lock ownership is session-scoped: two tabs belonging to the same client are treated as separate owners. Do not proceed when acquired=false.',
    inputSchema: s.acquireResourceLockSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  })
  acquireLock(input: {
    sessionId: string;
    resource: string;
    mode: 'read' | 'write';
    leaseSeconds?: number;
  }) {
    return this.coordination.acquireLock(input);
  }

  /** Releases only a lock held by the requesting session. */
  @Tool({
    name: 'agent_release_resource_lock',
    description:
      'Release a resource lock owned by this execution session after its operation completes. Use the same sessionId that acquired the lock.',
    inputSchema: s.releaseResourceLockSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  })
  releaseLock(input: { sessionId: string; resource: string }) {
    return this.coordination.releaseLock(input.sessionId, input.resource);
  }

  /** Lists active execution sessions, resource locks, and coordination tasks. */
  @Tool({
    name: 'agent_get_coordination_state',
    description:
      'Inspect active execution sessions, their parent client identities, resource locks, and coordination tasks.',
    inputSchema: s.listCoordinationStateSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  })
  getState(input: { projectId?: string }) {
    return this.coordination.listState(input.projectId);
  }

  /** Creates a task assigned to one registered execution session. */
  @Tool({
    name: 'agent_create_task',
    description:
      'Create a uniquely identified shared task and assign it to a registered execution session using ownerSessionId.',
    inputSchema: s.createCoordinationTaskSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  })
  createTask(input: {
    taskId: string;
    projectId: string;
    title: string;
    description?: string;
    ownerSessionId: string;
  }) {
    return this.coordination.createTask(input);
  }

  /** Updates a task as its owner session or explicitly transfers ownership to this session. */
  @Tool({
    name: 'agent_update_task',
    description:
      'Update a task owned by this session, or explicitly take it over with takeover=true. Use sessionId, not clientId.',
    inputSchema: s.updateCoordinationTaskSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  })
  updateTask(input: {
    taskId: string;
    sessionId: string;
    status?: 'pending' | 'in_progress' | 'blocked' | 'completed';
    takeover?: boolean;
  }) {
    return this.coordination.updateTask(input);
  }
}
