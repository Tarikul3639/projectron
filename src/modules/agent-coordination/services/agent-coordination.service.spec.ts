import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { AgentCoordinationService } from './agent-coordination.service.js';

describe('AgentCoordinationService', () => {
  it('allows multiple readers on the same resource across sessions', () => {
    const service = new AgentCoordinationService();
    const a = service.registerAgent({ clientId: 'same-client', clientName: 'Tab A' });
    const b = service.registerAgent({ clientId: 'same-client', clientName: 'Tab B' });
    expect(service.acquireLock({ sessionId: a.sessionId, resource: 'src/a.ts', mode: 'read' }).acquired).toBe(true);
    expect(service.acquireLock({ sessionId: b.sessionId, resource: 'src/a.ts', mode: 'read' }).acquired).toBe(true);
  });

  it('treats two sessions from the same client as separate lock owners', () => {
    const service = new AgentCoordinationService();
    const a = service.registerAgent({ clientId: 'chatgpt', clientName: 'ChatGPT Tab 1' });
    const b = service.registerAgent({ clientId: 'chatgpt', clientName: 'ChatGPT Tab 2' });
    expect(service.acquireLock({ sessionId: a.sessionId, resource: 'shared.ts', mode: 'write' }).acquired).toBe(true);
    expect(service.acquireLock({ sessionId: b.sessionId, resource: 'shared.ts', mode: 'write' })).toMatchObject({
      acquired: false,
      currentOwners: [a.sessionId],
    });
  });

  it('blocks readers while another session owns a write lock', () => {
    const service = new AgentCoordinationService();
    const a = service.registerAgent({ clientId: 'a', clientName: 'Agent A' });
    const b = service.registerAgent({ clientId: 'b', clientName: 'Agent B' });
    service.acquireLock({ sessionId: a.sessionId, resource: 'src/a.ts', mode: 'write' });
    expect(service.acquireLock({ sessionId: b.sessionId, resource: 'src/a.ts', mode: 'read' })).toMatchObject({ acquired: false });
  });

  it('blocks writers while readers hold locks', () => {
    const service = new AgentCoordinationService();
    const a = service.registerAgent({ clientId: 'a', clientName: 'Agent A' });
    const b = service.registerAgent({ clientId: 'b', clientName: 'Agent B' });
    service.acquireLock({ sessionId: a.sessionId, resource: 'src/a.ts', mode: 'read' });
    expect(service.acquireLock({ sessionId: b.sessionId, resource: 'src/a.ts', mode: 'write' })).toMatchObject({ acquired: false });
  });

  it('requires a registered session before locking', () => {
    const service = new AgentCoordinationService();
    expect(() => service.acquireLock({ sessionId: 'missing', resource: 'x', mode: 'read' })).toThrow(NotFoundException);
  });

  it('refreshing one session does not replace a sibling session', () => {
    const service = new AgentCoordinationService();
    const a = service.registerAgent({ clientId: 'same-client', clientName: 'Tab A' });
    const b = service.registerAgent({ clientId: 'same-client', clientName: 'Tab B' });
    const reconnected = service.registerAgent({ clientId: 'same-client', clientName: 'Tab A', sessionId: a.sessionId });
    expect(reconnected.sessionId).toBe(a.sessionId);
    expect(service.listState().agents).toHaveLength(2);
    expect(service.listState().agents.map((agent) => agent.sessionId)).toContain(b.sessionId);
  });

  it('allows explicit task takeover and rejects implicit takeover between sessions', () => {
    const service = new AgentCoordinationService();
    const a = service.registerAgent({ clientId: 'same-client', clientName: 'Tab A' });
    const b = service.registerAgent({ clientId: 'same-client', clientName: 'Tab B' });
    service.createTask({
      taskId: 'task-1',
      projectId: 'p1',
      title: 'Implement feature',
      ownerSessionId: a.sessionId,
    });
    expect(() => service.updateTask({ taskId: 'task-1', sessionId: b.sessionId, status: 'in_progress' })).toThrow(ConflictException);
    expect(service.updateTask({ taskId: 'task-1', sessionId: b.sessionId, takeover: true }).ownerSessionId).toBe(b.sessionId);
  });
});
