/**
 * Prompt Specification API Service
 *
 * This module is the typed front-end companion for the prompt/spec registry
 * exposed by the Spring Boot back-end.
 */

import { api } from './client';
import type { PromptSpecificationSpec } from '@/types';

export type PromptSpecificationStatus = 'DRAFT' | 'READY' | 'GENERATED' | 'ARCHIVED';

export type PromptGenerationRunStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface GeneratedArtifact {
  id: string;
  artifactType: string;
  filePath: string;
  contentHash?: string | null;
  createdAt: string;
}

export interface PromptGenerationRun {
  id: string;
  status: PromptGenerationRunStatus;
  targetFrontendPath?: string | null;
  targetBackendPath?: string | null;
  targetDatabasePath?: string | null;
  generatedAt: string;
  notes?: string | null;
  artifacts: GeneratedArtifact[];
}

export interface PromptSpecificationSummary {
  id: string;
  moduleName: string;
  promptTitle: string;
  status: PromptSpecificationStatus;
  createdAt: string;
  updatedAt: string;
  generationRunCount: number;
}

export interface PromptSpecification {
  id: string;
  moduleName: string;
  promptTitle: string;
  promptText: string;
  specPayload: Record<string, unknown>;
  status: PromptSpecificationStatus;
  createdAt: string;
  updatedAt: string;
  generationRuns: PromptGenerationRun[];
}

export interface CreatePromptSpecificationPayload {
  moduleName: string;
  promptTitle: string;
  promptText: string;
  specPayload: PromptSpecificationSpec;
}

export interface CreatePromptGenerationRunPayload {
  targetFrontendPath?: string;
  targetBackendPath?: string;
  targetDatabasePath?: string;
  notes?: string;
}

export const promptSpecApi = {
  async list() {
    const response = await api.get<PromptSpecificationSummary[]>('/prompt-specs');
    return response.data;
  },

  async getById(id: string) {
    const response = await api.get<PromptSpecification>(`/prompt-specs/${id}`);
    return response.data;
  },

  async create(payload: CreatePromptSpecificationPayload) {
    const response = await api.post<PromptSpecification>('/prompt-specs', payload);
    return response.data;
  },

  async createRun(id: string, payload: CreatePromptGenerationRunPayload) {
    const response = await api.post<PromptGenerationRun>(`/prompt-specs/${id}/runs`, payload);
    return response.data;
  },
};
