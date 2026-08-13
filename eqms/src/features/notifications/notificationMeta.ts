import type { NotificationType } from "./types";
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

const NOTIFICATION_TYPE_ICON_STYLES: Record<NotificationType, { bg: string; text: string }> = {
  'review-request': { bg: 'bg-blue-50', text: 'text-blue-600' },
  approval: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  'capa-assignment': { bg: 'bg-amber-50', text: 'text-amber-600' },
  'training-completion': { bg: 'bg-purple-50', text: 'text-purple-600' },
  'document-update': { bg: 'bg-cyan-50', text: 'text-cyan-600' },
  'controlled-copy': { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  'comment-reply': { bg: 'bg-slate-100', text: 'text-slate-600' },
  'deviation-assignment': { bg: 'bg-red-50', text: 'text-red-600' },
  'change-control': { bg: 'bg-indigo-50', text: 'text-indigo-600' },
  system: { bg: 'bg-slate-100', text: 'text-slate-600' },
};

export const getNotificationTypeIcon = (type?: string | null) => {
  const normalized = (type ?? 'system').toLowerCase() as NotificationType;
  return NOTIFICATION_TYPE_ICONS[normalized] ?? NOTIFICATION_TYPE_ICONS.system;
};

export const getNotificationTypeIconStyles = (type?: string | null) => {
  const normalized = (type ?? 'system').toLowerCase() as NotificationType;
  return NOTIFICATION_TYPE_ICON_STYLES[normalized] ?? NOTIFICATION_TYPE_ICON_STYLES.system;
};
