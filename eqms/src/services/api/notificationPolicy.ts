import { api } from './client';

export type ComplianceGroup = 'GMP_MANDATORY' | 'COMPLIANCE' | 'OPTIONAL';
export type PolicyStatus = 'ACTIVE' | 'DRAFT' | 'DISABLED';
export type DigestMode = 'IMMEDIATE' | 'DAILY_DIGEST' | 'WEEKLY_DIGEST';

export interface PageResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface NotificationPolicySummary {
  eventCode: string;
  name: string;
  description: string | null;
  module: string;
  priority: string;
  complianceGroup: ComplianceGroup;
  mandatory: boolean;
  policyStatus: PolicyStatus;
  escalationEnabled: boolean;
  updatedAt: string;
}

export interface RecipientRule {
  type: string;
  value?: string;
}

export interface NotificationTemplateVersion {
  id: string;
  versionNumber: number;
  status: string;
  title: string | null;
  summary: string | null;
  actionUrlTemplate: string | null;
  variablesUsed: string | null;
  changeSummary: string | null;
  createdByName: string | null;
  createdAt: string;
}

export interface NotificationPolicyDetail {
  eventCode: string;
  name: string;
  description: string | null;
  module: string;
  priority: string;
  complianceGroup: ComplianceGroup;
  relatedAction: string | null;
  dataObject: string | null;
  availableVariables: string | null;
  mandatory: boolean;
  mandatoryReason: string | null;
  policyStatus: PolicyStatus;
  recipientRules: RecipientRule[];
  digestMode: DigestMode;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  escalationEnabled: boolean;
  escalationAfterMinutes: number | null;
  escalationRecipientRules: RecipientRule[];
  updatedByName: string | null;
  updatedAt: string;
  activeTemplates: NotificationTemplateVersion[];
}

export interface UpdateNotificationPolicyPayload {
  status?: PolicyStatus;
  recipientRules?: RecipientRule[];
  digestMode?: DigestMode;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  escalationEnabled?: boolean;
  escalationAfterMinutes?: number | null;
  escalationRecipientRules?: RecipientRule[];
}

export interface UpdateNotificationTemplatePayload {
  title?: string | null;
  summary?: string | null;
  actionUrlTemplate?: string | null;
  changeSummary?: string | null;
}

export interface NotificationPreviewPayload {
  title?: string | null;
  summary?: string | null;
  actionUrlTemplate?: string | null;
}

export interface NotificationPreviewResult {
  renderedTitle: string | null;
  renderedSummary: string | null;
  renderedActionUrl: string | null;
}

export interface CreateNotificationEventPayload {
  code: string;
  name: string;
  description?: string | null;
  module: string;
  priority: string;
  complianceGroup: ComplianceGroup;
  relatedAction?: string | null;
  dataObject?: string | null;
  availableVariables?: string | null;
  actionUrlTemplate?: string | null;
  mandatory: boolean;
  mandatoryReason?: string | null;
}

export interface NotificationPolicyListParams {
  search?: string;
  module?: string;
  complianceGroup?: string;
  status?: string;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

const ENDPOINT = '/notification-policies';
const CHANNEL = 'IN_APP';

export const notificationPolicyApi = {
  list: async (params?: NotificationPolicyListParams) => {
    const response = await api.get<PageResponse<NotificationPolicySummary>>(ENDPOINT, { params });
    return response.data;
  },

  getDetail: async (eventCode: string) => {
    const response = await api.get<NotificationPolicyDetail>(`${ENDPOINT}/${encodeURIComponent(eventCode)}`);
    return response.data;
  },

  updatePolicy: async (eventCode: string, payload: UpdateNotificationPolicyPayload) => {
    const response = await api.put<NotificationPolicyDetail>(`${ENDPOINT}/${encodeURIComponent(eventCode)}`, payload);
    return response.data;
  },

  updateTemplate: async (eventCode: string, payload: UpdateNotificationTemplatePayload) => {
    const response = await api.put<NotificationTemplateVersion>(
      `${ENDPOINT}/${encodeURIComponent(eventCode)}/templates/${CHANNEL}`,
      payload,
    );
    return response.data;
  },

  getHistory: async (eventCode: string) => {
    const response = await api.get<NotificationTemplateVersion[]>(
      `${ENDPOINT}/${encodeURIComponent(eventCode)}/templates/${CHANNEL}/history`,
    );
    return response.data;
  },

  restoreVersion: async (eventCode: string, versionId: string) => {
    const response = await api.post<NotificationTemplateVersion>(
      `${ENDPOINT}/${encodeURIComponent(eventCode)}/templates/${CHANNEL}/restore/${versionId}`,
    );
    return response.data;
  },

  preview: async (eventCode: string, payload: NotificationPreviewPayload) => {
    const response = await api.post<NotificationPreviewResult>(`${ENDPOINT}/${encodeURIComponent(eventCode)}/preview`, {
      channel: CHANNEL,
      ...payload,
    });
    return response.data;
  },

  create: async (payload: CreateNotificationEventPayload) => {
    const response = await api.post<NotificationPolicySummary>(ENDPOINT, payload);
    return response.data;
  },

  remove: async (eventCode: string) => {
    await api.delete(`${ENDPOINT}/${encodeURIComponent(eventCode)}`);
  },
};
