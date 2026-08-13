import React, { useCallback, useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, User, CheckCheck, FileText, AlertTriangle, MessageCircle, UserPlus, CheckCircle, ThumbsUp, Reply, Settings, ArrowLeft, Lock } from 'lucide-react';
import { TabNav, type TabItem } from '../../ui/tabs/TabNav';
import { Button } from '../../ui/button/Button';
import { cn } from '../../ui/utils';
import { ROUTES } from '@/app/routes.constants';
import type { Notification, NotificationType } from '@/features/notifications/types';
import { AlertModal } from '../../ui/modal/AlertModal';
import { FullPageLoading } from '../../ui/loading/Loading';
import { IconArrowNarrowLeft, IconChevronLeft, IconSettings2 } from '@tabler/icons-react';
import { notificationApi, type Notification as NotificationApiItem } from '@/services/api/notifications';
import { mapNotificationToViewModel, openNotificationActionUrl } from '@/features/notifications/adapters';
import { formatNotificationDateTime } from '@/features/notifications/date';
import { emitNotificationsChanged, subscribeNotificationsChanged } from '@/features/notifications/events';
import { useNotificationRealtime } from '@/features/notifications/notificationRealtime';
import { getNotificationTypeIcon, getNotificationTypeIconStyles, getNotificationTypeLabel } from '@/features/notifications/notificationMeta';
import { createEmptyNotificationSummaryCounts, type NotificationSummaryCounts } from '@/features/notifications/types';
import { useTranslation } from '@/i18n';

interface NotificationsDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onToggle: () => void;
}

// Hook to detect mobile screen
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
};

type DropdownNotification = {
  id: string;
  status: Notification['status'];
  type: NotificationType;
  avatar: typeof Bell;
  avatarBg: string;
  avatarColor: string;
  badge: typeof Bell;
  badgeBg: string;
  title: React.ReactNode;
  time: string;
  actionUrl?: string;
};

const TYPE_UI_MAP: Record<NotificationType, Omit<DropdownNotification, 'id' | 'status' | 'type' | 'title' | 'time' | 'actionUrl'>> = {
  'review-request': {
    avatar: User,
    avatarBg: 'bg-blue-100',
    avatarColor: 'text-blue-600',
    badge: MessageCircle,
    badgeBg: 'bg-blue-500',
  },
  approval: {
    avatar: User,
    avatarBg: 'bg-emerald-100',
    avatarColor: 'text-emerald-600',
    badge: CheckCircle,
    badgeBg: 'bg-emerald-500',
  },
  'capa-assignment': {
    avatar: AlertTriangle,
    avatarBg: 'bg-amber-100',
    avatarColor: 'text-amber-600',
    badge: UserPlus,
    badgeBg: 'bg-amber-500',
  },
  'training-completion': {
    avatar: User,
    avatarBg: 'bg-purple-100',
    avatarColor: 'text-purple-600',
    badge: ThumbsUp,
    badgeBg: 'bg-purple-500',
  },
  'document-update': {
    avatar: FileText,
    avatarBg: 'bg-cyan-100',
    avatarColor: 'text-cyan-600',
    badge: CheckCircle,
    badgeBg: 'bg-cyan-500',
  },
  'controlled-copy': {
    avatar: Lock,
    avatarBg: 'bg-emerald-100',
    avatarColor: 'text-emerald-600',
    badge: CheckCircle,
    badgeBg: 'bg-emerald-500',
  },
  'comment-reply': {
    avatar: User,
    avatarBg: 'bg-slate-100',
    avatarColor: 'text-slate-600',
    badge: Reply,
    badgeBg: 'bg-slate-500',
  },
  'deviation-assignment': {
    avatar: AlertTriangle,
    avatarBg: 'bg-red-100',
    avatarColor: 'text-red-600',
    badge: UserPlus,
    badgeBg: 'bg-red-500',
  },
  'change-control': {
    avatar: FileText,
    avatarBg: 'bg-indigo-100',
    avatarColor: 'text-indigo-600',
    badge: CheckCircle,
    badgeBg: 'bg-indigo-500',
  },
  system: {
    avatar: Settings,
    avatarBg: 'bg-slate-100',
    avatarColor: 'text-slate-600',
    badge: Bell,
    badgeBg: 'bg-slate-500',
  },
};

