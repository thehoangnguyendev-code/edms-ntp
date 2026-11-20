import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, CheckCheck, Trash2, MoreVertical, MoreHorizontal, Eye, Download, X, ListChecks, TriangleAlert, RefreshCw, Check } from "lucide-react";
import { IconFilter2 } from "@tabler/icons-react";
import { downloadTableExcel } from "@/services/api/tableExport";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { notifications as notificationsBreadcrumb } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { PortalDropdownMenu } from "@/components/ui/dropdown";
import { usePortalDropdown } from "@/hooks";
import { Button } from "@/components/ui/button/Button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/select/Select";
import { DateRangePicker } from "@/components/ui/datetime-picker/DateRangePicker";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { cn } from "@/components/ui/utils";
import { StatusBadge, Badge, type BadgeColor } from "@/components/ui/badge";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import { FilterDrawer, FilterAccordionItem } from "@/components/ui/filter/FilterDrawer";
import { FilterOptionButton } from "@/components/ui/filter/FilterOptionButton";
import { ConfiguredDesktopFilters } from "@/components/ui/filter/ConfiguredDesktopFilters";
import { ClearFiltersButton } from "@/components/ui/filter/ClearFiltersButton";
import { FilterSearchInput } from "@/components/ui/filter/FilterSearchInput";
import { useBranding } from "@/components/branding/BrandLogo";
import { SEARCH_DEBOUNCE_MS } from "@/constants/search";
import { moduleDisplayName, moduleSelectOptions } from "@/utils/moduleDisplay";
import { notificationApi } from "@/services/api/notifications";
import { mapNotificationToViewModel, openNotificationActionUrl } from "./adapters";
import { emitNotificationsChanged, subscribeNotificationsChanged } from "./events";
import type { Notification, NotificationPriority, NotificationFilterTab, NotificationSummaryCounts } from "./types";
import { createEmptyNotificationSummaryCounts } from "./types";
import { formatNotificationDateTime, notificationDayGroup, notificationDayKey, type NotificationDayGroup } from "./date";
import { getNotificationTypeIcon, getNotificationIconStyles } from "./notificationMeta";

/** The modules that send notifications, for the filter of the inbox (the names of the menu; the server finds every spelling of a module in the table). */
const INBOX_MODULES = ["documents", "controlled-copies", "training", "reports", "access-review", "security", "backup", "audit-trail"];
/** The tab "High": the server takes several priorities separated by commas, and Critical is drawn like High. */
const URGENT = "critical,high";

const STATUS_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Unread Only", value: "unread" },
  { label: "Read Only", value: "read" },
];
const PRIORITY_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Critical / High", value: URGENT },
  { label: "Critical", value: "critical" },
  { label: "High", value: "high" },
  { label: "Medium", value: "medium" },
  { label: "Low", value: "low" },
];
const SCOPE_OPTIONS: { label: string; value: NotificationFilterTab }[] = [
  { label: "All", value: "all" },
  { label: "For Me", value: "for-me" },
  { label: "Systems", value: "system" },
];

const PRIORITY_COLOR: Record<NotificationPriority, BadgeColor> = { critical: "red", high: "red", medium: "amber", low: "emerald" };
const PRIORITY_DOT: Record<NotificationPriority, string> = { critical: "bg-red-500", high: "bg-red-500", medium: "bg-amber-500", low: "bg-emerald-500" };

const GROUP_LABEL: Record<NotificationDayGroup, string> = { today: "Today", yesterday: "Yesterday", earlier: "Earlier" };

type InboxLayout = "TABS" | "TIMELINE";
type PriorityTabId = "all" | "high" | "medium" | "low" | "unread";

/** "20/11/2026" for one day, "17/11 - 18/11/2026" for several: the days a heading of the inbox covers. */
const daysCovered = (items: Notification[]) => {
  const keys = Array.from(new Set(items.map((n) => notificationDayKey(n.createdAt)).filter(Boolean)));
  if (keys.length === 0) return "";
  if (keys.length === 1) return keys[0];
  return `${keys[keys.length - 1].slice(0, 5)} - ${keys[0]}`;
};

/** The notifications of the page under their headings (Today, Yesterday, Earlier), in the order the server sent them. */
const groupByDay = (items: Notification[]) => {
  const groups: { id: NotificationDayGroup; items: Notification[] }[] = [];
  for (const item of items) {
    const id = notificationDayGroup(item.createdAt);
    const group = groups.find((g) => g.id === id);
    if (group) group.items.push(item);
    else groups.push({ id, items: [item] });
  }
  return groups;
};

const reviewerSequenceLabel = (notification: Notification) => {
  const metadata = notification.metadata as Record<string, unknown> | undefined;
  const current = String(metadata?.reviewerSequenceCurrent ?? "").trim();
  const next = String(metadata?.reviewerSequenceNext ?? "").trim();
  const currentName = String(metadata?.reviewerCurrentName ?? "").trim();
  const nextName = String(metadata?.reviewerNextName ?? "").trim();
  const total = String(metadata?.reviewerTotalCount ?? "").trim();
  if (!current && !next && !currentName && !nextName && !total) return "";
  const totalLabel = total ? ` / ${total}` : "";
  if (current && currentName) return `${currentName} • ${current}${totalLabel}`;
  if (current) return `Reviewer ${current}${totalLabel}`;
  if (nextName) return `Next: ${nextName}${next ? ` • ${next}` : ""}`;
  return "";
};

