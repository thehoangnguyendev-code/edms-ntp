import { api } from './client';
import type { DictionaryListParams } from './dictionary';
import type {
  DocumentComponentFormData,
  DocumentComponentItem,
  DocumentNameFormatFormData,
  DocumentNameFormatItem,
} from '@/features/settings/document-administration/documentNameFormatTypes';

type PageResponse<T> = {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

const BASE = '/documents/administration';

export const documentNameFormatApi = {
  // ── Document Name Formats ─────────────────────────────────────────────
  getFormats: async (): Promise<DocumentNameFormatItem[]> => {
    const response = await api.get<DocumentNameFormatItem[]>(`${BASE}/document-name-formats`);
    return response.data;
  },

  getFormatsPage: async (params: DictionaryListParams): Promise<PageResponse<DocumentNameFormatItem>> => {
    const response = await api.get<PageResponse<DocumentNameFormatItem>>(`${BASE}/document-name-formats/page`, { params });
    return response.data;
  },

  getFormat: async (id: string): Promise<DocumentNameFormatItem> => {
    const response = await api.get<DocumentNameFormatItem>(`${BASE}/document-name-formats/${id}`);
    return response.data;
  },

  createFormat: async (payload: DocumentNameFormatFormData): Promise<DocumentNameFormatItem> => {
    const response = await api.post<DocumentNameFormatItem>(`${BASE}/document-name-formats`, payload);
    return response.data;
  },

  updateFormat: async (id: string, payload: DocumentNameFormatFormData): Promise<DocumentNameFormatItem> => {
    const response = await api.put<DocumentNameFormatItem>(`${BASE}/document-name-formats/${id}`, payload);
    return response.data;
  },

  // ── Document Components ───────────────────────────────────────────────
  getComponents: async (): Promise<DocumentComponentItem[]> => {
    const response = await api.get<DocumentComponentItem[]>(`${BASE}/document-components`);
    return response.data;
  },

  getComponentsPage: async (params: DictionaryListParams): Promise<PageResponse<DocumentComponentItem>> => {
    const response = await api.get<PageResponse<DocumentComponentItem>>(`${BASE}/document-components/page`, { params });
    return response.data;
  },

  createComponent: async (payload: DocumentComponentFormData): Promise<DocumentComponentItem> => {
    const response = await api.post<DocumentComponentItem>(`${BASE}/document-components`, payload);
    return response.data;
  },

  updateComponent: async (id: string, payload: DocumentComponentFormData): Promise<DocumentComponentItem> => {
    const response = await api.put<DocumentComponentItem>(`${BASE}/document-components/${id}`, payload);
    return response.data;
  },
};
