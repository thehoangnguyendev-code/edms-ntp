﻿import React, { useCallback, useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Bell, CheckCheck, Clock, Pin, PinOff, type LucideIcon } from 'lucide-react';
import { Button } from '../../ui/button/Button';
import { cn } from '../../ui/utils';
import { ROUTES } from '@/app/routes.constants';
import type { Notification } from '@/features/notifications/types';
import { FullPageLoading } from '../../ui/loading/Loading';
import { IconSettings2 } from '@tabler/icons-react';
import { notificationApi, type GetNotificationsParams, type Notification as NotificationApiItem } from '@/services/api/notifications';
import { mapNotificationToViewModel, openNotificationActionUrl } from '@/features/notifications/adapters';
import { formatNotificationDateTime, formatNotificationRelativeTime, notificationDayGroup, type NotificationDayGroup } from '@/features/notifications/date';
import { emitNotificationsChanged, subscribeNotificationsChanged } from '@/features/notifications/events';
import { useNotificationRealtime } from '@/features/notifications/notificationRealtime';
import { getNotificationTypeIcon, getNotificationTypeLabel } from '@/features/notifications/notificationMeta';
import { createEmptyNotificationSummaryCounts, type NotificationSummaryCounts } from '@/features/notifications/types';
import { moduleDisplayName } from '@/utils/moduleDisplay';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useNotificationDock } from './NotificationDockContext';
import { useNotificationEntrance } from './useNotificationEntrance';
import { tr, trFormat } from "@/i18n";

interface NotificationsDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onToggle: () => void;
}

/** How many notifications a long list (the dock, the phone screen) asks for first, and how many more each "Show more" adds. */
export const FEED_PAGE_SIZE = 25;
/** The server does not cap the page size, so the screen does: past this the Notification Center is the place to read. */
export const FEED_MAX_ITEMS = 100;

export type DropdownNotification = {
  id: string;
  status: Notification['status'];
  icon: LucideIcon;
  /** low | medium | high | critical: the colour of the bar at the left of the row. */
  priority: string;
  title: string;
  /** The text of the in-app notification, shown under the title (empty when it only repeats the title). */
  body: string;
  /** The module as the menu names it (the type of the notification when it has none). */
  source: string;
  createdAt: string;
  actionUrl?: string;
};

const toDropdownNotification = (item: NotificationApiItem): DropdownNotification => {
  const viewModel = mapNotificationToViewModel(item);
  return {
    id: viewModel.id,
    status: viewModel.status,
    icon: getNotificationTypeIcon(viewModel.type, viewModel.icon),
    priority: (viewModel.priority || 'medium').toLowerCase(),
    title: viewModel.title || viewModel.description,
    body: viewModel.title && viewModel.description && viewModel.description !== viewModel.title ? viewModel.description : '',
    source: viewModel.module ? moduleDisplayName(viewModel.module) : getNotificationTypeLabel(viewModel.type),
    createdAt: viewModel.createdAt,
    actionUrl: viewModel.actionUrl,
  };
};

export type NotificationTab = 'all' | 'unread' | 'me' | 'system';

/** What each tab asks the server for: the tab is a filter of the server, never a cut of the few notifications that happen to be loaded. */
const TAB_QUERY: Record<NotificationTab, Pick<GetNotificationsParams, 'scope' | 'status'>> = {
  all: { scope: 'all' },
  unread: { scope: 'all', status: 'unread' },
  me: { scope: 'personal' },
  system: { scope: 'system' },
};

/** How many notifications the server has for a tab. */
export const countForTab = (counts: NotificationSummaryCounts, tab: NotificationTab): number =>
  tab === 'unread' ? counts.unread : tab === 'me' ? counts.personal : tab === 'system' ? counts.system : counts.all;

const GROUP_LABEL: Record<NotificationDayGroup, string> = { today: 'Today', yesterday: 'Yesterday', earlier: 'Earlier' };

/** The bar at the left of a row follows the priority of the notification. */
const PRIORITY_BAR: Record<string, string> = { low: 'bg-emerald-500', medium: 'bg-amber-400', high: 'bg-red-500', critical: 'bg-red-600' };

