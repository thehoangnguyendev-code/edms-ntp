import type {
  Notification as NotificationViewModel,
  NotificationPriority,
  NotificationType,
} from './types';
import type { Notification as NotificationApiItem } from '@/services/api/notifications';

const NOTIFICATION_TYPE_MAP: Record<string, NotificationType> = {
  'review-request': 'review-request',
  'document-review': 'review-request',
  approval: 'approval',
  'document-approval': 'approval',
  'capa-assignment': 'capa-assignment',
  'training-completion': 'training-completion',
  'training-notification': 'training-completion',
  'document-update': 'document-update',
  'document-publish': 'document-update',
  'document-edit-online-notification': 'document-update',
  'comment-reply': 'comment-reply',
  'deviation-assignment': 'deviation-assignment',
  'change-control': 'change-control',
  'controlled-copy-notification': 'controlled-copy',
  'controlled-copy-distribution-notification': 'controlled-copy',
  'controlled-copy-cancellation-notification': 'controlled-copy',
  'controlled-copy-recall-notification': 'controlled-copy',
  system: 'system',
};

const PRIORITY_MAP: Record<string, NotificationPriority> = {
  low: 'low',
  medium: 'medium',
  high: 'high',
  critical: 'critical',
};

export const normalizeNotificationType = (value?: string | null): NotificationType => {
  if (!value) {
    return 'system';
  }
  return NOTIFICATION_TYPE_MAP[value.toLowerCase()] ?? 'system';
};

export const normalizeNotificationPriority = (value?: string | null): NotificationPriority => {
  if (!value) {
    return 'medium';
  }
  return PRIORITY_MAP[value.toLowerCase()] ?? 'medium';
};

export const mapNotificationToViewModel = (item: NotificationApiItem): NotificationViewModel => {
  const relatedItem = item.relatedItem?.documentNumber
    ? {
        id: item.relatedItem.id ?? item.id,
        type: item.relatedItem.type ?? 'document',
        documentNumber: item.relatedItem.documentNumber,
        title: item.relatedItem.title ?? '',
      }
    : undefined;

  return {
    id: item.id,
    type: normalizeNotificationType(item.type),
    title: item.title,
    description: item.description,
    module: item.module || 'System',
    priority: normalizeNotificationPriority(item.priority),
    status: item.status?.toLowerCase() === 'read' ? 'read' : 'unread',
    createdAt: item.createdAt,
    readAt: item.readAt ?? undefined,
    sender: item.sender
      ? {
          id: item.sender.id,
          fullName: item.sender.fullName,
          avatar: undefined,
        }
      : undefined,
    relatedItem,
    metadata: item.metadata ?? undefined,
    actionUrl: item.actionUrl ?? undefined,
  };
};

/**
 * Notification actionUrls can be a relative in-app route (e.g. `/documents/{id}`) or an absolute,
 * token-secured public link (e.g. controlled copy preview) that must NOT go through SPA routing —
 * doing so would 404/reroute since it isn't a registered app route, and would also bypass the
 * point of a standalone public link (no login/permission check needed for the recipient).
 */
export const isAbsoluteNotificationUrl = (url?: string | null): boolean =>
  !!url && /^https?:\/\//i.test(url);

export const openNotificationActionUrl = (
  actionUrl: string,
  navigate: (path: string) => void,
) => {
  if (isAbsoluteNotificationUrl(actionUrl)) {
    window.open(actionUrl, '_blank', 'noopener,noreferrer');
    return;
  }
  navigate(actionUrl);
};

export const getNotificationTypeLabel = (type: NotificationType) => {
  switch (type) {
    case 'review-request':
      return 'Review';
    case 'approval':
      return 'Approval';
    case 'capa-assignment':
      return 'CAPA';
    case 'training-completion':
      return 'Training';
    case 'document-update':
      return 'Document';
    case 'controlled-copy':
      return 'Controlled Copy';
    case 'comment-reply':
      return 'Reply';
    case 'deviation-assignment':
      return 'Deviation';
    case 'change-control':
      return 'Change';
    case 'system':
    default:
      return 'System';
  }
};
