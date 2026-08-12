import { api } from "./client";
import type {
  PublishingPlaceholderCatalogResponse,
  PublishingPlaceholderStyleRequest,
  PublishingPlaceholderStyleResponse,
  PublishingTemplateComponentInspectionResponse,
  PublishingTemplateRequest,
  PublishingTemplateResponse,
  PublishingTemplateVersionResponse,
} from "@/features/documents/publishing/types";

export interface PublishingTemplateListParams {
  search?: string;
  status?: string;
  publishingMode?: string;
  documentType?: string;
  createdBy?: string;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface PublishingTemplateListResponse {
  data: PublishingTemplateResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const publishingTemplatesApi = {
  getTemplates: async (params?: PublishingTemplateListParams) => {
    const response = await api.get<PublishingTemplateListResponse>("/settings/publishing-templates", { params });
    return response.data;
  },

  getTemplate: async (id: string) => {
    const response = await api.get<PublishingTemplateResponse>(`/settings/publishing-templates/${id}`);
    return response.data;
  },

  getVersions: async (id: string) => {
    const response = await api.get<PublishingTemplateVersionResponse[]>(`/settings/publishing-templates/${id}/versions`);
    return response.data;
  },

  getAvailablePlaceholders: async (search?: string) => {
    const response = await api.get<PublishingPlaceholderCatalogResponse>("/settings/publishing-templates/placeholders", {
      params: search ? { search } : undefined,
    });
    return response.data;
  },

  getPlaceholderStyles: async (id: string, componentType?: string, layout?: string) => {
    const response = await api.get<PublishingPlaceholderStyleResponse[]>(
      `/settings/publishing-templates/${id}/placeholder-styles`,
      {
        params: {
          ...(componentType ? { componentType } : {}),
          ...(layout ? { layout } : {}),
        },
      },
    );
    return response.data;
  },

  savePlaceholderStyles: async (id: string, payload: PublishingPlaceholderStyleRequest[]) => {
    const response = await api.put<PublishingPlaceholderStyleResponse[]>(
      `/settings/publishing-templates/${id}/placeholder-styles`,
      payload,
    );
    return response.data;
  },

  deletePlaceholderStyle: async (id: string, componentType: string, layout: string, placeholderKey: string) => {
    await api.delete(
      `/settings/publishing-templates/${id}/placeholder-styles/${componentType}/${layout}/${encodeURIComponent(placeholderKey)}`,
    );
  },

  createTemplate: async (payload: PublishingTemplateRequest) => {
    const response = await api.post<PublishingTemplateResponse>("/settings/publishing-templates", payload);
    return response.data;
  },

  updateTemplate: async (id: string, payload: PublishingTemplateRequest) => {
    const response = await api.put<PublishingTemplateResponse>(`/settings/publishing-templates/${id}`, payload);
    return response.data;
  },

  duplicateTemplate: async (id: string) => {
    const response = await api.post<PublishingTemplateResponse>(`/settings/publishing-templates/${id}/duplicate`);
    return response.data;
  },

  toggleStatus: async (id: string) => {
    const response = await api.post<PublishingTemplateResponse>(`/settings/publishing-templates/${id}/toggle-status`);
    return response.data;
  },

  deleteTemplate: async (id: string) => {
    await api.delete(`/settings/publishing-templates/${id}`);
  },

  uploadComponent: async (id: string, componentType: "cover" | "body" | "header" | "footer" | "logo", file: File, layout?: "portrait" | "landscape") => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post<PublishingTemplateResponse>(
      `/settings/publishing-templates/${id}/components/${componentType}`,
      formData,
      {
        params: layout ? { layout } : undefined,
        headers: { 'Content-Type': undefined },
      },
    );
    return response.data;
  },

  deleteComponent: async (id: string, componentType: "cover" | "body" | "header" | "footer" | "logo", layout?: "portrait" | "landscape") => {
    const response = await api.delete<PublishingTemplateResponse>(
      `/settings/publishing-templates/${id}/components/${componentType}`,
      {
        params: layout ? { layout } : undefined,
      },
    );
    return response.data;
  },

  getComponentPreview: async (
    id: string,
    componentType: "cover" | "body" | "header" | "footer" | "logo",
    revisionId?: string,
    layout?: "portrait" | "landscape",
    previewPlaceholder?: string,
    previewText?: string,
    previewFontSize?: number,
    exactPreview?: boolean,
  ) => {
    const response = await api.get<Blob>(`/settings/publishing-templates/${id}/components/${componentType}/preview`, {
      responseType: "blob",
      params: {
        ...(revisionId ? { revisionId } : {}),
        ...(layout ? { layout } : {}),
        ...(previewPlaceholder ? { previewPlaceholder } : {}),
        ...(previewText ? { previewText } : {}),
        ...(typeof previewFontSize === "number" && Number.isFinite(previewFontSize) ? { previewFontSize } : {}),
        ...(exactPreview ? { exactPreview } : {}),
      },
    });
    return response.data;
  },

  inspectComponent: async (id: string, componentType: "cover" | "body" | "header" | "footer", revisionId?: string, layout?: "portrait" | "landscape") => {
    const response = await api.get<PublishingTemplateComponentInspectionResponse>(
      `/settings/publishing-templates/${id}/components/${componentType}/inspection`,
      {
        params: {
          ...(revisionId ? { revisionId } : {}),
          ...(layout ? { layout } : {}),
        },
      },
    );
    return response.data;
  },

  getLogoPreview: async (id: string) => {
    const response = await api.get<Blob>(`/settings/publishing-templates/${id}/components/logo/preview`, {
      responseType: "blob",
    });
    return response.data;
  },

  publishTemplate: async (id: string, changeSummary?: string) => {
    const response = await api.post<PublishingTemplateResponse>(`/settings/publishing-templates/${id}/publish`, { changeSummary });
    return response.data;
  },
};
