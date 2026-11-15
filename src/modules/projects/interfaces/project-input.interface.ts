export interface CreateProjectInput {
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
}
export interface ImportProjectInput {
  name?: string;
  description?: string;
  path: string;
  metadata?: Record<string, unknown>;
}
export interface ProjectIdInput {
  projectId: string;
}
export interface UpdateProjectInput extends ProjectIdInput {
  name?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}
export interface ProjectListInput {
  includeArchived?: boolean;
}
export interface DiscoverProjectsInput {
  path?: string;
  maxDepth?: number;
}