const NotificationItem: React.FC<{
  notification: DropdownNotification;
  onClose: () => void;
  large?: boolean;
  onClick?: () => void;
}> = ({ notification, onClose, large = false, onClick }) => {
  const Icon = notification.icon;
  const unread = notification.status === 'unread';
  const urgent = notification.priority === 'high' || notification.priority === 'critical';

  return (
    <div className="w-full" data-notification-id={notification.id}>
      <button
        type="button"
        onClick={() => {
          onClick?.();
          onClose();
        }}
        className={cn(
          'group relative block w-full py-3 pl-5 pr-4 text-left transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none',
          unread ? 'bg-white' : 'bg-slate-50/60',
          large && 'min-h-[76px]',
        )}
      >
        <span aria-hidden="true" className={cn('absolute inset-y-0 left-0 w-1', PRIORITY_BAR[notification.priority] ?? PRIORITY_BAR.medium, !unread && 'opacity-40')} />
        <span className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5 text-2xs font-bold uppercase tracking-wider text-slate-500">
            <Icon className="h-3 w-3 shrink-0" />
            <span className="truncate">{notification.source}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-slate-700">
            {unread && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
            {formatNotificationRelativeTime(notification.createdAt)}
          </span>
        </span>
        <span className={cn('mt-1 line-clamp-2 block text-sm font-bold leading-snug', unread ? 'text-slate-900' : 'text-slate-600')}>
          {notification.title}
        </span>
        {notification.body && <span className="mt-0.5 line-clamp-2 block text-xs font-normal leading-relaxed text-slate-600">{notification.body}</span>}
        {urgent && (
          <span className="mt-1.5 inline-flex rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-2xs font-semibold text-red-700">
            {notification.priority === 'critical' ? 'Critical' : tr('High priority')}
          </span>
        )}
        <span className="mt-2 flex items-center gap-1 text-2xs font-medium tabular-nums text-slate-500">
          <Clock className="h-3 w-3" />
          {formatNotificationDateTime(notification.createdAt)}
        </span>
        {unread && <span className="sr-only">{tr("Unread")}</span>}
      </button>
    </div>
  );
};

const NotificationSkeleton: React.FC = () => (
  <div className="flex animate-pulse items-start gap-3 border-b border-slate-100 bg-white px-4 py-3">
    <div className="h-10 w-10 shrink-0 rounded-xl bg-slate-200" />
    <div className="flex-1 space-y-2 py-1">
      <div className="h-2.5 w-3/4 rounded bg-slate-200" />
      <div className="h-2 w-1/3 rounded bg-slate-200" />
    </div>
  </div>
);

/** The newest notifications of a tab and the counts of all tabs, loaded while `enabled` and again whenever `refreshSignal` changes. */
export const useNotificationFeed = (enabled: boolean, limit: number, refreshSignal?: number) => {
  const [notifications, setNotifications] = useState<DropdownNotification[]>([]);
  const [counts, setCounts] = useState<NotificationSummaryCounts>(createEmptyNotificationSummaryCounts());
  const [loaded, setLoaded] = useState(false);
  const [tab, setTabState] = useState<NotificationTab>('all');
  const loadedTab = useRef<NotificationTab>('all');

  const fetchFeed = useCallback(async () => {
    const [summary, list] = await Promise.all([
      notificationApi.getSummary(),
      notificationApi.getNotifications({ ...TAB_QUERY[tab], page: 1, limit, sortBy: 'createdAt', sortDirection: 'desc' }),
    ]);
    return { summary, items: list.data.map((item) => toDropdownNotification(item)) };
  }, [limit, tab]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    // Another tab shows other notifications: the skeleton is the honest state until they arrive. A refresh of the same tab keeps what is on screen.
    if (loadedTab.current !== tab) {
      loadedTab.current = tab;
      setLoaded(false);
    }
    void (async () => {
      try {
        const { summary, items } = await fetchFeed();
        if (cancelled) return;
        setCounts(summary);
        setNotifications(items);
        setLoaded(true);
      } catch (error) {
        console.error('Failed to load notifications', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, fetchFeed, refreshSignal, tab]);

  const markAllAsRead = useCallback(async () => {
    await notificationApi.markAllAsRead();
    emitNotificationsChanged();
    const { summary, items } = await fetchFeed();
    setCounts(summary);
    setNotifications(items);
  }, [fetchFeed]);

  return { notifications, counts, loaded, markAllAsRead, tab, setTab: setTabState };
};

/** "Show more (25 of 60)" under a long list. */
export const NotificationShowMore: React.FC<{ shown: number; total: number; onClick: () => void }> = ({ shown, total, onClick }) => (
  <div className="border-t border-slate-100 px-5 py-3 text-center">
    <button
      type="button"
      onClick={onClick}
      className="text-xs font-semibold text-emerald-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 md:text-sm"
    >
            {trFormat("Show more ({shown} of {total})", { shown, total })}
    </button>
  </div>
);

export interface NotificationPinControl {
  /** True when the list is pinned to the side, so the button offers to unpin it. */
  pinned: boolean;
  onToggle: () => void;
  disabled?: boolean;
  /** Explains a disabled button. */
  disabledReason?: string;
}

export interface NotificationPanelProps {
  /** `popover` is the dropdown under the bell; `dock` fills the pinned side panel; `screen` is the full-screen list on a phone. */
  variant: 'popover' | 'dock' | 'screen';
  notifications: DropdownNotification[];
  counts: NotificationSummaryCounts;
  loaded: boolean;
  tab: NotificationTab;
  onTabChange: (tab: NotificationTab) => void;
  /** Called after an item was opened (the dropdown closes itself, the dock stays). */
  onItemOpened: () => void;
  onViewAll: () => void;
  onOpenSettings: () => void;
  onMarkAllRead: () => void;
  /** Not on the phone screen: pinning is for the wide layout. */
  pin?: NotificationPinControl;
  /** The arrow of the phone screen. */
  onBack?: () => void;
  /** Receives keyboard focus when the bell is pressed while the list is already docked. */
  headingRef?: React.Ref<HTMLHeadingElement>;
  /** Shown under the list, e.g. a "Show more" button. */
  listFooter?: React.ReactNode;
}

/** The list the dropdown, the pinned dock and the phone screen share: title with actions, tabs, notifications by day, one footer button. */
export const NotificationPanel: React.FC<NotificationPanelProps> = ({
  variant, notifications, counts, loaded, tab, onTabChange, onItemOpened, onViewAll, onOpenSettings, onMarkAllRead, pin, onBack, headingRef, listFooter,
}) => {
  const navigate = useNavigate();
  const isDock = variant === 'dock';
  const isScreen = variant === 'screen';
  const scrollRef = useRef<HTMLDivElement>(null);

  // Only the unread number is worth a glance; the totals of the other tabs run into thousands and only crowd the row.
  const tabs: { id: NotificationTab; label: string; badge: number }[] = [
    { id: 'all', label: 'All', badge: 0 },
    { id: 'unread', label: 'Unread', badge: counts.unread },
    { id: 'me', label: 'For Me', badge: 0 },
    { id: 'system', label: 'System', badge: 0 },
  ];

  useNotificationEntrance(scrollRef, notifications.map((n) => n.id), loaded);

  const groups = (['today', 'yesterday', 'earlier'] as const)
    .map((group) => ({ group, items: notifications.filter((n) => notificationDayGroup(n.createdAt) === group) }))
    .filter(({ items }) => items.length > 0);

  const iconButton = cn('grid shrink-0 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-emerald-600 disabled:pointer-events-none disabled:opacity-40', isScreen ? 'h-11 w-11' : 'h-8 w-8');
  const pinLabel = pin?.disabled ? (pin.disabledReason ?? 'Pin to the side') : pin?.pinned ? tr('Unpin notifications') : tr('Pin notifications to the side');
  const PinIcon = pin?.pinned ? PinOff : Pin;

  return (
    <div className={cn('flex flex-col', (isDock || isScreen) && 'h-full min-h-0')}>
      <div className={cn('flex shrink-0 items-center gap-1', isScreen ? 'border-b border-slate-200 px-2 py-2' : 'px-4 pt-3')}>
        {onBack && (
          <button type="button" onClick={onBack} className={cn(iconButton, 'text-slate-600')} aria-label={tr("Back")}>
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h3 ref={headingRef} tabIndex={-1} className="text-lg font-bold leading-tight tracking-tight text-slate-900 outline-none">{tr("Notifications")}</h3>
          <p className="text-xs text-slate-500">{counts.unread > 0 ? `${counts.unread} unread` : tr('All caught up')}</p>
        </div>
        <button
          type="button"
          className={cn(iconButton, 'text-emerald-600')}
          onClick={onMarkAllRead}
          disabled={counts.unread === 0}
          aria-label={tr("Mark all as read")}
          title={tr("Mark all as read")}
        >
          <CheckCheck className="h-4 w-4" />
        </button>
        {pin && (
          <button
            type="button"
            className={cn(iconButton, pin.pinned && 'text-emerald-600')}
            onClick={pin.onToggle}
            disabled={pin.disabled}
            aria-pressed={pin.pinned}
            aria-label={pinLabel}
            title={pinLabel}
          >
            <PinIcon className="h-4 w-4" />
          </button>
        )}
        <button type="button" className={iconButton} onClick={onOpenSettings} title={tr("Notification settings")} aria-label={tr("Notification settings")}>
          <IconSettings2 className="h-4 w-4" />
        </button>
      </div>

      <div role="tablist" aria-label={tr("Show")} className="mx-4 my-3 grid shrink-0 grid-cols-4 rounded-xl bg-slate-100 p-1 text-xs font-medium">
        {tabs.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onTabChange(item.id)}
              className={cn(
                'flex items-center justify-center gap-1 rounded-lg py-1.5 transition-colors',
                active ? 'bg-white font-semibold text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900',
              )}
            >
              {item.label}
              {item.badge > 0 && <span className="grid h-4 min-w-[16px] place-items-center rounded-full bg-emerald-600 px-1 text-2xs font-bold text-white">{item.badge > 99 ? '99+' : item.badge}</span>}
            </button>
          );
        })}
      </div>

      <div
        ref={scrollRef}
        role="tabpanel"
        className={cn(
          'overflow-y-auto overscroll-contain bg-white scrollbar-thin scrollbar-thumb-slate-200 hover:scrollbar-thumb-slate-300',
          isDock || isScreen ? 'min-h-0 flex-1' : 'max-h-[420px]',
        )}
      >
        {!loaded ? (
          Array.from({ length: isDock || isScreen ? 6 : 4 }).map((_, index) => <NotificationSkeleton key={index} />)
        ) : groups.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <Bell className="mx-auto mb-3 h-8 w-8 text-slate-300" />
            <p className="text-sm font-medium text-slate-700">{tab === 'unread' ? tr('Nothing unread') : tr('No notifications here')}</p>
            <p className="mt-1 text-xs text-slate-500">{tab === 'unread' ? tr("You're all caught up.") : tr('New notifications will appear here.')}</p>
          </div>
        ) : (
          groups.map(({ group, items }) => (
            <section key={group} aria-label={GROUP_LABEL[group]}>
              <h4 className="bg-slate-50 px-4 py-1.5 text-2xs font-semibold uppercase tracking-wider text-slate-500">{GROUP_LABEL[group]}</h4>
              <div className="divide-y divide-slate-300">
                {items.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    large={isScreen}
                    onClose={onItemOpened}
                    onClick={() => {
                      if (notification.actionUrl) {
                        openNotificationActionUrl(notification.actionUrl, navigate);
                      }
                    }}
                  />
                ))}
              </div>
            </section>
          ))
        )}
        {loaded && listFooter}
      </div>

      <div className="shrink-0 border-t border-slate-100 bg-white px-4 py-3">
        <button
          type="button"
          onClick={onViewAll}
          className={cn(
            'flex w-full items-center justify-center gap-1.5 bg-emerald-600 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2',
            isScreen ? 'h-11 rounded-xl' : 'h-10 rounded-lg',
          )}
        >
          {tr("Open Notification Center")}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

// Mobile Full-Screen Notifications Component
const MobileNotificationsScreen: React.FC<{
  onClose: () => void;
  onViewAll: () => void;
  onOpenSettings: () => void;
  refreshSignal?: number;
}> = ({ onClose, onViewAll, onOpenSettings, refreshSignal }) => {
  const [limit, setLimit] = useState(FEED_PAGE_SIZE);
  const { notifications, counts, loaded, markAllAsRead, tab, setTab } = useNotificationFeed(true, limit, refreshSignal);
  const total = countForTab(counts, tab);
  const hasMore = loaded && notifications.length < total && limit < FEED_MAX_ITEMS;

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return createPortal(
    <div
      role="dialog"
      aria-label={tr("Notifications")}
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
        className="h-full"
      >
        <NotificationPanel
          variant="screen"
          notifications={notifications}
          counts={counts}
          loaded={loaded}
          tab={tab}
          onTabChange={setTab}
          onItemOpened={onClose}
          onViewAll={() => {
            onViewAll();
            onClose();
          }}
          onOpenSettings={onOpenSettings}
          onMarkAllRead={() => void markAllAsRead()}
          onBack={onClose}
          listFooter={hasMore ? <NotificationShowMore shown={notifications.length} total={total} onClick={() => setLimit((value) => Math.min(value + FEED_PAGE_SIZE, FEED_MAX_ITEMS))} /> : undefined}
        />
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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { canDock, pin } = useNotificationDock();
  const { notifications, counts, loaded, markAllAsRead, tab, setTab } = useNotificationFeed(isOpen, 8, refreshSignal);

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current && !buttonRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen, onClose, buttonRef]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 pointer-events-none">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 z-0 bg-transparent pointer-events-auto"
        onClick={onClose}
        aria-hidden="true"
      />

      <motion.div
        ref={dropdownRef}
        role="dialog"
        aria-label={tr("Notifications")}
        initial={{ opacity: 0, scale: 0.95, y: -10, transformOrigin: 'top right' }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -10 }}
        transition={{ type: 'spring', bounce: 0, duration: 0.25 }}
        className="fixed w-[min(380px,calc(100vw-1rem))] bg-white border border-slate-300 rounded-2xl z-10 overflow-hidden pointer-events-auto flex flex-col shadow-[0_16px_48px_-8px_rgba(15,23,42,0.35),0_4px_12px_-2px_rgba(15,23,42,0.12)]"
        style={{
          top: `${buttonRef.current?.getBoundingClientRect().bottom! + window.scrollY + 8}px`,
          right: `${window.innerWidth - buttonRef.current?.getBoundingClientRect().right! - window.scrollX}px`
        }}
      >
        <NotificationPanel
          variant="popover"
          notifications={notifications}
          counts={counts}
          loaded={loaded}
          tab={tab}
          onTabChange={setTab}
          onItemOpened={onClose}
          onViewAll={() => {
            onViewAll();
            onClose();
          }}
          onOpenSettings={onOpenSettings}
          onMarkAllRead={() => void markAllAsRead()}
          pin={{
            pinned: false,
            // Pinning moves the list to the side at once; the dropdown has nothing left to show.
            onToggle: () => {
              pin();
              onClose();
            },
            disabled: !canDock,
            disabledReason: 'Pinning needs a wider window',
          }}
        />
      </motion.div>
    </div>,
    document.body
  );
};


