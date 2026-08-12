import { api } from './client';
import type {
  EmailTemplate,
  EmailTemplateListParams,
  EmailTemplateListResponse,
  EmailTemplatePayload,
  EmailTemplatePreviewDraftPayload,
  EmailTemplatePublishPayload,
  EmailTemplatePreviewPayload,
  EmailTemplatePreviewResponse,
  EmailTemplateRestoreVersionPayload,
  EmailTemplateTestSendPayload,
  EmailTemplateVersion,
} from '@/features/settings/email-templates/types';

const ENDPOINT = '/settings/email-templates';

export const emailTemplateApi = {
  getEmailTemplates: async (params?: EmailTemplateListParams) => {
    const response = await api.get<EmailTemplateListResponse<EmailTemplate>>(ENDPOINT, { params });
    return response.data;
  },

  exportEmailTemplates: async (params?: EmailTemplateListParams) => {
    const response = await api.get<EmailTemplate[]>(`${ENDPOINT}/export`, { params });
    return response.data;
  },

  getEmailTemplate: async (id: string) => {
    const response = await api.get<EmailTemplate>(`${ENDPOINT}/${id}`);
    return response.data;
  },

  previewEmailTemplate: async (id: string, payload?: EmailTemplatePreviewPayload) => {
    const response = await api.post<EmailTemplatePreviewResponse>(`${ENDPOINT}/${id}/preview`, payload?.variables ?? {});
    return response.data;
  },

  previewDraftEmailTemplate: async (payload: EmailTemplatePreviewDraftPayload) => {
    const response = await api.post<EmailTemplatePreviewResponse>(`${ENDPOINT}/preview-draft`, payload);
    return response.data;
  },

  getEmailTemplateVersions: async (id: string) => {
    const response = await api.get<EmailTemplateVersion[]>(`${ENDPOINT}/${id}/versions`);
    return response.data;
  },

  createEmailTemplate: async (payload: EmailTemplatePayload) => {
    const response = await api.post<EmailTemplate>(ENDPOINT, payload);
    return response.data;
  },

  updateEmailTemplate: async (id: string, payload: Partial<EmailTemplatePayload>) => {
    const response = await api.put<EmailTemplate>(`${ENDPOINT}/${id}`, payload);
    return response.data;
  },

  deleteEmailTemplate: async (id: string) => {
    const response = await api.delete(`${ENDPOINT}/${id}`);
    return response.data;
  },

  duplicateEmailTemplate: async (id: string) => {
    const response = await api.post<EmailTemplate>(`${ENDPOINT}/${id}/duplicate`);
    return response.data;
  },

  toggleTemplateStatus: async (id: string) => {
    const response = await api.post<EmailTemplate>(`${ENDPOINT}/${id}/toggle-status`);
    return response.data;
  },

  publishEmailTemplate: async (id: string, payload?: EmailTemplatePublishPayload) => {
    const response = await api.post<EmailTemplate>(`${ENDPOINT}/${id}/publish`, payload ?? {});
    return response.data;
  },

  restoreEmailTemplateVersion: async (id: string, versionId: string, payload?: EmailTemplateRestoreVersionPayload) => {
    const response = await api.post<EmailTemplate>(`${ENDPOINT}/${id}/versions/${versionId}/restore`, payload ?? {});
    return response.data;
  },

  testSendEmailTemplate: async (id: string, payload: EmailTemplateTestSendPayload) => {
    const response = await api.post(`${ENDPOINT}/${id}/test-send`, payload);
    return response.data;
  },
};
