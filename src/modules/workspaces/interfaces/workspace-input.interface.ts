export interface CreateWorkspaceInput {
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
}
export interface ImportWorkspaceInput {
  name?: string;
  description?: string;
  path: string;
  metadata?: Record<string, unknown>;
}
export interface WorkspaceIdInput {
  workspaceId: string;
}
export interface UpdateWorkspaceInput extends WorkspaceIdInput {
  name?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}
export interface WorkspaceListInput {
  includeArchived?: boolean;
}
export interface DiscoverWorkspacesInput {
  path?: string;
  maxDepth?: number;
}
