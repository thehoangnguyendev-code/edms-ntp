import { api } from './client';

export type PolicyStatus = 'ACTIVE' | 'DRAFT' | 'DISABLED';
export type DigestMode = 'IMMEDIATE' | 'DAILY_DIGEST' | 'WEEKLY_DIGEST';
/** The two wordings of a notification a person can edit. */
export type NotificationChannel = 'IN_APP' | 'EMAIL';

export interface PageResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface RecipientRule {
  type: string;
  value?: string;
  /** The channels this recipient is reached on (IN_APP, EMAIL); absent means every channel the notification is sent on. */
  channels?: string[];
}

export interface NotificationTemplateVersion {
  id: string;
  channel: NotificationChannel | 'ESCALATION';
  versionNumber: number;
  status: string;
  title: string | null;
  summary: string | null;
  subject: string | null;
  body: string | null;
  actionUrlTemplate: string | null;
  /** The words on the button of the email. */
  actionLabel: string | null;
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
  relatedAction: string | null;
  dataObject: string | null;
  supportedChannels: string;
  availableVariables: string | null;
  policyStatus: PolicyStatus;
  enabledChannels: string;
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
  /** The icon (lucide:Name or tabler:Name) chosen for the in-app notification; null means the icon of its kind. The colour of the icon follows the priority. */
  icon: string | null;
  /** The priority of the event in the catalog. `priority` is the one the notification is sent with: an administrator may have changed it. */
  defaultPriority: string;
}

/** One placeholder an event offers: the token to copy, what it stands for, and an example of what it becomes. */
export interface NotificationVariable {
  name: string;
  token: string;
  label: string;
  sample: string;
  /** The module whose senders fill the placeholder in; empty where it is not known. */
  module?: string | null;
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
  /** The channels it is sent on: a subset of the channels the event supports, at least one. */
  enabledChannels?: string[];
  /** The "Updated" time of the notification as it was when this person opened it; a change saved by someone else since refuses this one. */
  expectedUpdatedAt?: string;
  /** LOW, MEDIUM or HIGH. Choosing the default of the event puts the notification back to it. */
  priority?: string;
}

export interface UpdateNotificationTemplatePayload {
  title?: string | null;
  summary?: string | null;
  subject?: string | null;
  body?: string | null;
  actionUrlTemplate?: string | null;
  actionLabel?: string | null;
  changeSummary?: string | null;
  /** See UpdateNotificationPolicyPayload.expectedUpdatedAt. */
  expectedUpdatedAt?: string;
}

export interface NotificationPreviewPayload {
  channel?: NotificationChannel;
  title?: string | null;
  summary?: string | null;
  subject?: string | null;
  body?: string | null;
  actionUrlTemplate?: string | null;
  actionLabel?: string | null;
}

export interface NotificationPreviewResult {
  renderedTitle: string | null;
  renderedSummary: string | null;
  renderedSubject: string | null;
  renderedBody: string | null;
  renderedActionUrl: string | null;
  /** The whole mail (frame, message, button) for the email channel; null for in-app. */
  renderedHtml: string | null;
}

const ENDPOINT = '/notification-policies';
const event = (eventCode: string) => `${ENDPOINT}/${encodeURIComponent(eventCode)}`;

/**
 * The notifications of the system are fixed: a person edits their wording and their channels, but never creates or deletes one (the code
 * that raises an event is what makes it real), so there is no create or delete here.
 */
export const notificationPolicyApi = {
  getDetail: async (eventCode: string) => {
    const response = await api.get<NotificationPolicyDetail>(event(eventCode));
    return response.data;
  },

  variables: async (eventCode: string) => {
    const response = await api.get<NotificationVariable[]>(`${event(eventCode)}/variables`);
    return response.data;
  },

  updatePolicy: async (eventCode: string, payload: UpdateNotificationPolicyPayload) => {
    const response = await api.put<NotificationPolicyDetail>(event(eventCode), payload);
    return response.data;
  },

  /** Sends the published email, with example values, to one address. */
  /** Chooses the icon of the in-app notification; an empty value goes back to the icon of its kind. */
  updateAppearance: async (eventCode: string, icon: string | null, expectedUpdatedAt?: string) => {
    const response = await api.put<NotificationPolicyDetail>(`${event(eventCode)}/appearance`, { icon, expectedUpdatedAt });
    return response.data;
  },

  testSend: async (eventCode: string, to: string) => {
    await api.post(`${event(eventCode)}/test-send`, { to });
  },

  updateTemplate: async (eventCode: string, channel: NotificationChannel, payload: UpdateNotificationTemplatePayload) => {
    const response = await api.put<NotificationTemplateVersion>(`${event(eventCode)}/templates/${channel}`, payload);
    return response.data;
  },

  preview: async (eventCode: string, payload: NotificationPreviewPayload) => {
    const response = await api.post<NotificationPreviewResult>(`${event(eventCode)}/preview`, { channel: 'IN_APP', ...payload });
    return response.data;
  },
};