export const NotificationsDropdown: React.FC<NotificationsDropdownProps> = ({ isOpen, onClose, onToggle }) => {
  const notificationRef = useRef<HTMLDivElement>(null);
  const isMobile = useMediaQuery('(max-width: 767px)');
  const navigate = useNavigate();
  useNotificationRealtime();
  const [isNavigatingSettings, setIsNavigatingSettings] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [isBellShaking, setIsBellShaking] = useState(false);
  const prevUnreadCountRef = useRef(0);
  const dock = useNotificationDock();
  const isDocked = dock.docked && !isMobile;
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
      navigate(ROUTES.SETTINGS.CONFIGURATION_NOTIFICATIONS);
      setTimeout(() => {
        setIsNavigatingSettings(false);
      }, 800);
    }, 250);
  };

  const unreadLabel = unreadCount > 9 ? '9+' : String(unreadCount);

  return (
    <>
      {/* Notifications Button */}
      <div ref={notificationRef} className="inline-flex">
        <Button
          variant="ghost"
          size="icon"
          onClick={isDocked ? dock.requestFocus : onToggle}
          aria-label={isDocked ? tr('Notifications (pinned to the side)') : 'Notifications'}
          aria-pressed={isDocked ? true : undefined}
          className="relative text-slate-600 hover:bg-transparent hover:text-emerald-600 transition-colors"
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
                className="absolute -right-2 -top-2 grid h-4 min-w-[16px] place-items-center rounded-full bg-red-500 px-1 text-2xs font-bold leading-none text-white ring-2 ring-white"
                title={`${unreadCount} unread notifications`}
              >
                <span aria-hidden="true">{unreadLabel}</span>
                <span className="sr-only">{unreadCount} {tr("unread notifications")}</span>
              </span>
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
      {!isMobile && !isDocked && (
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

      {isNavigatingSettings && <FullPageLoading text="Loading..." />}
    </>
  );
};
