import { useEffect, useState } from 'react';
import { ROUTES } from '@/app/routes.constants';
import { documentApi } from '@/services/api/documents';
import { navigationApi } from '@/services/api/navigation';
import { notificationApi } from '@/services/api/notifications';
import type { NavItem } from '@/types';

export interface QuickPlace {
  id: string;
  title: string;
  path: string;
  /** How many are waiting (attention list only). */
  count?: number;
}

export interface QuickPlaces {
  /** What waits for the person: only what is more than zero. */
  attention: QuickPlace[];
  /** A few pages of their own menu to jump to. */
  goTo: QuickPlace[];
}

/** The pages offered first, in this order, when the person has them in their menu (the menu already holds only what the server lets them open). */
const PREFERRED_PAGES = ['doc-all', 'doc-owned-me', 'rev-owned-me', 'my-tasks', 'training-activities', 'report-templates', 'knowledge-base', 'sec-user-management'];
const GO_TO_MAX = 5;

const leaves = (items: NavItem[] | undefined, into: Map<string, NavItem>): void => {
  for (const item of items ?? []) {
    if (item.path) into.set(item.id, item);
    leaves(item.children, into);
  }
};

/**
 * What the box shows before anything is typed besides the recent results: the work that waits (reviews, approvals, unread notifications) and a few
 * pages to jump to. Each part comes from a call the app already makes for its own screens, so nothing is searched and nothing new is exposed; a part that
 * cannot be loaded is simply left out.
 */
export function useQuickPlaces(enabled: boolean): QuickPlaces {
  const [places, setPlaces] = useState<QuickPlaces>({ attention: [], goTo: [] });

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    void Promise.allSettled([documentApi.getPendingCounts(), notificationApi.getSummary(), navigationApi.getNavigation()]).then(([pending, summary, menu]) => {
      if (cancelled) return;
      const attention: QuickPlace[] = [];
      if (pending.status === 'fulfilled') {
        if (pending.value.pendingReview > 0) attention.push({ id: 'pending-review', title: 'Pending my review', path: ROUTES.DOCUMENTS.REVISIONS.PENDING_REVIEW, count: pending.value.pendingReview });
        if (pending.value.pendingApproval > 0) attention.push({ id: 'pending-approval', title: 'Pending my approval', path: ROUTES.DOCUMENTS.REVISIONS.PENDING_APPROVAL, count: pending.value.pendingApproval });
      }
      if (summary.status === 'fulfilled' && summary.value.unread > 0) {
        attention.push({ id: 'unread-notifications', title: 'Unread notifications', path: `${ROUTES.NOTIFICATIONS}?status=unread`, count: summary.value.unread });
      }
      const pages = new Map<string, NavItem>();
      if (menu.status === 'fulfilled') leaves(menu.value, pages);
      const goTo = PREFERRED_PAGES.flatMap((id) => {
        const item = pages.get(id);
        return item?.path ? [{ id, title: item.label, path: item.path }] : [];
      }).slice(0, GO_TO_MAX);
      setPlaces({ attention, goTo });
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return places;
}