const toDropdownNotification = (item: NotificationApiItem): DropdownNotification => {
  const viewModel = mapNotificationToViewModel(item);
  return {
    id: viewModel.id,
    status: viewModel.status,
    type: viewModel.type,
    ...TYPE_UI_MAP[viewModel.type],
    avatar: getNotificationTypeIcon(viewModel.type),
    avatarBg: getNotificationTypeIconStyles(viewModel.type).bg,
    avatarColor: getNotificationTypeIconStyles(viewModel.type).text,
    title: <span className="font-medium">{viewModel.title || viewModel.description}</span>,
    time: formatNotificationDateTime(viewModel.createdAt),
    actionUrl: viewModel.actionUrl,
  };
};

const NotificationItem: React.FC<{
  notification: DropdownNotification;
  isLast: boolean;
  onClose: () => void;
  compact?: boolean;
  onClick?: () => void;
}> = ({ notification, isLast, onClose, compact = false, onClick }) => {
  const AvatarIcon = notification.avatar;

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => {
          onClick?.();
          onClose();
        }}
        className={cn(
          "w-full flex items-start transition-all duration-200 text-left group",
          compact ? "gap-3 rounded-2xl border px-3.5 py-3 shadow-sm" : "gap-3 px-4 py-3.5",
          compact && notification.status === 'unread' ? "border-emerald-100 bg-gradient-to-br from-emerald-50 to-white shadow-emerald-100/60" : "",
          compact && notification.status !== 'unread' ? "border-slate-200 bg-white shadow-slate-200/70" : "",
          !compact && notification.status === 'unread' ? "bg-slate-50/80" : !compact ? "bg-white" : "",
          compact ? "hover:border-slate-300 hover:shadow-md" : "hover:bg-slate-100",
          !compact && !isLast && "border-b border-slate-100"
        )}
      >
        <div className={cn("relative shrink-0", compact ? "mt-0" : "mt-0.5")}>
          <div className={cn(
            "rounded-xl flex items-center justify-center ring-1 ring-inset ring-black/5 transition-transform group-hover:scale-105",
            compact ? "h-10 w-10" : "h-9 w-9",
            notification.avatarBg
          )}>
            <AvatarIcon className={cn(compact ? "h-4 w-4" : "h-4.5 w-4.5", notification.avatarColor)} />
          </div>
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className={cn(
            "text-slate-900 font-medium line-clamp-2",
            compact ? "text-[12px] leading-[1.35]" : "text-[12px] leading-tight"
          )}>
            {notification.title}
          </div>

          <div className="flex w-full items-center justify-between gap-2">
            <p className="shrink-0 text-[10px] font-medium tabular-nums text-slate-400">{notification.time}</p>
            <div className={cn(
              "inline-flex shrink-0 items-center rounded-full border bg-slate-50 text-slate-600 border-slate-200 group-hover:bg-emerald-50 group-hover:border-emerald-200 group-hover:text-emerald-700 transition-colors",
              compact ? "gap-1 px-1.5 py-0.5" : "gap-1 px-2.5 py-1"
            )}>
              <span className={cn(
                "font-bold uppercase tracking-wider opacity-70",
                compact ? "text-[7px]" : "text-[9px]"
              )}>
                {getNotificationTypeLabel(notification.type)}
              </span>
            </div>
          </div>
        </div>

        {/* Unread indicator dot */}
        {notification.status === 'unread' && (
          <div className={cn("shrink-0", compact ? "mt-1.5" : "mt-1.5")}>
            <div className={cn(
              "rounded-full bg-emerald-500 animate-pulse",
              compact ? "h-2 w-2" : "h-2 w-2"
            )} />
          </div>
        )}
      </button>
    </div>
  );
};

const NotificationSkeleton: React.FC<{ isLast?: boolean }> = ({ isLast }) => (
  <div className={cn("px-4 py-3 animate-pulse bg-white", !isLast && "border-b border-slate-100")}>
    <div className="w-full flex items-start gap-2.5">
      <div className="h-9 w-9 rounded-full bg-slate-200 shrink-0" />
      <div className="flex-1 space-y-2 py-1">
        <div className="h-2.5 bg-slate-200 rounded w-3/4" />
        <div className="flex justify-between items-center text-left">
          <div className="h-4 bg-slate-200 rounded w-12" />
          <div className="h-2 bg-slate-200 rounded w-8" />
        </div>
      </div>
    </div>
  </div>
);

