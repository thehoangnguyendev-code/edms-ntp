/**
 * Notification Types and Interfaces
 */

export type NotificationType = 
  | 'review-request'
  | 'approval'
  | 'capa-assignment'
  | 'training-completion'
  | 'document-update'
  | 'controlled-copy'
  | 'comment-reply'
  | 'deviation-assignment'
  | 'change-control'
  | 'system';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';

export type NotificationStatus = 'unread' | 'read';

export interface NotificationSummaryCounts {
  all: number;
  unread: number;
  personal: number;
  system: number;
  byType: Record<string, number>;
  /** How many notifications there are at each priority (low, medium, high, critical), read ones included. */
  byPriority: Record<string, number>;
}

export interface NotificationSummaryApiResponse {
  total?: number;
  unread?: number;
  personal?: number;
  system?: number;
  byType?: Record<string, number> | null;
  byPriority?: Record<string, number> | null;
}

export const createEmptyNotificationSummaryCounts = (): NotificationSummaryCounts => ({
  all: 0,
  unread: 0,
  personal: 0,
  system: 0,
  byType: {},
  byPriority: {},
});

export const normalizeNotificationSummaryCounts = (
  summary?: NotificationSummaryApiResponse | null,
): NotificationSummaryCounts => ({
  all: summary?.total ?? 0,
  unread: summary?.unread ?? 0,
  personal: summary?.personal ?? 0,
  system: summary?.system ?? 0,
  byType: summary?.byType ?? {},
  byPriority: summary?.byPriority ?? {},
});

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  module: string;
  priority: NotificationPriority;
  status: NotificationStatus;
  createdAt: string;
  readAt?: string;
  sender?: {
    id: string;
    fullName: string;
    avatar?: string;
  };
  relatedItem?: {
    id: string;
    type: string;
    documentNumber: string;
    title: string;
  };
  metadata?: Record<string, unknown>;
  actionUrl?: string;
  /** The icon (lucide:Name or tabler:Name) chosen for this kind of notification in Edit Notification; none means the icon of its kind. */
  icon?: string;
}

export type NotificationFilterTab = 'all' | 'for-me' | 'system';

export interface NotificationFilters {
  search: string;
  type: NotificationType | 'all';
  module: string;
  priority: NotificationPriority | 'all';
  dateFrom: string;
  dateTo: string;
}