const NotificationActionsDropdown: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  position: { top: number; left: number; showAbove?: boolean };
  notification: Notification;
  onMarkAsRead: () => void;
  onDelete: () => void;
  onView: () => void;
}> = ({ isOpen, onClose, position, notification, onMarkAsRead, onDelete, onView }) => {
  const item = "flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 active:bg-slate-100 transition-colors";
  return (
    <PortalDropdownMenu isOpen={isOpen} onClose={onClose} position={position} minWidth={160}>
      <div className="py-1">
        {notification.actionUrl && (
          <button onClick={(e) => { e.stopPropagation(); onView(); onClose(); }} className={item}>
            <Eye className="h-4 w-4 flex-shrink-0" />
            <span className="font-medium">Open</span>
          </button>
        )}
        {notification.status === "unread" && (
          <button onClick={(e) => { e.stopPropagation(); onMarkAsRead(); onClose(); }} className={item}>
            <Check className="h-4 w-4 flex-shrink-0" />
            <span className="font-medium">Mark as Read</span>
          </button>
        )}
        <button onClick={(e) => { e.stopPropagation(); onDelete(); onClose(); }} className={item}>
          <Trash2 className="h-4 w-4 flex-shrink-0" />
          <span className="font-medium">Delete</span>
        </button>
      </div>
    </PortalDropdownMenu>
  );
};

interface ItemProps {
  notification: Notification;
  isSelected: boolean;
  showCheckbox: boolean;
  onOpen: (notification: Notification) => void;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleSelect: (id: string) => void;
  getRef: (id: string) => React.RefObject<HTMLButtonElement | null>;
  onToggleMenu: (id: string, e: React.MouseEvent<HTMLButtonElement>) => void;
}

const FOCUS_RING = "rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2";

/** The icon tile: its colour is the priority (Low green, Medium yellow, High and Critical red); the priority is also written for a screen reader. */
const IconTile: React.FC<{ notification: Notification; className?: string }> = ({ notification, className }) => {
  const Icon = getNotificationTypeIcon(notification.type, notification.icon);
  const colors = getNotificationIconStyles(notification.priority);
  const unread = notification.status === "unread";
  return (
    <div className="relative shrink-0">
      <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-inset ring-black/5 transition-transform duration-200 group-hover:-rotate-3 group-hover:scale-110 motion-reduce:transform-none motion-reduce:transition-none md:h-10 md:w-10", colors.bg, !unread && "opacity-60", className)}>
        <Icon className={cn("h-4 w-4 md:h-5 md:w-5", colors.text)} />
      </div>
      {unread && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500 md:h-3 md:w-3" />}
      <span className="sr-only">Priority: {notification.priority}</span>
    </div>
  );
};

/** Priority tabs layout: one plain line per notification. The whole line opens the record it is about; the buttons at its right do not. */
const InboxRow: React.FC<ItemProps> = ({ notification, isSelected, showCheckbox, onOpen, onMarkAsRead, onDelete, onToggleSelect, getRef, onToggleMenu }) => {
  const unread = notification.status === "unread";
  return (
    <li
      className={cn(
        "group relative flex items-start gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 md:px-5 transition-colors",
        unread ? "bg-emerald-50/40 hover:bg-emerald-50/60" : "bg-white hover:bg-emerald-50/50",
        isSelected && "!bg-emerald-50",
      )}
    >
      {/* the bar at the left: an unread line has it always and it widens on hover; a read line grows it from the middle */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-y-0 left-0 w-1 transition-transform duration-200 motion-reduce:transition-none",
          unread ? "origin-left bg-emerald-500 group-hover:scale-x-[2.5]" : "scale-y-0 bg-emerald-300 group-hover:scale-y-100",
        )}
      />
      {showCheckbox && (
        <span className="mt-2.5">
          <Checkbox checked={isSelected} onChange={() => onToggleSelect(notification.id)} aria-label="Select notification" className="min-h-0" />
        </span>
      )}
      <IconTile notification={notification} />
      <button type="button" onClick={() => onOpen(notification)} className={cn("min-w-0 flex-1 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transform-none motion-reduce:transition-none", FOCUS_RING)}>
        <span className={cn("block break-words pr-8 text-pretty text-xs line-clamp-2 transition-colors group-hover:text-emerald-700 md:pr-0 md:text-sm", unread ? "font-bold text-slate-900" : "font-medium text-slate-500")}>{notification.title}</span>
        <span className={cn("mt-0.5 block max-w-2xl break-words text-pretty text-xs line-clamp-1 md:text-sm", unread ? "text-slate-600" : "text-slate-500")}>{notification.description}</span>
        <span className="mt-1 block text-xs tabular-nums text-slate-500 md:hidden">{formatNotificationDateTime(notification.createdAt)}</span>
      </button>
      <div className="relative hidden h-9 w-40 shrink-0 items-center justify-end md:flex">
        <span className="text-xs tabular-nums text-slate-500 transition-opacity group-focus-within:opacity-0 group-hover:opacity-0">{formatNotificationDateTime(notification.createdAt)}</span>
        <span className="absolute inset-0 flex items-center justify-end gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          {unread && (
            <button type="button" aria-label="Mark as read" title="Mark as read" onClick={() => onMarkAsRead(notification.id)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-600 hover:bg-slate-200">
              <Eye className="h-4 w-4" />
            </button>
          )}
          <button type="button" aria-label="Delete" title="Delete" onClick={() => onDelete(notification.id)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-600 hover:bg-red-50 hover:text-red-600">
            <Trash2 className="h-4 w-4" />
          </button>
        </span>
      </div>
      <button
        ref={getRef(notification.id)}
        type="button"
        aria-label="More actions"
        onClick={(e) => onToggleMenu(notification.id, e)}
        className="absolute right-1 top-1.5 grid h-10 w-10 place-items-center rounded-lg text-slate-600 hover:bg-slate-200 md:hidden"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
    </li>
  );
};

