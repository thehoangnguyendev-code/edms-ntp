import { api } from './client';
import type { PaginatedResponse } from '@/types';
import {
  normalizeNotificationSummaryCounts,
  type NotificationSummaryApiResponse,
  type NotificationSummaryCounts,
} from '@/features/notifications/types';

const ENDPOINT = '/notifications';
const SUMMARY_CACHE_TTL_MS = 5000;
let summaryCache: { expiresAt: number; value: NotificationSummaryCounts } | null = null;
let summaryRequest: Promise<NotificationSummaryCounts> | null = null;
const invalidateSummary = () => { summaryCache = null; };

export interface NotificationUser {
  id: string;
  username: string;
  fullName: string;
  employeeCode?: string | null;
  email?: string | null;
  roleName?: string | null;
  position?: string | null;
  department?: string | null;
  businessUnit?: string | null;
}

export interface NotificationRelatedItem {
  id?: string | null;
  type?: string | null;
  documentNumber?: string | null;
  title?: string | null;
}

export interface Notification {
  id: string;
  type: string;
  scope: string;
  title: string;
  description: string;
  module: string;
  moduleKey?: string | null;
  priority: string;
  status: string;
  createdAt: string;
  readAt?: string | null;
  deletedAt?: string | null;
  actionUrl?: string | null;
  sender?: NotificationUser | null;
  recipient?: NotificationUser | null;
  relatedItem?: NotificationRelatedItem | null;
  metadata?: Record<string, unknown> | null;
}

export interface GetNotificationsParams {
  scope?: 'all' | 'personal' | 'system' | 'for-me';
  search?: string;
  type?: string;
  module?: string;
  priority?: string;
  status?: string;
  sender?: string;
  relatedNumber?: string;
  relatedTitle?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface NotificationPreferences {
  channels: { email: boolean; inApp: boolean; push: boolean };
  modules: Record<string, boolean>;
}

export interface NotificationDeliveryFailure {
  id: string;
  recipient: string;
  notificationType: string;
  eventDomain?: string | null;
  errorMessage?: string | null;
  attempts: number;
  createdAt: string;
  lastAttemptAt: string;
  status: string;
}

const buildQueryString = (params?: GetNotificationsParams) => {
  const query = new URLSearchParams();
  if (!params) {
    return query.toString();
  }
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });
  return query.toString();
};

export const notificationApi = {
  getNotifications: async (params?: GetNotificationsParams) => {
    const query = buildQueryString(params);
    const response = await api.get<PaginatedResponse<Notification>>(
      query ? `${ENDPOINT}?${query}` : ENDPOINT,
    );
    return response.data;
  },

  getSummary: async (): Promise<NotificationSummaryCounts> => {
    if (summaryCache && summaryCache.expiresAt > Date.now()) return summaryCache.value;
    if (summaryRequest) return summaryRequest;
    summaryRequest = api.get<NotificationSummaryApiResponse>(`${ENDPOINT}/summary`)
      .then((response) => normalizeNotificationSummaryCounts(response.data))
      .then((value) => {
        summaryCache = { expiresAt: Date.now() + SUMMARY_CACHE_TTL_MS, value };
        return value;
      })
      .finally(() => { summaryRequest = null; });
    return summaryRequest;
  },

  getDeliveryFailures: async (page = 1, limit = 20) => {
    const response = await api.get<PaginatedResponse<NotificationDeliveryFailure>>(
      `${ENDPOINT}/delivery-failures?page=${page}&limit=${limit}`,
    );
    return response.data;
  },

  retryDeliveryFailure: async (id: string) => {
    const response = await api.post<NotificationDeliveryFailure>(`${ENDPOINT}/delivery-failures/${id}/retry`);
    return response.data;
  },

  markAsRead: async (id: string) => {
    const response = await api.put<Notification>(`${ENDPOINT}/${id}/read`);
    invalidateSummary();
    return response.data;
  },

  markAllAsRead: async () => {
    const response = await api.put(`${ENDPOINT}/read-all`);
    invalidateSummary();
    return response.data;
  },

  markGroupAsRead: async (ids: string[]) => {
    const response = await api.put(`${ENDPOINT}/read`, { ids });
    invalidateSummary();
    return response.data;
  },

  deleteNotification: async (id: string) => {
    const response = await api.delete(`${ENDPOINT}/${id}`);
    invalidateSummary();
    return response.data;
  },

  deleteNotifications: async (ids: string[]) => {
    const response = await api.delete(ENDPOINT, { data: { ids } });
    invalidateSummary();
    return response.data;
  },

  clearAllRead: async () => {
    const response = await api.delete(`${ENDPOINT}/clear-all`);
    invalidateSummary();
    return response.data;
  },

  getPreferences: async () => {
    const response = await api.get<NotificationPreferences>(`${ENDPOINT}/preferences`);
    return response.data;
  },

  updatePreferences: async (prefs: Partial<NotificationPreferences>) => {
    const response = await api.put<NotificationPreferences>(`${ENDPOINT}/preferences`, prefs);
    return response.data;
  },
};
