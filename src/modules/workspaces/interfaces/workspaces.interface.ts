import type { WorkspaceStatus } from '../types/workspaces.type.js';

export interface WorkspaceRecord {
  id: string;
  name: string;
  description: string;
  workspacePath: string;
  status: WorkspaceStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface WorkspaceStore {
  version: 1;
  workspaces: WorkspaceRecord[];
}
