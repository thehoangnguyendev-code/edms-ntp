import { api } from './client';

/** The module of a diagram, as the server names it. */
export type WorkflowModule = 'DOCUMENT_CONTROL' | 'TRAINING';

export interface WorkflowDiagramSummary {
  id: string;
  name: string;
  description: string | null;
  version: number;
  updatedByName: string;
  updatedAt: string;
}

export interface WorkflowDiagram extends WorkflowDiagramSummary {
  module: WorkflowModule;
  /** The picture in force; empty until the diagram is first saved. */
  svg: string | null;
  /** The drawing in force, shown read-only unless the person may change it; empty until the diagram is first saved. */
  xml: string | null;
  canManage: boolean;
}

export interface WorkflowDiagramVersion {
  version: number;
  reason: string;
  savedByName: string;
  savedAt: string;
}

// a signal of its own keeps a read made after a change out of the client's short cache of GETs
const fresh = () => ({ signal: new AbortController().signal });

export const workflowDiagramApi = {
  list: async (module: WorkflowModule, search?: string) =>
    (await api.get<{ data: WorkflowDiagramSummary[]; canManage: boolean }>('/workflow-diagrams', { params: { module, search: search || undefined }, ...fresh() })).data,
  get: async (id: string) => (await api.get<WorkflowDiagram>(`/workflow-diagrams/${id}`, fresh())).data,
  create: async (module: WorkflowModule, name: string, description: string) =>
    (await api.post<WorkflowDiagram>('/workflow-diagrams', { module, name, description })).data,
  saveDrawing: async (id: string, body: { version: number; xml: string; svg: string; reason: string }) =>
    (await api.put<WorkflowDiagram>(`/workflow-diagrams/${id}/drawing`, body)).data,
  rename: async (id: string, body: { name: string; description: string; reason: string }) =>
    (await api.put<WorkflowDiagram>(`/workflow-diagrams/${id}`, body)).data,
  remove: async (id: string, reason: string) => {
    await api.delete(`/workflow-diagrams/${id}`, { data: { reason } });
  },
  versions: async (id: string) => (await api.get<WorkflowDiagramVersion[]>(`/workflow-diagrams/${id}/versions`, fresh())).data,
  versionImage: async (id: string, version: number) => (await api.get<{ version: number; xml: string; svg: string }>(`/workflow-diagrams/${id}/versions/${version}`)).data,
};