/** Timeline layout: a card on the timeline, a dot coloured by its priority. */
const TimelineCard: React.FC<ItemProps> = ({ notification, isSelected, showCheckbox, onOpen, onToggleSelect, getRef, onToggleMenu }) => {
  const unread = notification.status === "unread";
  const related = notification.relatedItem?.documentNumber;
  const reviewer = reviewerSequenceLabel(notification);
  return (
    <li className="group relative">
      <span aria-hidden="true" className={cn("absolute -left-[31px] top-4 h-3 w-3 rounded-full ring-4 ring-white transition-transform duration-200 group-hover:scale-150 motion-reduce:transition-none", PRIORITY_DOT[notification.priority] ?? "bg-amber-500")} />
      <div
        className={cn(
          "flex items-start gap-3 rounded-xl border p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none md:p-4",
          unread ? "border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50/60" : "border-slate-200 bg-white hover:bg-slate-50",
          isSelected && "!bg-emerald-50",
        )}
      >
        {showCheckbox && (
          <span className="mt-0.5">
            <Checkbox checked={isSelected} onChange={() => onToggleSelect(notification.id)} aria-label="Select notification" className="min-h-0" />
          </span>
        )}
        <button type="button" onClick={() => onOpen(notification)} className={cn("min-w-0 flex-1", FOCUS_RING)}>
          <span className="flex items-start justify-between gap-3">
            <span className={cn("min-w-0 break-words text-pretty text-sm transition-colors group-hover:text-emerald-700", unread ? "font-bold text-slate-900" : "font-medium text-slate-500")}>{notification.title}</span>
            <Badge color={PRIORITY_COLOR[notification.priority] ?? "slate"} size="sm" className="shrink-0 capitalize">{notification.priority}</Badge>
          </span>
          <span className={cn("mt-1 block break-words text-pretty text-sm line-clamp-2", unread ? "text-slate-600" : "text-slate-500")}>{notification.description}</span>
          <span className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <StatusBadge status="draft" label={moduleDisplayName(notification.module)} className="text-slate-700 bg-slate-50 border-slate-200" size="sm" />
              {related && <span className="font-mono text-xs font-medium text-emerald-700">{related}</span>}
              {reviewer && <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-2xs font-medium text-emerald-700">{reviewer}</span>}
            </span>
            <span className="text-xs tabular-nums text-slate-500">{formatNotificationDateTime(notification.createdAt)}</span>
          </span>
        </button>
        <button
          ref={getRef(notification.id)}
          type="button"
          aria-label="More actions"
          onClick={(e) => onToggleMenu(notification.id, e)}
          className="-mr-1.5 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-600 hover:bg-slate-200"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
};

const DayHeading: React.FC<{ id: NotificationDayGroup; items: Notification[] }> = ({ id, items }) => (
  <div className="mb-3 flex items-center justify-between gap-2 text-2xs font-bold uppercase tracking-wider text-slate-500 md:text-xs">
    <span>
      {GROUP_LABEL[id]}
      <span className="ml-2 font-medium normal-case tracking-normal text-slate-600">{items.length}</span>
    </span>
    <span className="font-medium normal-case tracking-normal tabular-nums text-slate-600">{daysCovered(items)}</span>
  </div>
);

const SkeletonRows: React.FC = () => (
  <ul aria-busy="true" className="divide-y divide-slate-100">
    {Array.from({ length: 6 }, (_, i) => (
      <li key={i} className="flex items-center gap-3 px-4 py-3.5 md:px-5">
        <div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-slate-100" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-3 w-2/5 animate-pulse rounded bg-slate-100" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="hidden h-3 w-28 animate-pulse rounded bg-slate-100 md:block" />
      </li>
    ))}
  </ul>
);

const EmptyState: React.FC<{ type: NotificationFilterTab; hasActiveFilters?: boolean }> = ({ type, hasActiveFilters }) => {
  const messages = {
    all: {
      title: "No notifications",
      description: hasActiveFilters ? "We couldn't find any notifications matching your filters. Try adjusting your search criteria or clear filters." : "You're all caught up!",
    },
    "for-me": {
      title: "No personal notifications",
      description: hasActiveFilters ? "We couldn't find any personal notifications matching your filters." : "You don't have any personal notifications yet.",
    },
    system: {
      title: "No system notifications",
      description: hasActiveFilters ? "We couldn't find any system notifications matching your filters." : "There are no system notifications at this time.",
    },
  };
  return <TableEmptyState title={messages[type].title} description={messages[type].description} />;
};

// --- Main View ---
export const NotificationsView: React.FC = () => {
  const { notificationInboxLayout } = useBranding();
  const layout: InboxLayout = notificationInboxLayout === "TIMELINE" ? "TIMELINE" : "TABS";
  const timeline = layout === "TIMELINE";
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [isBulkActionLoading, setIsBulkActionLoading] = useState(false);
  const { openId: openDropdownId, position: dropdownPosition, getRef, toggle: handleDropdownToggle, close: closeDropdown } = usePortalDropdown();
  const headerMenu = usePortalDropdown();
  const [isMarkAllModalOpen, setIsMarkAllModalOpen] = useState(false);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["scope", "status", "module", "priority", "time"]));

  // Filter states. `activeTab` is the scope (all, for me, systems): the Timeline layout has it as tabs, the priority tabs layout in the filter drawer.
  // They start from the address of the page: opened with ?priority=high the first render is already filtered, so the effect that writes the address back
  // has nothing to change (starting from "all" made the two effects below undo each other's work).
  const [activeTab, setActiveTab] = useState<NotificationFilterTab>(() => (searchParams.get("tab") as NotificationFilterTab) ?? "all");
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get("status") ?? "all");
  const [module, setModule] = useState(() => searchParams.get("module") ?? "all");
  const [priority, setPriority] = useState(() => searchParams.get("priority") ?? "all");
  const [dateFrom, setDateFrom] = useState(() => searchParams.get("dateFrom") ?? "");
  const [dateTo, setDateTo] = useState(() => searchParams.get("dateTo") ?? "");
  const [isTableLoading, setIsTableLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(() => Math.max(1, Number(searchParams.get("page")) || 1));
  const [itemsPerPage, setItemsPerPage] = useState(() => Number(searchParams.get("limit")) || 10);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [notificationSummary, setNotificationSummary] = useState<NotificationSummaryCounts>(createEmptyNotificationSummaryCounts());
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const hasLoadedRef = useRef(false);
  const requestSeqRef = useRef(0);
  const currentPageRef = useRef(currentPage);
  const itemsPerPageRef = useRef(itemsPerPage);
  React.useLayoutEffect(() => {
    setActiveTab((searchParams.get("tab") as NotificationFilterTab) ?? "all");
    setSearch(searchParams.get("search") ?? "");
    setStatusFilter(searchParams.get("status") ?? "all");
    setModule(searchParams.get("module") ?? "all");
    setPriority(searchParams.get("priority") ?? "all");
    setDateFrom(searchParams.get("dateFrom") ?? "");
    setDateTo(searchParams.get("dateTo") ?? "");
    setCurrentPage(Math.max(1, Number(searchParams.get("page")) || 1));
    setItemsPerPage(Number(searchParams.get("limit")) || 10);
  }, [searchParams]);
  useEffect(() => {
    const params = new URLSearchParams();
    if (activeTab !== "all") params.set("tab", activeTab);
    if (search.trim()) params.set("search", search.trim());
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (module !== "all") params.set("module", module);
    if (priority !== "all") params.set("priority", priority);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (currentPage > 1) params.set("page", String(currentPage));
    if (itemsPerPage !== 10) params.set("limit", String(itemsPerPage));
    if (params.toString() !== searchParams.toString()) setSearchParams(params, { replace: true });
  }, [activeTab, search, statusFilter, module, priority, dateFrom, dateTo, currentPage, itemsPerPage, searchParams, setSearchParams]);
  useEffect(() => { currentPageRef.current = currentPage; }, [currentPage]);
  useEffect(() => { itemsPerPageRef.current = itemsPerPage; }, [itemsPerPage]);

  const counts = useMemo(() => ({
    all: notificationSummary.all,
    forMe: notificationSummary.personal,
    system: notificationSummary.system,
    unread: notificationSummary.unread,
    high: (notificationSummary.byPriority.high ?? 0) + (notificationSummary.byPriority.critical ?? 0),
    medium: notificationSummary.byPriority.medium ?? 0,
    low: notificationSummary.byPriority.low ?? 0,
  }), [notificationSummary]);

  const SCOPE_TABS: TabItem[] = [
    { id: "all", label: "All Notifications", count: counts.all },
    { id: "for-me", label: "For Me", count: counts.forMe },
    { id: "system", label: "Systems", count: counts.system },
  ];

  const activeScope = activeTab === "for-me" ? "personal" : activeTab === "system" ? "system" : "all";

  const loadNotifications = useCallback(async (showTableSpinner = false, silentRefresh = false) => {
    const requestId = ++requestSeqRef.current;
    if (!silentRefresh) {
      if (showTableSpinner) setIsTableLoading(true);
      else if (!hasLoadedRef.current) setIsLoading(true);
      else setIsTableLoading(true);
    } else {
      setIsRefreshing(true);
    }
    try {
      const [summary, page] = await Promise.all([
        notificationApi.getSummary(),
        notificationApi.getNotifications({
          scope: activeScope,
          search: search || undefined,
          module: module === "all" ? undefined : module,
          priority: priority === "all" ? undefined : priority,
          status: statusFilter === "all" ? undefined : statusFilter,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          sortBy: "createdAt",
          sortDirection: "desc",
          page: currentPageRef.current,
          limit: itemsPerPageRef.current,
        }),
      ]);
      if (requestId !== requestSeqRef.current) return;
      setNotificationSummary(summary);
      setNotifications(page.data.map(mapNotificationToViewModel));
      setPagination(page.pagination);
      setLoadFailed(false);
      hasLoadedRef.current = true;
    } catch (error) {
      if (requestId !== requestSeqRef.current) return;
      console.error("Failed to load notifications", error);
      // an empty list would read as "all caught up": the person is told that the list could not be read, and can try again
      setLoadFailed(true);
      setNotifications([]);
      showToast({ type: "error", title: "Failed to load notifications", message: "Please try again." });
    } finally {
      if (requestId === requestSeqRef.current) {
        if (!silentRefresh) {
          setIsLoading(false);
          setIsTableLoading(false);
        } else {
          setIsRefreshing(false);
        }
      }
    }
  }, [activeScope, dateFrom, dateTo, module, priority, search, showToast, statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadNotifications(false); }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [loadNotifications, currentPage, itemsPerPage]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [currentPage, activeTab]);

  useEffect(() => {
    const unsubscribe = subscribeNotificationsChanged(() => { void loadNotifications(false, true); });
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void loadNotifications(false, true);
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadNotifications]);

  const totalPages = Math.max(1, pagination.totalPages || 1);
  const groups = useMemo(() => groupByDay(notifications), [notifications]);

  const reload = () => loadNotifications(true);
  const fail = (title: string, error: unknown) => {
    console.error(title, error);
    showToast({ type: "error", title, message: "Please try again." });
  };

  // Handlers
  const handleMarkAsRead = (id: string) => {
    void notificationApi.markAsRead(id).then(() => { emitNotificationsChanged(); return reload(); }).catch((error) => fail("Failed to mark as read", error));
  };

  /** The line opens the record it is about; reading it is what marks it read. A notification without a record is only marked read. */
  const handleOpenNotification = (notification: Notification) => {
    if (notification.status === "unread") handleMarkAsRead(notification.id);
    if (notification.actionUrl) openNotificationActionUrl(notification.actionUrl, navigate);
  };

  const handleMarkAllAsRead = () => {
    void notificationApi.markAllAsRead().then(() => { emitNotificationsChanged(); return reload(); })
      .catch((error) => fail("Failed to mark all as read", error))
      .finally(() => setIsMarkAllModalOpen(false));
  };

  const handleDeleteNotification = (id: string) => {
    void notificationApi.deleteNotification(id).then(() => { emitNotificationsChanged(); return reload(); }).catch((error) => fail("Failed to delete notification", error));
  };

  const toggleSelectOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = () => {
    setSelectedIds(new Set());
    setSelectMode(false);
  };

  const runBulk = async (action: () => Promise<unknown>, failure: string) => {
    setIsBulkActionLoading(true);
    try {
      await action();
      emitNotificationsChanged();
      clearSelection();
      await reload();
    } catch (error) {
      fail(failure, error);
    } finally {
      setIsBulkActionLoading(false);
    }
  };
  const handleBulkMarkAsRead = () => { if (selectedIds.size > 0) void runBulk(() => notificationApi.markGroupAsRead(Array.from(selectedIds)), "Failed to mark selected as read"); };
  const handleBulkDelete = () => { if (selectedIds.size > 0) void runBulk(() => notificationApi.deleteNotifications(Array.from(selectedIds)), "Failed to delete selected"); };
  const handleClearAllRead = () => { void runBulk(() => notificationApi.clearAllRead(), "Failed to clear read notifications"); };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await downloadTableExcel("notifications", {
        scope: activeScope,
        search: search || undefined,
        module: module === "all" ? undefined : module,
        priority: priority === "all" ? undefined : priority,
        status: statusFilter === "all" ? undefined : statusFilter,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        sortBy: "createdAt",
        sortDirection: "desc",
      });
    } catch (error) {
      fail("Failed to export notifications", error);
    } finally {
      setIsExporting(false);
    }
  };

  // Filters
  const handleClearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setModule("all");
    setPriority("all");
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
  };
  const hasActiveFilters = search !== "" || statusFilter !== "all" || module !== "all" || priority !== "all" || dateFrom !== "" || dateTo !== "";

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  // The priority tabs and the filters are one thing: a tab is a status and a priority, and is lit only while the filters are exactly that.
  const activePriorityTab: PriorityTabId | null =
    statusFilter === "unread" && priority === "all" ? "unread"
    : statusFilter !== "all" ? null
    : priority === "all" ? "all"
    : priority === URGENT ? "high"
    : priority === "medium" ? "medium"
    : priority === "low" ? "low"
    : null;
  const chooseTab = (tab: PriorityTabId) => {
    setStatusFilter(tab === "unread" ? "unread" : "all");
    setPriority(tab === "high" ? URGENT : tab === "medium" || tab === "low" ? tab : "all");
    setCurrentPage(1);
  };
  const PRIORITY_TABS: { id: PriorityTabId; label: string; count: number; dot: string }[] = [
    { id: "all", label: "All", count: counts.all, dot: "" },
    { id: "high", label: "High", count: counts.high, dot: "bg-red-500" },
    { id: "medium", label: "Medium", count: counts.medium, dot: "bg-amber-500" },
    { id: "low", label: "Low", count: counts.low, dot: "bg-emerald-500" },
    { id: "unread", label: "Unread", count: counts.unread, dot: "bg-emerald-700" },
  ];

  const moduleOptions = moduleSelectOptions(INBOX_MODULES);
  const allModuleOptions = [{ label: "All", value: "all" }, ...moduleOptions];
  const openRow = notifications.find((n) => n.id === openDropdownId);
  const showCheckboxes = selectMode || selectedIds.size > 0;

  const itemProps = (notification: Notification): ItemProps => ({
    notification,
    isSelected: selectedIds.has(notification.id),
    showCheckbox: showCheckboxes,
    onOpen: handleOpenNotification,
    onMarkAsRead: handleMarkAsRead,
    onDelete: handleDeleteNotification,
    onToggleSelect: toggleSelectOne,
    getRef,
    onToggleMenu: handleDropdownToggle,
  });

  /** Loading, a list that could not be read, nothing to show, or the list in the layout the administrator chose. */
  const list = isLoading ? (
    <SkeletonRows />
  ) : loadFailed ? (
    <div role="alert" className="flex flex-col items-start justify-between gap-3 px-4 py-4 sm:flex-row sm:items-center md:px-5">
      <div className="flex items-center gap-2.5 text-sm text-red-700">
        <TriangleAlert className="h-4 w-4 shrink-0" />
        Unable to load notifications. Please try again.
      </div>
      <Button variant="outline" size="sm" onClick={() => void reload()} className="gap-2">
        <RefreshCw className="h-4 w-4" />
        Try again
      </Button>
    </div>
  ) : notifications.length === 0 ? (
    <EmptyState type={activeTab} hasActiveFilters={hasActiveFilters} />
  ) : timeline ? (
    <div>
      {groups.map((group) => (
        <div key={group.id} className="mb-5 last:mb-0">
          <DayHeading id={group.id} items={group.items} />
          <ol className="ml-1.5 space-y-3 border-l-2 border-slate-200 pl-6">
            {group.items.map((notification) => <TimelineCard key={notification.id} {...itemProps(notification)} />)}
          </ol>
        </div>
      ))}
    </div>
  ) : (
    <ul>{notifications.map((notification) => <InboxRow key={notification.id} {...itemProps(notification)} />)}</ul>
  );

  const pagination_ = (
    <TablePagination
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={setCurrentPage}
      itemsPerPage={itemsPerPage}
      totalItems={pagination.total}
      onItemsPerPageChange={setItemsPerPage}
    />
  );

  const busy = (isTableLoading || isRefreshing) && !isLoading && (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70 backdrop-blur-sm">
      <SectionLoading minHeight="320px" />
    </div>
  );

  /** The tabs at the top of the card: the priorities (All, High, Medium, Low, Unread) with their counts, or on the timeline the scope. */
  const tabsRow = timeline ? (
    <TabNav
      tabs={SCOPE_TABS}
      activeTab={activeTab}
      onChange={(id) => {
        setActiveTab(id as NotificationFilterTab);
        setCurrentPage(1);
      }}
      variant="underline"
    />
  ) : (
    <div className="border-b border-slate-200">
      <div className="relative flex overflow-x-auto max-md:[mask-image:linear-gradient(to_right,#000_calc(100%-32px),transparent)]" role="tablist" aria-label="Notifications by priority">
        {PRIORITY_TABS.map((tab) => {
          const active = activePriorityTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => chooseTab(tab.id)}
              className={cn(
                "relative z-10 flex items-center gap-2 whitespace-nowrap border-r border-slate-200 px-3 py-2.5 text-xs font-medium transition-colors last:border-r-0 sm:px-4 sm:text-sm md:px-6",
                active ? "text-emerald-700" : "text-slate-600 hover:bg-slate-50 hover:text-emerald-600",
              )}
            >
              {tab.dot && <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", tab.dot)} />}
              {tab.label}
              <span className={cn("inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-2xs font-bold", active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600")}>{tab.count}</span>
              {active && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-emerald-600" />}
            </button>
          );
        })}
      </div>
    </div>
  );

  /** The filter section, as on User Management: search and Filters on a phone; on a desktop the fields and Clear Filters (or the compact filter panel of the branding). */
  const filterSection = (
    <div className="compact-filter-section px-4 pt-4 md:p-5 flex flex-col">
      <div className="px-1.5 -mx-1.5 pb-1.5 -mb-1.5">
        <div className="flex md:hidden flex-col gap-1.5 w-full mb-4">
          <label className="text-xs sm:text-sm font-medium text-slate-700 block capitalize">Search</label>
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="text"
                placeholder="Search notifications"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                className="block w-full pl-10 pr-9 h-10 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-colors placeholder:text-slate-400"
              />
              {search && (
                <button type="button" aria-label="Clear search" onClick={() => { setSearch(""); setCurrentPage(1); }} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button variant="outline" onClick={() => setIsFilterDrawerOpen(true)} className="whitespace-nowrap gap-2">
              <IconFilter2 className="h-4 w-4" />
              Filters
            </Button>
          </div>
        </div>

        <ConfiguredDesktopFilters
          search={
            <FilterSearchInput
              aria-label="Search"
              value={search}
              onChange={(value) => { setSearch(value); setCurrentPage(1); }}
              placeholder="Search notifications"
            />
          }
          filters={[
            { id: "status", label: "Status", value: statusFilter, options: STATUS_OPTIONS, defaultValue: "all", onChange: (value) => { setStatusFilter(value); setCurrentPage(1); } },
            { id: "module", label: "Module", value: module, options: allModuleOptions, defaultValue: "all", onChange: (value) => { setModule(value); setCurrentPage(1); } },
            { id: "priority", label: "Priority", value: priority, options: PRIORITY_OPTIONS, defaultValue: "all", onChange: (value) => { setPriority(value); setCurrentPage(1); } },
          ]}
          dates={[{ id: "time", label: "Time Range", from: dateFrom, to: dateTo, onFromChange: setDateFrom, onToChange: setDateTo }]}
        >
          <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
            <div className="w-full">
              <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block transition-colors capitalize">Search</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-colors">
                  <Search className="h-4 w-4 text-slate-400 transition-colors" />
                </div>
                <input
                  type="text"
                  placeholder="Search notifications"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                  className="block w-full pl-10 pr-10 h-9 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-all placeholder:text-slate-400"
                />
                {search && (
                  <button type="button" aria-label="Clear search" onClick={() => setSearch("")} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            <Select label="Status" value={statusFilter} onChange={(value) => { setStatusFilter(value as string); setCurrentPage(1); }} options={STATUS_OPTIONS} />
            <Select label="Module" value={module} onChange={(value) => { setModule(value as string); setCurrentPage(1); }} options={allModuleOptions} />
            <Select label="Priority" value={priority} onChange={(value) => { setPriority(value as string); setCurrentPage(1); }} options={PRIORITY_OPTIONS} />
            <DateRangePicker
              label="Time Range"
              startDate={dateFrom}
              endDate={dateTo}
              onStartDateChange={(value) => { setDateFrom(value); setCurrentPage(1); }}
              onEndDateChange={(value) => { setDateTo(value); setCurrentPage(1); }}
              placeholder="Select date range"
            />
            <div className="filter-actions flex items-end gap-2">
              <ClearFiltersButton onClearSearch={() => setSearch("")} onClear={handleClearFilters} />
            </div>
          </div>
        </ConfiguredDesktopFilters>
      </div>
    </div>
  );

  /** One card: the tabs, the filters, and under them the list in a bordered box with its pagination, as the table of User Management. */
  const contentCard = (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm w-full overflow-hidden flex flex-col">
      {tabsRow}
      {filterSection}
      <div className="px-4 md:px-5 pb-4 md:pb-5 flex-1 flex flex-col relative">
        <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col flex-1 bg-white relative">
          {busy}
          <div className={cn("flex-1", timeline && "p-4 md:p-5")}>{list}</div>
          {pagination_}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full gap-4 md:gap-6">
      <PageHeader
        title="Notifications"
        breadcrumbItems={notificationsBreadcrumb(navigate)}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsMarkAllModalOpen(true)}
              disabled={counts.unread === 0}
              className="flex-1 sm:flex-none whitespace-nowrap gap-2 text-emerald-700 hover:text-emerald-700 hover:bg-emerald-50"
            >
              <CheckCheck className="h-4 w-4" />
              Mark all as read
            </Button>
            <Button
              ref={headerMenu.getRef("more")}
              variant="outline"
              size="icon-sm"
              aria-label="More actions"
              onClick={(e) => headerMenu.toggle("more", e)}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </>
        }
      />

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5">
          <span className="text-xs md:text-sm font-medium text-emerald-800">{selectedIds.size} selected</span>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleBulkMarkAsRead} disabled={isBulkActionLoading} className="whitespace-nowrap gap-2">
              <CheckCheck className="h-4 w-4" />
              Mark as read
            </Button>
            <Button variant="outline" size="sm" onClick={handleBulkDelete} disabled={isBulkActionLoading} className="whitespace-nowrap gap-2 text-red-600 hover:text-red-700 hover:bg-red-50">
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
            <Button variant="ghost" size="sm" onClick={clearSelection} disabled={isBulkActionLoading}>
              Clear selection
            </Button>
          </div>
        </div>
      )}

      {contentCard}

      {/* The menu of one notification (narrow screens, and the timeline cards) */}
      {openDropdownId && openRow && (
        <NotificationActionsDropdown
          isOpen={true}
          onClose={closeDropdown}
          position={dropdownPosition}
          notification={openRow}
          onMarkAsRead={() => handleMarkAsRead(openDropdownId)}
          onDelete={() => handleDeleteNotification(openDropdownId)}
          onView={() => handleOpenNotification(openRow)}
        />
      )}

      {/* The menu of the page */}
      {headerMenu.openId && (
        <PortalDropdownMenu isOpen={true} onClose={headerMenu.close} position={headerMenu.position} minWidth={192}>
          <div className="py-1">
            {[
              { icon: Download, label: isExporting ? "Exporting..." : "Export to Excel", disabled: isExporting, run: () => void handleExport() },
              { icon: Trash2, label: "Clear read", disabled: isBulkActionLoading, run: handleClearAllRead },
              { icon: ListChecks, label: "Select notifications", disabled: false, run: () => setSelectMode(true) },
            ].map(({ icon: Icon, label, disabled, run }) => (
              <button
                key={label}
                type="button"
                disabled={disabled}
                onClick={() => { run(); headerMenu.close(); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50"
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="font-medium">{label}</span>
              </button>
            ))}
          </div>
        </PortalDropdownMenu>
      )}

      <AlertModal
        isOpen={isMarkAllModalOpen}
        onClose={() => setIsMarkAllModalOpen(false)}
        onConfirm={handleMarkAllAsRead}
        title="Mark All as Read"
        description="Are you sure you want to mark all unread notifications as read? This action cannot be undone."
        type="confirm"
        confirmText="Confirm"
        showCancel
      />

      <FilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        onClear={() => { handleClearFilters(); }}
        onApply={() => setIsFilterDrawerOpen(false)}
      >
        {/* the priority tabs layout has no scope tabs: the scope is chosen here */}
        {!timeline && (
          <FilterAccordionItem label="Scope" isExpanded={expandedSections.has("scope")} onToggle={() => toggleSection("scope")}>
            <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
              {SCOPE_OPTIONS.map((opt) => (
                <FilterOptionButton key={opt.value} label={opt.label} isSelected={activeTab === opt.value} onClick={() => { setActiveTab(opt.value); setCurrentPage(1); }} />
              ))}
            </div>
          </FilterAccordionItem>
        )}

        <FilterAccordionItem label="Status" isExpanded={expandedSections.has("status")} onToggle={() => toggleSection("status")}>
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {STATUS_OPTIONS.map((opt) => (
              <FilterOptionButton key={opt.value} label={opt.label} isSelected={statusFilter === opt.value} onClick={() => { setStatusFilter(opt.value); setCurrentPage(1); }} />
            ))}
          </div>
        </FilterAccordionItem>

        <FilterAccordionItem label="Module" isExpanded={expandedSections.has("module")} onToggle={() => toggleSection("module")}>
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {allModuleOptions.map((opt) => (
              <FilterOptionButton key={opt.value} label={opt.label} isSelected={module === opt.value} onClick={() => { setModule(opt.value); setCurrentPage(1); }} />
            ))}
          </div>
        </FilterAccordionItem>

        <FilterAccordionItem label="Priority" isExpanded={expandedSections.has("priority")} onToggle={() => toggleSection("priority")}>
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {PRIORITY_OPTIONS.map((opt) => (
              <FilterOptionButton key={opt.value} label={opt.label} isSelected={priority === opt.value} onClick={() => { setPriority(opt.value); setCurrentPage(1); }} />
            ))}
          </div>
        </FilterAccordionItem>

        <FilterAccordionItem label="Time Range" isExpanded={expandedSections.has("time")} onToggle={() => toggleSection("time")}>
          <div className="pt-2 pb-4">
            <DateRangePicker
              label=""
              startDate={dateFrom}
              endDate={dateTo}
              onStartDateChange={(val) => { setDateFrom(val); setCurrentPage(1); }}
              onEndDateChange={(val) => { setDateTo(val); setCurrentPage(1); }}
              placeholder="Select date range"
            />
          </div>
        </FilterAccordionItem>
      </FilterDrawer>
    </div>
  );
};
