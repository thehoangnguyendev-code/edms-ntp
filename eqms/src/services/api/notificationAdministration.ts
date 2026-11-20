import { api } from './client';
import type { NotificationVariable, PageResponse, RecipientRule } from './notificationPolicy';

/** The channel of a notification: an in-app notification is a system event, an email notification is an email message. */
export type AdministrationChannel = 'IN_APP' | 'EMAIL';

/**
 * One notification of the administration list. `id` opens it: the event code of an in-app notification, the id of an email message.
 * `module` and `priority` belong to events; `type` and `sent` to email messages.
 */
export interface NotificationAdministrationRow {
  id: string;
  channel: AdministrationChannel;
  name: string;
  code: string;
  description: string | null;
  module: string | null;
  priority: string | null;
  type: string | null;
  sent: number | null;
  /** ACTIVE, DRAFT or INACTIVE. */
  status: string;
  updatedAt: string | null;
}

export interface NotificationAdministrationParams {
  search?: string;
  channel?: AdministrationChannel;
  status?: string;
  module?: string;
  /** LOW, MEDIUM, HIGH or CRITICAL (notifications of events; email messages have none). */
  priority?: string;
  type?: string;
  /** SENT or NEVER_SENT (email messages). */
  usage?: string;
  /** dd/MM/yyyy */
  updatedFrom?: string;
  updatedTo?: string;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

/** A kind of recipient a notification can be given: `kind` is CONTEXT (the people the sender names) or AUDIENCE (found by the dispatcher). */
/** One thing a recipient rule can be given: a permission (code, shown by its name), a role or a department. */
export interface RecipientChoice {
  value: string;
  label: string;
  description: string;
}

/** Who one rule finds today: how many people and some of their names; a rule of the people the module names has no count. */
export interface RecipientRuleView {
  type: string;
  value: string;
  valueLabel: string;
  named: boolean;
  people: number;
  names: string[];
}

export interface RecipientPreview {
  rules: RecipientRuleView[];
  inAppPeople: number;
  emailPeople: number;
}

export interface RecipientRuleKind {
  type: string;
  kind: 'CONTEXT' | 'AUDIENCE';
  label: string;
  description: string;
  needsValue: boolean;
  valueLabel: string | null;
}

/** An e-mail message that is also a notification of the registry: the event that is really edited. */
export interface MessageEvent {
  messageType: string;
  code: string;
  name: string;
  module: string;
}

export const notificationAdministrationApi = {
  /** The e-mail messages that are notifications of the registry. */
  messageEvents: async () => (await api.get<MessageEvent[]>('/notification-administration/message-events')).data,
  /** The kinds of recipient, with the words to show. */
  /** The permissions, roles or departments a recipient rule can be given. */
  recipientValues: async (type: string) => (await api.get<RecipientChoice[]>('/notification-administration/recipient-values', { params: { type } })).data,
  /** Who a list of recipient rules reaches today. */
  recipientPreview: async (rules: RecipientRule[]) => (await api.post<RecipientPreview>('/notification-administration/recipient-preview', { rules })).data,
  recipientRules: async () => (await api.get<RecipientRuleKind[]>('/notification-administration/recipient-rules')).data,
  /** Every placeholder that can be written in the notifications of the system. */
  placeholders: async () => (await api.get<NotificationVariable[]>('/notification-administration/placeholders')).data,
  list: async (params?: NotificationAdministrationParams) =>
    (await api.get<PageResponse<NotificationAdministrationRow>>('/notification-administration', { params })).data,
};
