import type { ComponentType } from 'react';
import { GraduationCap } from 'lucide-react';
import {
  IconArchive,
  IconBadge,
  IconBell,
  IconBriefcase,
  IconBuildingSkyscraper,
  IconCertificate,
  IconChartBar,
  IconChecklist,
  IconClipboardList,
  IconCopy,
  IconCopyOff,
  IconDatabase,
  IconFileAnalytics,
  IconFileDescription,
  IconKey,
  IconLayoutGrid,
  IconMapPin,
  IconSchool,
  IconSitemap,
  IconTable,
  IconUser,
  IconUserKey,
  IconVersions,
} from '@tabler/icons-react';
import { ROUTES } from '@/app/routes.constants';
import type { GlobalSearchItem } from '@/services/api/search';

type IconType = ComponentType<{ className?: string }>;

/**
 * The icon of each kind of record: the one the sidebar gives its module (Document Control, Training Management, Reports, Security & Authorization,
 * Notifications), so the result is recognised by the same sign as the menu. The keys are the machine values of the server, never a label.
 */
export const GLOBAL_SEARCH_ICONS: Record<string, IconType> = {
  pages: IconLayoutGrid,
  documents: IconFileDescription,
  revisions: IconVersions,
  'controlled-copies': IconCopy,
  'uncontrolled-copies': IconCopyOff,
  users: IconUser,
  training: GraduationCap,
  'training-requirements': IconClipboardList,
  'training-matrices': IconTable,
  'training-assessments': IconChecklist,
  'training-job-assignments': IconBriefcase,
  'report-templates': IconFileAnalytics,
  'report-runs': IconChartBar,
  backups: IconDatabase,
  'business-units': IconBuildingSkyscraper,
  departments: IconSitemap,
  positions: IconBadge,
  'storage-locations': IconMapPin,
  'retention-policies': IconArchive,
  'degree-levels': IconCertificate,
  schools: IconSchool,
  'permission-sets': IconKey,
  'access-profiles': IconUserKey,
  notifications: IconBell,
  // the quick places of the empty box
  attention: IconBell,
  goto: IconLayoutGrid,
};

export const MIN_GLOBAL_SEARCH_LENGTH = 2;

/** A path the server sent is opened only when it stays inside this application. */
const insideApp = (path?: string | null): string | null => (path && path.startsWith('/') && !path.startsWith('//') ? path : null);

/** The kinds that have no screen per record (a matrix, an entry of a dictionary): a result opens the list screen, whose address the server sends. */
const LIST_ONLY_KINDS = new Set(['training-matrices', 'business-units', 'departments', 'positions', 'storage-locations', 'retention-policies', 'degree-levels', 'schools']);

/** Where a result opens: a page of the menu has its own path, a notification opens its own link, every other kind opens the detail screen of its id. */
export const globalSearchRoute = (groupKey: string, item: GlobalSearchItem): string | null => {
  if (LIST_ONLY_KINDS.has(groupKey)) return insideApp(item.path);
  switch (groupKey) {
    case 'pages':
      return insideApp(item.path);
    case 'notifications':
      return insideApp(item.path) ?? ROUTES.NOTIFICATIONS;
    case 'documents':
      return ROUTES.DOCUMENTS.DETAIL(item.id);
    case 'revisions':
      return ROUTES.DOCUMENTS.REVISIONS.DETAIL(item.id);
    case 'controlled-copies':
      return ROUTES.DOCUMENTS.CONTROLLED_COPIES.DETAIL(item.id);
    case 'uncontrolled-copies':
      return ROUTES.DOCUMENTS.UNCONTROLLED_COPIES.DETAIL(item.id);
    case 'users':
      return ROUTES.SETTINGS.USERS_PROFILE(item.id);
    case 'training':
      return ROUTES.TRAINING.ACTIVITY_DETAIL(item.id);
    case 'training-requirements':
      return `${ROUTES.TRAINING.REQUIREMENTS}/${item.id}`;
    case 'training-assessments':
      return `${ROUTES.TRAINING.ASSESSMENTS}/${item.id}`;
    case 'training-job-assignments':
      return `${ROUTES.TRAINING.JOB_ASSIGNMENTS}/${item.id}`;
    case 'report-templates':
      return `${ROUTES.REPORT.TEMPLATES}/${encodeURIComponent(item.id)}`;
    case 'report-runs':
      return `/report/runs/${item.id}`;
    case 'backups':
      return ROUTES.BACKUP_RESTORE.BACKUP_DETAIL(item.id);
    case 'permission-sets':
      return `${ROUTES.SECURITY.PERMISSION_SETS}/${item.id}`;
    case 'access-profiles':
      return `${ROUTES.SECURITY.ACCESS_PROFILES}/${item.id}`;
    default:
      return null;
  }
};

/** A result remembered for the next time the box opens empty. */
export interface RecentSearchItem {
  groupKey: string;
  groupLabel: string;
  item: GlobalSearchItem;
}

const RECENT_MAX = 6;

const recentKey = (userId?: string | null) => `eqms:global-search:recent:${userId ?? 'anonymous'}`;

export const readRecentSearches = (userId?: string | null): RecentSearchItem[] => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(recentKey(userId)) || '[]');
    return Array.isArray(parsed) ? parsed.filter((entry) => entry?.groupKey && entry?.item?.id).slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
};

export const rememberSearchResult = (userId: string | null | undefined, entry: RecentSearchItem): void => {
  try {
    const rest = readRecentSearches(userId).filter((e) => !(e.groupKey === entry.groupKey && e.item.id === entry.item.id));
    window.localStorage.setItem(recentKey(userId), JSON.stringify([entry, ...rest].slice(0, RECENT_MAX)));
  } catch {
    // a browser that keeps nothing simply has no list of recent results
  }
};

export const clearRecentSearches = (userId?: string | null): void => {
  try {
    window.localStorage.removeItem(recentKey(userId));
  } catch {
    // nothing to clear
  }
};
