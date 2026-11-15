export interface AgentSession {
  /** Stable identity of the connected application/client. Multiple sessions may share it. */
  clientId: string;
  clientName: string;
  /** Unique identity for one tab, conversation, or execution context. */
  sessionId: string;
  connectedAt: string;
  lastHeartbeatAt: string;
  expiresAt: string;
}

export interface ResourceLock {
  resource: string;
  mode: 'read' | 'write';
  ownerSessionId: string;
  ownerClientId: string;
  acquiredAt: string;
  expiresAt: string;
}

export interface CoordinationTask {
  taskId: string;
  title: string;
  description?: string;
  projectId: string;
  ownerSessionId: string;
  ownerClientId: string;
  status: 'pending' | 'in_progress' | 'blocked' | 'completed';
  createdAt: string;
  updatedAt: string;
}
