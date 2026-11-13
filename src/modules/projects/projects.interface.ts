export type ProjectStatus = 'active' | 'archived';

export interface ProjectRecord {
  id: string;
  name: string;
  description: string;
  workspacePath: string;
  status: ProjectStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface ProjectStore {
  version: 1;
  projects: ProjectRecord[];
}
