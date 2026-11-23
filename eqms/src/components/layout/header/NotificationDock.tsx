import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ROUTES } from '@/app/routes.constants';
import { subscribeNotificationsChanged } from '@/features/notifications/events';
import { useNotificationDock } from './NotificationDockContext';
import { FEED_MAX_ITEMS, FEED_PAGE_SIZE, NotificationPanel, NotificationShowMore, countForTab, useNotificationFeed } from './NotificationsDropdown';
import { tr } from "@/i18n";

export const DOCK_WIDTH = 380;
/** How many notifications the dock asks for first, and how many more each "Show more" adds. */
export const DOCK_PAGE_SIZE = FEED_PAGE_SIZE;
/** The server does not cap the page size, so the screen does: past this the Notification Center is the place to read. */
export const DOCK_MAX_ITEMS = FEED_MAX_ITEMS;

/**
 * The notification list pinned to the right of the layout, under the top bar. It shows more at once than the dropdown, keeps
 * itself up to date from the same change events, and gives way to the dropdown again when the user unpins it.
 */
export const NotificationDock: React.FC = () => {
  const { docked, unpin, focusRequest } = useNotificationDock();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [limit, setLimit] = useState(DOCK_PAGE_SIZE);
  const [refreshSignal, setRefreshSignal] = useState(0);

  useEffect(() => subscribeNotificationsChanged(() => setRefreshSignal((value) => value + 1)), []);

  // Pressing the bell while the list is already at the side moves attention to it.
  useEffect(() => {
    if (focusRequest > 0 && docked) headingRef.current?.focus();
  }, [focusRequest, docked]);

  const { notifications, counts, loaded, markAllAsRead, tab, setTab } = useNotificationFeed(docked, limit, refreshSignal);
  const total = countForTab(counts, tab);
  const hasMore = loaded && notifications.length < total && limit < DOCK_MAX_ITEMS;

  return (
    <AnimatePresence initial={false}>
      {docked && (
        <motion.aside
          key="notification-dock"
          aria-label={tr("Pinned notifications")}
          data-testid="notification-dock"
          initial={reduceMotion ? false : { width: 0, opacity: 0 }}
          animate={{ width: DOCK_WIDTH, opacity: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { width: 0, opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.3, ease: [0.2, 0.8, 0.3, 1] }}
          className="relative z-10 h-full shrink-0 overflow-hidden border-l border-slate-300 bg-white shadow-[-12px_0_32px_-12px_rgba(15,23,42,0.3)]"
        >
          {/* The inner box keeps its width while the aside grows, so nothing re-wraps during the slide. */}
          <div className="h-full" style={{ width: DOCK_WIDTH }}>
            <NotificationPanel
              variant="dock"
              notifications={notifications}
              counts={counts}
              loaded={loaded}
              tab={tab}
              onTabChange={setTab}
              onItemOpened={() => undefined}
              onViewAll={() => navigate(ROUTES.NOTIFICATIONS)}
              onOpenSettings={() => navigate(ROUTES.SETTINGS.CONFIGURATION_NOTIFICATIONS)}
              onMarkAllRead={() => void markAllAsRead()}
              pin={{ pinned: true, onToggle: unpin }}
              headingRef={headingRef}
              listFooter={hasMore ? <NotificationShowMore shown={notifications.length} total={total} onClick={() => setLimit((value) => Math.min(value + DOCK_PAGE_SIZE, DOCK_MAX_ITEMS))} /> : undefined}
            />
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
};