// Mobile Full-Screen Notifications Component
const MobileNotificationsScreen: React.FC<{
  onClose: () => void;
  onViewAll: () => void;
  onOpenSettings: () => void;
  refreshSignal?: number;
}> = ({ onClose, onViewAll, onOpenSettings, refreshSignal }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all');
  const [mobileNotifications, setMobileNotifications] = useState<DropdownNotification[]>([]);
  const [counts, setCounts] = useState<NotificationSummaryCounts>(createEmptyNotificationSummaryCounts());

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [summary, list] = await Promise.all([
          notificationApi.getSummary(),
          notificationApi.getNotifications({
            scope: 'all',
            page: 1,
            limit: 8,
            sortBy: 'createdAt',
            sortDirection: 'desc',
          }),
        ]);
        if (cancelled) {
          return;
        }
        setCounts(summary);
        setMobileNotifications(list.data.map((item) => toDropdownNotification(item)));
      } catch (error) {
        console.error('Failed to load mobile notifications', error);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [refreshSignal]);

  const MOBILE_FILTERS: TabItem[] = [
    { id: 'all', label: t('notificationsDropdown.all'), count: counts.all },
    { id: 'unread', label: t('notificationsDropdown.unread'), count: counts.unread },
    { id: 'me', label: t('notificationsDropdown.forMe'), count: counts.personal },
    { id: 'system', label: t('notificationsDropdown.system'), count: counts.system },
  ];

  const filteredNotifications = mobileNotifications.filter(n => {
    if (activeTab === 'all') return true;
    if (activeTab === 'unread') return n.status === 'unread';
    if (activeTab === 'me') return (n.type as any) !== 'system';
    if (activeTab === 'system') return (n.type as any) === 'system';
    return true;
  });

  const handleMarkAllRead = () => {
    void notificationApi.markAllAsRead().then(async () => {
      emitNotificationsChanged();
      const [summary, list] = await Promise.all([
        notificationApi.getSummary(),
        notificationApi.getNotifications({
          scope: 'all',
          page: 1,
          limit: 8,
          sortBy: 'createdAt',
          sortDirection: 'desc',
        }),
      ]);
        setCounts(summary);
      setMobileNotifications(list.data.map((item) => toDropdownNotification(item)));
    });
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-white md:hidden"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <motion.div
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 24 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="flex h-full flex-col"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="text-slate-600 hover:text-slate-900 transition-colors flex items-center justify-center"
              aria-label={t('common.back')}
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-slate-900">{t('notificationsDropdown.title')}</h3>
              <p className="text-xs text-slate-500">
                {t('notificationsDropdown.unreadOfTotal', { unread: counts.unread, total: counts.all })}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-emerald-600 transition-colors hover:bg-emerald-50 disabled:pointer-events-none disabled:opacity-50"
            onClick={handleMarkAllRead}
            disabled={counts.unread === 0}
          >
            <CheckCheck className="h-4 w-4 text-emerald-600" />
            <span>{t('notificationsDropdown.markAllRead')}</span>
          </button>
        </div>

        <div className="border-b border-slate-100 px-4 py-3">
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {MOBILE_FILTERS.map((filter) => {
              const isActive = activeTab === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setActiveTab(filter.id)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold transition-colors",
                    isActive
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <span>{filter.label}</span>
                  {typeof filter.count === 'number' && filter.count > 0 && (
                    <span className={cn(
                      "rounded-full px-1 py-0.5 text-[9px]",
                      isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                    )}>
                      {filter.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain bg-slate-100/60 px-4 py-3 pb-28">
          {filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <Bell className="h-8 w-8 text-slate-400" />
              </div>
              <p className="text-base font-medium text-slate-900">{t('notificationsDropdown.noNotifications')}</p>
              <p className="text-sm text-slate-500 mt-1">{t('notificationsDropdown.allCaughtUp')}</p>
              <div className="mt-5 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onOpenSettings}
                  className="rounded-lg"
                >
                  {t('notificationsDropdown.settings')}
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    onViewAll();
                    onClose();
                  }}
                  className="rounded-lg"
                >
                  {t('notificationsDropdown.openCenter')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {filteredNotifications.map((notification, index) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  isLast={index === filteredNotifications.length - 1}
                  onClose={onClose}
                  compact
                  onClick={() => {
                    if (notification.actionUrl) {
                      openNotificationActionUrl(notification.actionUrl, navigate);
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/80">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenSettings}
              className="h-10 rounded-xl"
            >
              {t('notificationsDropdown.settings')}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                onViewAll();
                onClose();
              }}
              className="h-10 rounded-xl"
            >
              {t('notificationsDropdown.openCenter')}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
};

// Desktop Dropdown Component
const DesktopDropdown: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  buttonRef: React.RefObject<HTMLDivElement>;
  onViewAll: () => void;
  onOpenSettings: () => void;
  refreshSignal?: number;
}> = ({ isOpen, onClose, buttonRef, onViewAll, onOpenSettings, refreshSignal }) => {
  const { t } = useTranslation();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [notifications, setNotifications] = useState<DropdownNotification[]>([]);
  const [counts, setCounts] = useState<NotificationSummaryCounts>(createEmptyNotificationSummaryCounts());

  const handleMarkAllRead = () => {
    setIsConfirmOpen(true);
  };

  const onConfirmMarkRead = () => {
    void notificationApi.markAllAsRead().then(async () => {
      emitNotificationsChanged();
      const [summary, list] = await Promise.all([
        notificationApi.getSummary(),
        notificationApi.getNotifications({
          scope: 'all',
          page: 1,
          limit: 8,
          sortBy: 'createdAt',
          sortDirection: 'desc',
        }),
      ]);
      setCounts(summary);
      setNotifications(list.data.map((item) => toDropdownNotification(item)));
      setIsConfirmOpen(false);
    });
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [summary, list] = await Promise.all([
          notificationApi.getSummary(),
          notificationApi.getNotifications({
            scope: 'all',
            page: 1,
            limit: 8,
            sortBy: 'createdAt',
            sortDirection: 'desc',
          }),
        ]);
        if (cancelled) {
          return;
        }
        setCounts(summary);
        setNotifications(list.data.map((item) => toDropdownNotification(item)));
      } catch (error) {
        console.error('Failed to load desktop notifications', error);
      }
    };
    if (isOpen) {
      void load();
    }
    return () => {
      cancelled = true;
    };
  }, [isOpen, refreshSignal]);

  const DROPDOWN_TABS: TabItem[] = [
    { id: 'all', label: t('notificationsDropdown.all'), count: counts.all },
    { id: 'me', label: t('notificationsDropdown.forMe'), count: counts.personal },
    { id: 'system', label: t('notificationsDropdown.system'), count: counts.system },
  ];

  const filteredNotifications = notifications.filter(n => {
    if (activeTab === 'all') return true;
    if (activeTab === 'me') return (n.type as any) !== 'system';
    if (activeTab === 'system') return (n.type as any) === 'system';
    return true;
  });

  useEffect(() => {
    if (!isOpen || isConfirmOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current && !buttonRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, onClose, buttonRef, isConfirmOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 pointer-events-none">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 z-0 bg-transparent pointer-events-auto"
        onClick={() => {
          if (!isConfirmOpen) onClose();
        }}
        aria-hidden="true"
      />

      <motion.div
        ref={dropdownRef}
        initial={{ opacity: 0, scale: 0.95, y: -10, transformOrigin: 'top right' }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -10 }}
        transition={{ type: 'spring', bounce: 0, duration: 0.25 }}
        className="fixed w-[min(360px,calc(100vw-1rem))] bg-white/90 backdrop-blur-md border border-slate-200 rounded-2xl z-10 overflow-hidden pointer-events-auto flex flex-col shadow-xl"
        style={{
          top: `${buttonRef.current?.getBoundingClientRect().bottom! + window.scrollY + 8}px`,
          right: `${window.innerWidth - buttonRef.current?.getBoundingClientRect().right! - window.scrollX}px`
        }}
      >
        {/* Header */}
          <div className="flex items-center justify-between px-5 py-2">
          <h3 className="text-base font-bold text-slate-900 tracking-tight">{t('notificationsDropdown.title')}</h3>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-emerald-600 transition-colors"
              onClick={onOpenSettings}
              title={t('notificationsDropdown.settings')}
            >
              <IconSettings2 className="h-4 w-4" />
            </button>
          </div>
        </div>


        {/* Tabs */}
        <div className="px-4 pb-2">
          <TabNav
            tabs={DROPDOWN_TABS}
            activeTab={activeTab}
            onChange={setActiveTab}
            variant="pill"
            layoutId="notificationTabIndicator"
            className="w-full bg-slate-100/80"
          />
        </div>

        {/* Notifications List */}
        <div className="max-h-[420px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 hover:scrollbar-thumb-slate-300 bg-white min-h-[300px]">
          {filteredNotifications.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-sm text-slate-400">{t('notificationsDropdown.noNotificationsHere')}</p>
            </div>
          ) : (
            filteredNotifications.map((notification, index) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                isLast={index === filteredNotifications.length - 1}
                onClose={onClose}
                onClick={() => {
                  if (notification.actionUrl) {
                    openNotificationActionUrl(notification.actionUrl, navigate);
                  }
                }}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 bg-white shrink-0">
          <button
            type="button"
            className="text-[13px] font-semibold text-slate-900 hover:text-emerald-600 underline underline-offset-4 decoration-slate-300 hover:decoration-emerald-500 transition-colors"
            onClick={handleMarkAllRead}
          >
            {t('notificationsDropdown.markAllRead')}
          </button>
          <Button
            variant="outline"
            size="xs"
            onClick={() => {
              onViewAll();
              onClose();
            }}
            className="h-9 px-4 rounded-lg text-xs font-medium border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-all font-semibold"
          >
            {t('notificationsDropdown.openNotificationCenter')}
          </Button>
        </div>
      </motion.div>

      {/* Confirmation Modal */}
      <AlertModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={onConfirmMarkRead}
        title={t('notificationsDropdown.markAllRead')}
        description={t('notificationsDropdown.markAllReadConfirm')}
        type="confirm"
        confirmText={t('notificationsDropdown.confirmMarkAll')}
      />
    </div>,
    document.body
  );
};

// Removing Pinned panel related components as per request


export const NotificationsDropdown: React.FC<NotificationsDropdownProps> = ({ isOpen, onClose, onToggle }) => {
  const { t } = useTranslation();
  const notificationRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  useNotificationRealtime();
  const [isNavigatingSettings, setIsNavigatingSettings] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [isBellShaking, setIsBellShaking] = useState(false);
  const prevUnreadCountRef = useRef(0);
  const shakeTimerRef = useRef<number | null>(null);

  const loadUnreadCount = useCallback(async () => {
    try {
      const summary = await notificationApi.getSummary();
      const previous = prevUnreadCountRef.current;
      setUnreadCount(summary.unread);
      if (summary.unread > previous) {
        setIsBellShaking(true);
        if (shakeTimerRef.current) {
          window.clearTimeout(shakeTimerRef.current);
        }
        shakeTimerRef.current = window.setTimeout(() => {
          setIsBellShaking(false);
          shakeTimerRef.current = null;
        }, 700);
      }
      prevUnreadCountRef.current = summary.unread;
    } catch (error) {
      console.error('Failed to load notification summary', error);
    }
  }, []);

  useEffect(() => {
    void loadUnreadCount();
    const unsubscribe = subscribeNotificationsChanged(() => {
      setRefreshSignal((value) => value + 1);
      void loadUnreadCount();
    });
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void loadUnreadCount();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (shakeTimerRef.current) {
        window.clearTimeout(shakeTimerRef.current);
      }
    };
  }, [loadUnreadCount, isOpen]);

  const handleViewAllNotifications = () => {
    navigate(ROUTES.NOTIFICATIONS);
  };

  const handleOpenSettings = () => {
    setIsNavigatingSettings(true);
    onClose();
    setTimeout(() => {
      navigate(`${ROUTES.SETTINGS.CONFIGURATION}?tab=notification`);
      setTimeout(() => {
        setIsNavigatingSettings(false);
      }, 800);
    }, 250);
  };

  return (
    <>
      {/* Notifications Button */}
      <div ref={notificationRef} className="inline-flex">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="relative text-slate-600 hover:bg-slate-100 hover:text-emerald-600 transition-colors"
        >
          <span className="relative inline-flex items-center justify-center">
            <motion.div
              animate={
                isOpen
                  ? { rotate: [0, -20, 20, -15, 15, -10, 10, 0] }
                  : isBellShaking
                    ? { rotate: [0, -10, 10, -8, 8, -4, 4, 0], scale: [1, 1.05, 1] }
                    : { rotate: 0, scale: 1 }
              }
              transition={{ duration: 0.55 }}
              className="origin-top flex items-center justify-center"
            >
              <Bell className="h-5 w-5 md:h-6 md:w-6" />
            </motion.div>
          {unreadCount > 0 && (
            <span
              className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white shadow-sm animate-pulse"
              aria-label={t('notificationsDropdown.unreadCount', { count: unreadCount })}
              title={t('notificationsDropdown.unreadCount', { count: unreadCount })}
            />
          )}
          </span>
        </Button>
      </div>

      {/* Mobile: Full-Screen Notifications */}
      {isMobile && (
        <AnimatePresence>
          {isOpen && (
            <MobileNotificationsScreen
              onClose={onClose}
              onViewAll={handleViewAllNotifications}
              onOpenSettings={handleOpenSettings}
              refreshSignal={refreshSignal}
            />
          )}
        </AnimatePresence>
      )}

      {/* Desktop: Dropdown */}
      {!isMobile && (
        <AnimatePresence>
          {isOpen && (
            <DesktopDropdown
              isOpen={isOpen}
              onClose={onClose}
              buttonRef={notificationRef as React.RefObject<HTMLDivElement>}
              onViewAll={handleViewAllNotifications}
              onOpenSettings={handleOpenSettings}
              refreshSignal={refreshSignal}
            />
          )}
        </AnimatePresence>
      )}

      {isNavigatingSettings && <FullPageLoading text={t('common.loading')} />}
    </>
  );
};
