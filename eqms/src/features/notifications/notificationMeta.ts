import type { NotificationType } from "./types";
import { parseIconKey, withChosenIcon } from "./notificationIcons";
import { AlertTriangle, Bell, CheckCircle, FileText, Lock, MessageCircle, Reply, Settings, ThumbsUp, UserPlus, type LucideIcon } from 'lucide-react';

type NotificationTypeMeta = {
  label: string;
  badgeClassName: string;
};

const NOTIFICATION_TYPE_META: Record<NotificationType, NotificationTypeMeta> = {
  "review-request": { label: "Review", badgeClassName: "bg-blue-50 text-blue-700 border-blue-200" },
  approval: { label: "Approval", badgeClassName: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  "capa-assignment": { label: "CAPA", badgeClassName: "bg-amber-50 text-amber-700 border-amber-200" },
  "training-completion": { label: "Training", badgeClassName: "bg-purple-50 text-purple-700 border-purple-200" },
  "document-update": { label: "Document", badgeClassName: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  "controlled-copy": { label: "Controlled Copy", badgeClassName: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  "comment-reply": { label: "Reply", badgeClassName: "bg-slate-50 text-slate-700 border-slate-200" },
  "deviation-assignment": { label: "Deviation", badgeClassName: "bg-red-50 text-red-700 border-red-200" },
  "change-control": { label: "Change", badgeClassName: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  system: { label: "System", badgeClassName: "bg-slate-50 text-slate-700 border-slate-200" },
};

export const getNotificationTypeMeta = (type?: string | null) => {
  const normalized = (type ?? "system").toLowerCase() as NotificationType;
  return NOTIFICATION_TYPE_META[normalized] ?? NOTIFICATION_TYPE_META.system;
};

export const getNotificationTypeLabel = (type?: string | null) => getNotificationTypeMeta(type).label;
export const getNotificationTypeBadgeClassName = (type?: string | null) => getNotificationTypeMeta(type).badgeClassName;

const NOTIFICATION_TYPE_ICONS: Record<NotificationType, LucideIcon> = {
  'review-request': MessageCircle,
  approval: CheckCircle,
  'capa-assignment': UserPlus,
  'training-completion': ThumbsUp,
  'document-update': FileText,
  'controlled-copy': Lock,
  'comment-reply': Reply,
  'deviation-assignment': AlertTriangle,
  'change-control': Settings,
  system: Bell,
};

/** The icon of a notification: the one chosen for it in Edit Notification (Lucide or Tabler), else the icon of its kind. */
export const getNotificationTypeIcon = (type?: string | null, custom?: string | null): LucideIcon => {
  const normalized = (type ?? 'system').toLowerCase() as NotificationType;
  const base = NOTIFICATION_TYPE_ICONS[normalized] ?? NOTIFICATION_TYPE_ICONS.system;
  return (parseIconKey(custom) ? withChosenIcon(custom as string, base as never) : base) as LucideIcon;
};

/**
 * The colours of the icon tile of an in-app notification follow its priority, so that a person reads the importance at a glance: Low green, Medium yellow,
 * High and Critical red. An administrator sets the priority of a notification in Edit Notification; the colour is not chosen separately.
 */
const PRIORITY_ICON_STYLES: Record<string, { bg: string; text: string }> = {
  low: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  medium: { bg: 'bg-amber-50', text: 'text-amber-600' },
  high: { bg: 'bg-red-50', text: 'text-red-600' },
  critical: { bg: 'bg-red-50', text: 'text-red-600' },
};

export const getNotificationIconStyles = (priority?: string | null): { bg: string; text: string } =>
  PRIORITY_ICON_STYLES[(priority ?? 'medium').toLowerCase()] ?? PRIORITY_ICON_STYLES.medium;

/** The colour of a priority as a six-digit colour, for what is drawn with a colour value and not a class (the border and the time bar of a toast). Same hues as the icon tile. */
const PRIORITY_HEX: Record<string, string> = { low: '#059669', medium: '#D97706', high: '#DC2626', critical: '#DC2626' };

export const getNotificationPriorityHex = (priority?: string | null): string => PRIORITY_HEX[(priority ?? 'medium').toLowerCase()] ?? PRIORITY_HEX.medium;
