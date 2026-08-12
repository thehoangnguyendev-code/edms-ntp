import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { notifications as notificationsBreadcrumb } from "@/components/ui/breadcrumb/breadcrumbs.config";
import {
  Search,
  Bell,
  CheckCheck,
  Trash2,
  FileText,
  AlertTriangle,
  MessageCircle,
  UserPlus,
  CheckCircle,
  ThumbsUp,
  Reply,
  Settings,
  Lock,
  MoreVertical,
  Eye,
  Download,
  X,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { PortalDropdownMenu } from "@/components/ui/dropdown";
import { usePortalDropdown, useTableDragScroll } from "@/hooks";
import { Button } from "@/components/ui/button/Button";
import { Select } from "@/components/ui/select/Select";
import { DateRangePicker } from "@/components/ui/datetime-picker/DateRangePicker";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { cn } from "@/components/ui/utils";
import { StatusBadge, Badge, type BadgeColor } from "@/components/ui/badge";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast";
import { notificationApi } from "@/services/api/notifications";
import { mapNotificationToViewModel, openNotificationActionUrl } from "./adapters";
import { emitNotificationsChanged, subscribeNotificationsChanged } from "./events";
import type {
  Notification,
  NotificationType,
  NotificationPriority,
  NotificationFilterTab,
  NotificationSummaryCounts,
} from "./types";
import { createEmptyNotificationSummaryCounts } from "./types";
import { formatNotificationDateTime } from "./date";
import { getNotificationTypeIcon, getNotificationTypeIconStyles } from "./notificationMeta";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import { FilterDrawer, FilterAccordionItem } from "@/components/ui/filter/FilterDrawer";
import { FilterOptionButton } from "@/components/ui/filter/FilterOptionButton";
import { IconFilter2 } from "@tabler/icons-react";

// Helper functions
const getTypeIcon = (type: NotificationType) => {
  const icons: Record<NotificationType, typeof Bell> = {
    "review-request": MessageCircle,
    approval: CheckCircle,
    "capa-assignment": UserPlus,
    "training-completion": ThumbsUp,
    "document-update": FileText,
    "controlled-copy": Lock,
    "comment-reply": Reply,
    "deviation-assignment": AlertTriangle,
    "change-control": Settings,
    system: Bell,
  };
  return icons[type] || Bell;
};

const getTypeColor = (type: NotificationType) => {
  const colors: Record<
    NotificationType,
    { bg: string; text: string; badge: string }
  > = {
    "review-request": {
      bg: "bg-blue-50",
      text: "text-blue-600",
      badge: "bg-blue-500",
    },
    approval: {
      bg: "bg-emerald-50",
      text: "text-emerald-600",
      badge: "bg-emerald-500",
    },
    "capa-assignment": {
      bg: "bg-amber-50",
      text: "text-amber-600",
      badge: "bg-amber-500",
    },
    "training-completion": {
      bg: "bg-purple-50",
      text: "text-purple-600",
      badge: "bg-purple-500",
    },
    "document-update": {
      bg: "bg-cyan-50",
      text: "text-cyan-600",
      badge: "bg-cyan-500",
    },
    "controlled-copy": {
      bg: "bg-emerald-50",
      text: "text-emerald-600",
      badge: "bg-emerald-500",
    },
    "comment-reply": {
      bg: "bg-slate-50",
      text: "text-slate-600",
      badge: "bg-slate-500",
    },
    "deviation-assignment": {
      bg: "bg-red-50",
      text: "text-red-600",
      badge: "bg-red-500",
    },
    "change-control": {
      bg: "bg-indigo-50",
      text: "text-indigo-600",
      badge: "bg-indigo-500",
    },
    system: {
      bg: "bg-slate-50",
      text: "text-slate-600",
      badge: "bg-slate-500",
    },
  };
  return colors[type] || colors.system;
};

const getPriorityColor = (priority: NotificationPriority): BadgeColor => {
  const map: Record<NotificationPriority, BadgeColor> = {
    critical: "red",
    high: "amber",
    medium: "blue",
    low: "slate",
  };
  return map[priority] ?? "slate";
};

// --- Components ---



const NotificationActionsDropdown: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  position: { top: number; left: number; showAbove?: boolean };
  notification: Notification;
  onMarkAsRead: () => void;
  onDelete: () => void;
  onView: () => void;
}> = ({
  isOpen,
  onClose,
  position,
  notification,
  onMarkAsRead,
  onDelete,
  onView,
}) => {
  return (
    <PortalDropdownMenu isOpen={isOpen} onClose={onClose} position={position} minWidth={160}>
      <div className="py-1">
        {notification.status === "unread" && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMarkAsRead();
              onClose();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 active:bg-slate-100 transition-colors"
          >
            <Eye className="h-4 w-4 flex-shrink-0" />
            <span className="font-medium">Mark as Read</span>
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
            onClose();
          }}
          className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 active:bg-slate-100 transition-colors"
        >
          <Trash2 className="h-4 w-4 flex-shrink-0" />
          <span className="font-medium">Delete</span>
        </button>
      </div>
    </PortalDropdownMenu>
  );
};

const NotificationRow: React.FC<{
  notification: Notification;
  index: number;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
  getRef: (id: string) => React.RefObject<HTMLButtonElement | null>;
  onToggle: (id: string, e: React.MouseEvent<HTMLButtonElement>) => void;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
}> = ({
  notification,
  index,
  onMarkAsRead,
  onDelete,
  getRef,
  onToggle,
  isSelected,
  onToggleSelect,
}) => {
    const Icon = getNotificationTypeIcon(notification.type);
    const colors = getNotificationTypeIconStyles(notification.type);
    const tdClass = "py-3 px-4 text-xs md:text-sm text-slate-700 border-b border-slate-200 whitespace-nowrap";
    const reviewerSequenceLabel = (() => {
      const metadata = notification.metadata as Record<string, unknown> | undefined;
      const current = String(metadata?.reviewerSequenceCurrent ?? "").trim();
      const next = String(metadata?.reviewerSequenceNext ?? "").trim();
      const currentName = String(metadata?.reviewerCurrentName ?? "").trim();
      const nextName = String(metadata?.reviewerNextName ?? "").trim();
      const total = String(metadata?.reviewerTotalCount ?? "").trim();
      if (!current && !next && !currentName && !nextName && !total) {
        return "";
      }
      const totalLabel = total ? ` / ${total}` : "";
      if (current && currentName) {
        return `${currentName} • ${current}${totalLabel}`;
      }
      if (current) {
        return `Reviewer ${current}${totalLabel}`;
      }
      if (nextName) {
        return `Next: ${nextName}${next ? ` • ${next}` : ""}`;
      }
      return "";
    })();

    return (
      <tr
        className={cn(
          "group relative transition-colors",
          notification.status === "unread"
            ? "bg-emerald-50/40 hover:bg-emerald-50/60"
            : "bg-white hover:bg-emerald-50/50",
        )}
      >
        <td
          onClick={(e) => e.stopPropagation()}
          className={cn("py-3 px-4 text-xs md:text-sm text-slate-700 border-b border-slate-200 whitespace-nowrap", "text-center w-10")}
        >
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(notification.id)}
            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            aria-label="Select notification"
          />
        </td>

        <td className={cn("py-3 px-4 text-xs md:text-sm text-slate-700 border-b border-slate-200 whitespace-nowrap", "text-center text-slate-500 w-14 relative")}>
          {notification.status === "unread" && (
            <div className="absolute inset-y-0 left-0 w-1 bg-emerald-500" title="Unread" />
          )}
          {index}
        </td>

        <td className={tdClass}>
          <div className="flex items-start gap-3">
            <div className="relative shrink-0">
              <div
                className={cn(
                  "h-9 w-9 md:h-10 md:w-10 rounded-xl flex items-center justify-center ring-1 ring-inset ring-black/5 transition-all group-hover:scale-105",
                  colors.bg,
                  notification.status === "read" && "opacity-60"
                )}
              >
                <Icon className={cn("h-4 w-4 md:h-5 md:w-5", colors.text)} />
              </div>
              {notification.status === "unread" && (
                <div className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 md:h-3 md:w-3 bg-emerald-500 rounded-full border-2 border-white animate-pulse" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className={cn(
                "text-xs md:text-sm break-words",
                  notification.status === "unread"
                    ? "font-bold text-slate-900"
                    : "font-medium text-slate-500",
                )}
              >
                {notification.title}
              </p>
              <p className={cn(
                "mt-0.5 max-w-2xl whitespace-normal break-words text-xs md:text-sm",
                notification.status === "unread"
                  ? "text-slate-600"
                  : "text-slate-400"
              )}>
                {notification.description}
              </p>
              {reviewerSequenceLabel && (
                <div className="mt-1 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-2xs font-medium text-emerald-700">
                  {reviewerSequenceLabel}
                </div>
              )}
            </div>
          </div>
        </td>

        <td className={tdClass}>
          <StatusBadge
            status="draft"
            label={notification.module}
            className="text-slate-700 bg-slate-50 border-slate-200"
            size="sm"
          />
        </td>

        <td className={tdClass}>
          {notification.relatedItem ? (
            <span className="font-medium text-emerald-600">
              {notification.relatedItem.documentNumber}
            </span>
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </td>

        <td className={tdClass}>
          <Badge color={getPriorityColor(notification.priority)} size="sm" className="capitalize">
            {notification.priority}
          </Badge>
        </td>

        <td className={cn(tdClass, "text-slate-500")}>
          {formatNotificationDateTime(notification.createdAt)}
        </td>

        <td
          onClick={(e) => e.stopPropagation()}
          className="sticky right-0 z-10 bg-white border-b border-slate-200 py-3 px-4 text-center whitespace-nowrap before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.05)] group-hover:bg-slate-50 transition-colors"
        >
          <button
            ref={getRef(notification.id)}
            onClick={(e) => onToggle(notification.id, e)}
            className="inline-flex items-center justify-center h-7 w-7 md:h-8 md:w-8 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors"
            aria-label="More actions"
          >
            <MoreVertical className="h-3.5 w-3.5 md:h-4 md:w-4" />
          </button>
        </td>
      </tr>
    );
  };

// Empty State Component
const EmptyState: React.FC<{
  type: NotificationFilterTab;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
}> = ({ type, hasActiveFilters, onClearFilters }) => {
  const messages = {
    all: {
      title: "No notifications",
      description: hasActiveFilters
        ? "We couldn't find any notifications matching your filters. Try adjusting your search criteria or clear filters."
        : "You're all caught up!",
    },
    "for-me": {
      title: "No personal notifications",
      description: hasActiveFilters
        ? "We couldn't find any personal notifications matching your filters."
        : "You don't have any personal notifications yet.",
    },
    system: {
      title: "No system notifications",
      description: hasActiveFilters
        ? "We couldn't find any system notifications matching your filters."
        : "There are no system notifications at this time.",
    },
  };

  return (
    <TableEmptyState
      icon={<Bell className="h-7 w-7 md:h-8 md:w-8 text-slate-300" />}
      title={messages[type].title}
      description={messages[type].description}
    />
  );
};

// --- Main View ---
export const NotificationsView: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkActionLoading, setIsBulkActionLoading] = useState(false);
  const {
    openId: openDropdownId,
    position: dropdownPosition,
    getRef,
    toggle: handleDropdownToggle,
    close: closeDropdown,
  } = usePortalDropdown();
  const { scrollerRef, isDragging, dragEvents } = useTableDragScroll();
  const [isMarkAllModalOpen, setIsMarkAllModalOpen] = useState(false);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["status", "type", "module"]));

  // Filter states
  const [activeTab, setActiveTab] = useState<NotificationFilterTab>("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [module, setModule] = useState("all");
  const [priority, setPriority] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: keyof Notification | null; direction: "asc" | "desc" }>({
    key: "createdAt",
    direction: "desc",
  });
  const [isTableLoading, setIsTableLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [notificationSummary, setNotificationSummary] = useState<NotificationSummaryCounts>(
    createEmptyNotificationSummaryCounts(),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const hasLoadedRef = useRef(false);
  const requestSeqRef = useRef(0);
  const currentPageRef = useRef(currentPage);
  const itemsPerPageRef = useRef(itemsPerPage);
  useEffect(() => { currentPageRef.current = currentPage; }, [currentPage]);
  useEffect(() => { itemsPerPageRef.current = itemsPerPage; }, [itemsPerPage]);

  const counts = useMemo(() => {
      return {
      all: notificationSummary.all,
      forMe: notificationSummary.personal,
      system: notificationSummary.system,
      unread: notificationSummary.unread,
    };
  }, [notificationSummary]);

  const NOTIFICATION_TABS: TabItem[] = [
    { id: "all", label: "All Notifications", count: counts.all },
    { id: "for-me", label: "For Me", count: counts.forMe },
    { id: "system", label: "Systems", count: counts.system },
  ];

  const activeScope = activeTab === "for-me" ? "personal" : activeTab === "system" ? "system" : "all";

  const resolveSortBy = (key: keyof Notification | null) => {
    if (!key) {
      return "createdAt";
    }
    if (key === "relatedItem") {
      return "relatedEntityNumber";
    }
    return String(key);
  };

  // Sorting Handler
  const handleSort = (key: keyof Notification) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const loadNotifications = useCallback(async (showTableSpinner = false, silentRefresh = false) => {
    const requestId = ++requestSeqRef.current;
    if (!silentRefresh) {
      if (showTableSpinner) {
        setIsTableLoading(true);
      } else if (!hasLoadedRef.current) {
        setIsLoading(true);
      } else {
        setIsTableLoading(true);
      }
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
          sortBy: resolveSortBy(sortConfig.key),
          sortDirection: sortConfig.direction,
          page: currentPageRef.current,
          limit: itemsPerPageRef.current,
        }),
      ]);
      if (requestId !== requestSeqRef.current) {
        return;
      }
      setNotificationSummary(summary);
      setNotifications(page.data.map(mapNotificationToViewModel));
      setPagination(page.pagination);
      hasLoadedRef.current = true;
    } catch (error) {
      if (requestId !== requestSeqRef.current) {
        return;
      }
      console.error("Failed to load notifications", error);
      showToast({ type: "error", title: "Failed to load notifications", message: "Please try refreshing the page." });
      setNotifications([]);
    } finally {
      if (requestId !== requestSeqRef.current) {
        return;
      }
      if (!silentRefresh) {
        setIsLoading(false);
        setIsTableLoading(false);
      } else {
        setIsRefreshing(false);
      }
    }
  }, [
    activeScope,
    dateFrom,
    dateTo,
    module,
    priority,
    search,
    showToast,
    sortConfig.direction,
    sortConfig.key,
    statusFilter,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadNotifications(false);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [loadNotifications, currentPage, itemsPerPage]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [currentPage, activeTab]);

  useEffect(() => {
    const unsubscribe = subscribeNotificationsChanged(() => {
      void loadNotifications(false, true);
    });
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadNotifications(false, true);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadNotifications]);

  const totalPages = Math.max(1, pagination.totalPages || 1);

  // Handlers
  const handleViewNotification = (notification: Notification) => {
    // Mark as read
    if (notification.status === "unread") {
      handleMarkAsRead(notification.id);
    }
    // The full in-app summary is shown in the table; View opens its related record when available.
    if (notification.actionUrl) {
      openNotificationActionUrl(notification.actionUrl, navigate);
    }
  };

  const handleMarkAsRead = (id: string) => {
    void notificationApi
      .markAsRead(id)
      .then(() => {
        emitNotificationsChanged();
        return loadNotifications(true);
      })
      .catch((error) => {
        console.error("Failed to mark notification as read", error);
        showToast({ type: "error", title: "Failed to mark as read", message: "Please try again." });
      });
  };

  const handleMarkAllAsRead = () => {
    void notificationApi
      .markAllAsRead()
      .then(() => {
        emitNotificationsChanged();
        return loadNotifications(true);
      })
      .catch((error) => {
        console.error("Failed to mark all as read", error);
        showToast({ type: "error", title: "Failed to mark all as read", message: "Please try again." });
      })
      .finally(() => setIsMarkAllModalOpen(false));
  };

  const handleDeleteNotification = (id: string) => {
    void notificationApi
      .deleteNotification(id)
      .then(() => {
        emitNotificationsChanged();
        return loadNotifications(true);
      })
      .catch((error) => {
        console.error("Failed to delete notification", error);
        showToast({ type: "error", title: "Failed to delete notification", message: "Please try again." });
      });
  };

  const toggleSelectOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) =>
      prev.size === notifications.length ? new Set() : new Set(notifications.map((n) => n.id))
    );
  }, [notifications]);

  const handleBulkMarkAsRead = async () => {
    if (selectedIds.size === 0) return;
    setIsBulkActionLoading(true);
    try {
      await notificationApi.markGroupAsRead(Array.from(selectedIds));
      emitNotificationsChanged();
      setSelectedIds(new Set());
      await loadNotifications(true);
    } catch (error) {
      console.error("Failed to mark selected notifications as read", error);
      showToast({ type: "error", title: "Failed to mark selected as read", message: "Please try again." });
    } finally {
      setIsBulkActionLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsBulkActionLoading(true);
    try {
      await notificationApi.deleteNotifications(Array.from(selectedIds));
      emitNotificationsChanged();
      setSelectedIds(new Set());
      await loadNotifications(true);
    } catch (error) {
      console.error("Failed to delete selected notifications", error);
      showToast({ type: "error", title: "Failed to delete selected", message: "Please try again." });
    } finally {
      setIsBulkActionLoading(false);
    }
  };

  const handleClearAllRead = async () => {
    setIsBulkActionLoading(true);
    try {
      await notificationApi.clearAllRead();
      emitNotificationsChanged();
      setSelectedIds(new Set());
      await loadNotifications(true);
    } catch (error) {
      console.error("Failed to clear read notifications", error);
      showToast({ type: "error", title: "Failed to clear read notifications", message: "Please try again." });
    } finally {
      setIsBulkActionLoading(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await notificationApi.getNotifications({
        scope: activeScope,
        search: search || undefined,
        module: module === "all" ? undefined : module,
        priority: priority === "all" ? undefined : priority,
        status: statusFilter === "all" ? undefined : statusFilter,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        sortBy: resolveSortBy(sortConfig.key),
        sortDirection: sortConfig.direction,
        page: 1,
        limit: 500,
      });

      const rows = result.data.map(mapNotificationToViewModel);
      const headers = ["No.", "Title", "Description", "Module", "Priority", "Status", "Type", "Sender", "Related Item", "Time"];
      const csvRows = [
        headers.join(","),
        ...rows.map((n, i) => [
          i + 1,
          `"${(n.title || "").replace(/"/g, '""')}"`,
          `"${(n.description || "").replace(/"/g, '""')}"`,
          `"${(n.module || "").replace(/"/g, '""')}"`,
          n.priority,
          n.status,
          n.type,
          `"${(n.sender?.fullName || "").replace(/"/g, '""')}"`,
          `"${(n.relatedItem?.documentNumber || "").replace(/"/g, '""')}"`,
          `"${n.createdAt}"`,
        ].join(",")),
      ];

      const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `notifications_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export notifications", error);
      showToast({ type: "error", title: "Failed to export notifications", message: "Please try again." });
    } finally {
      setIsExporting(false);
    }
  };

  // Clear Filters
  const handleClearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setModule("all");
    setPriority("all");
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
  };

  const hasActiveFilters =
    search !== "" ||
    statusFilter !== "all" ||
    module !== "all" ||
    priority !== "all" ||
    dateFrom !== "" ||
    dateTo !== "";

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  if (isLoading) return <SectionLoading minHeight="60vh" />;

  return (
    <div className="flex flex-col h-full gap-4 md:gap-6">
      {/* Header: Title + Action Button */}
      <PageHeader
        title="Notifications"
        breadcrumbItems={notificationsBreadcrumb(navigate)}
        actions={
          <>
            <Button
              onClick={() => void handleExport()}
              variant="outline"
              size="sm"
              disabled={isExporting}
              className="whitespace-nowrap gap-2"
            >
              <Download className="h-4 w-4" />
              {isExporting ? "Exporting..." : "Export"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsMarkAllModalOpen(true)}
              disabled={counts.unread === 0}
              className="whitespace-nowrap gap-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
            >
              <CheckCheck className="h-4 w-4" />
              <span className="inline">Mark all as read</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleClearAllRead()}
              disabled={isBulkActionLoading}
              className="whitespace-nowrap gap-2"
            >
              <Trash2 className="h-4 w-4" />
              <span className="inline">Clear read</span>
            </Button>
          </>
        }
      />

      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5">
          <span className="text-xs md:text-sm font-medium text-emerald-800">
            {selectedIds.size} selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleBulkMarkAsRead()}
              disabled={isBulkActionLoading}
              className="whitespace-nowrap gap-2"
            >
              <CheckCheck className="h-4 w-4" />
              Mark as read
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleBulkDelete()}
              disabled={isBulkActionLoading}
              className="whitespace-nowrap gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
              disabled={isBulkActionLoading}
            >
              Clear selection
            </Button>
          </div>
        </div>
      )}

      {/* Unified Content Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm w-full overflow-hidden flex flex-col">
        <TabNav
          tabs={NOTIFICATION_TABS}
          activeTab={activeTab}
          onChange={(id) => {
            setActiveTab(id as NotificationFilterTab);
            setCurrentPage(1);
          }}
          variant="underline"
        />
        {/* Filter Section */}
        <div className="px-4 pt-4 md:p-5 flex flex-col">
          <div className="px-1.5 -mx-1.5 pb-1.5 -mb-1.5">
            <div className="flex md:hidden flex-col gap-1.5 w-full mb-4">
              <label className="text-xs sm:text-sm font-medium text-slate-700 block">Search</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search notifications..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="block w-full pl-10 pr-9 h-10 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-colors placeholder:text-slate-400"
                  />
                  {search && (
                    <button
                      onClick={() => {
                        setSearch("");
                        setCurrentPage(1);
                      }}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Button
                  variant="outline"
                  onClick={() => setIsFilterDrawerOpen(true)}
                  className="whitespace-nowrap gap-2"
                >
                  <IconFilter2 className="h-4 w-4" />
                  Filters
                </Button>
              </div>
            </div>

            <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
              <div className="w-full">
                <label className="text-xs sm:text-sm font-medium text-slate-700 block transition-colors px-0.5 mb-1.5">
                  Search
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-colors">
                    <Search className="h-4 w-4 text-slate-400 transition-colors" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search notifications..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="block w-full pl-10 pr-10 h-9 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-all placeholder:text-slate-400"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="w-full">
                <Select
                  label="Status"
                  value={statusFilter}
                  onChange={(val) => {
                    setStatusFilter(val as string);
                    setCurrentPage(1);
                  }}
                  options={[
                    { label: "All Status", value: "all" },
                    { label: "Unread Only", value: "unread" },
                    { label: "Read Only", value: "read" },
                  ]}
                />
              </div>
              <div className="w-full">
                <Select
                  label="Module"
                  value={module}
                  onChange={(val) => {
                    setModule(val as string);
                    setCurrentPage(1);
                  }}
                  options={[
                    { label: "All Modules", value: "all" },
                    { label: "Document", value: "Document" },
                    { label: "Deviation", value: "Deviation" },
                    { label: "CAPA", value: "CAPA" },
                    { label: "Training", value: "Training" },
                    { label: "Change Control", value: "Change Control" },
                  ]}
                />
              </div>

              <div className="w-full">
                <Select
                  label="Priority"
                  value={priority}
                  onChange={(val) => {
                    setPriority(val as string);
                    setCurrentPage(1);
                  }}
                  options={[
                    { label: "All Priorities", value: "all" },
                    { label: "Critical", value: "critical" },
                    { label: "High", value: "high" },
                    { label: "Medium", value: "medium" },
                    { label: "Low", value: "low" },
                  ]}
                />
              </div>

              <div className="w-full">
                <DateRangePicker
                  label="Time Range"
                  startDate={dateFrom}
                  endDate={dateTo}
                  onStartDateChange={(val) => {
                    setDateFrom(val);
                    setCurrentPage(1);
                  }}
                  onEndDateChange={(val) => {
                    setDateTo(val);
                    setCurrentPage(1);
                  }}
                  placeholder="Select date range"
                />
              </div>
              <div className="w-full flex justify-start">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearFilters}
                  className="h-9 px-4 gap-2 font-medium transition-all duration-200 hover:bg-red-600 hover:text-white hover:border-red-600 whitespace-nowrap"
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Table Section */}
        <div className="px-4 md:px-5 pb-4 md:pb-5 flex-1 flex flex-col relative">
          <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col flex-1 bg-white transition-all duration-300">
            {(isTableLoading || isRefreshing) && !isLoading && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70 backdrop-blur-sm">
                <SectionLoading minHeight="320px" />
              </div>
            )}
            <div
              ref={scrollerRef}
              className={cn(
                "flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-50 hover:scrollbar-thumb-slate-400",
                isDragging ? "cursor-grabbing select-none" : "cursor-grab"
              )}
              {...dragEvents}
            >
              <table className="w-full min-w-max  border-spacing-0 text-left">
                <thead>
                  <tr>
                    <th className="sticky top-0 z-20 bg-slate-50 py-3 px-4 text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap w-10 text-center">
                      <input
                        type="checkbox"
                        checked={notifications.length > 0 && selectedIds.size === notifications.length}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        aria-label="Select all notifications"
                      />
                    </th>
                    <th className="sticky top-0 z-20 bg-slate-50 py-3 px-4 text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap w-14 text-center">
                      No.
                    </th>
                    {[
                      { label: "Notification", id: "title", sortable: true },
                      { label: "Module", id: "module", sortable: true },
                      { label: "Related Item", id: "relatedItem", sortable: true },
                      { label: "Priority", id: "priority", sortable: true },
                      { label: "Time", id: "createdAt", sortable: true }
                    ].map((col, idx) => {
                      const isSorted = sortConfig.key === col.id;
                      const canSort = col.sortable;
                      return (
                        <th
                          key={idx}
                          onClick={canSort ? () => handleSort(col.id as keyof Notification) : undefined}
                          className={cn(
                            "sticky top-0 z-20 bg-slate-50 py-3 px-4 text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap transition-colors",
                            canSort && "cursor-pointer hover:bg-slate-100 hover:text-slate-700 group",
                          )}
                        >
                          <div className="flex items-center justify-between gap-2 w-full">
                            <span className="truncate">{col.label}</span>
                            {canSort && (
                              <div className="flex flex-col text-slate-500 flex-shrink-0 group-hover:text-slate-700 transition-colors">
                                <ChevronUp className={cn("h-3 w-3 -mb-1", isSorted && sortConfig.direction === 'asc' ? "text-emerald-600" : "")} />
                                <ChevronDown className={cn("h-3 w-3", isSorted && sortConfig.direction === 'desc' ? "text-emerald-600" : "")} />
                              </div>
                            )}
                          </div>
                        </th>
                      );
                    })}
                    <th className="sticky top-0 right-0 z-30 bg-slate-50 py-3 px-4 text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider text-center whitespace-nowrap border-b-2 border-slate-200 before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.05)]">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {notifications.length > 0 ? (
                    notifications.map((notification, idx) => (
                      <NotificationRow
                        key={notification.id}
                        notification={notification}
                        index={(currentPage - 1) * itemsPerPage + idx + 1}
                        onMarkAsRead={handleMarkAsRead}
                        onDelete={handleDeleteNotification}
                        getRef={getRef}
                        onToggle={handleDropdownToggle}
                        isSelected={selectedIds.has(notification.id)}
                        onToggleSelect={toggleSelectOne}
                      />
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="border-b border-slate-200">
                        <EmptyState
                          type={activeTab}
                          hasActiveFilters={hasActiveFilters}
                          onClearFilters={handleClearFilters}
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              itemsPerPage={itemsPerPage}
              totalItems={pagination.total}
              onItemsPerPageChange={setItemsPerPage}
            />
          </div>
        </div>
      </div>

      {/* Shared Dropdown Portal */}
      {openDropdownId &&
        notifications.find((n) => n.id === openDropdownId) && (
          <NotificationActionsDropdown
            isOpen={true}
            onClose={closeDropdown}
            position={dropdownPosition}
            notification={
              notifications.find((n) => n.id === openDropdownId)!
            }
            onMarkAsRead={() => {
              handleMarkAsRead(openDropdownId);
              closeDropdown();
            }}
            onDelete={() => {
              handleDeleteNotification(openDropdownId);
              closeDropdown();
            }}
            onView={() => {
              const n = notifications.find(
                (n) => n.id === openDropdownId,
              );
              if (n) handleViewNotification(n);
              closeDropdown();
            }}
          />
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
        onClear={() => {
          handleClearFilters();
          setCurrentPage(1);
        }}
        onApply={() => setIsFilterDrawerOpen(false)}
      >
        <FilterAccordionItem
          label="Status"
          isExpanded={expandedSections.has("status")}
          onToggle={() => toggleSection("status")}
        >
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {[
              { label: "All Status", value: "all" },
              { label: "Unread Only", value: "unread" },
              { label: "Read Only", value: "read" },
            ].map((opt) => (
              <FilterOptionButton
                key={opt.value}
                label={opt.label}
                isSelected={statusFilter === opt.value}
                onClick={() => { setStatusFilter(opt.value); setCurrentPage(1); }}
              />
            ))}
          </div>
        </FilterAccordionItem>

        <FilterAccordionItem
          label="Module"
          isExpanded={expandedSections.has("module")}
          onToggle={() => toggleSection("module")}
        >
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {[
              { label: "All Modules", value: "all" },
              { label: "Document", value: "Document" },
              { label: "Deviation", value: "Deviation" },
              { label: "CAPA", value: "CAPA" },
              { label: "Training", value: "Training" },
              { label: "Change Control", value: "Change Control" },
            ].map((opt) => (
              <FilterOptionButton
                key={opt.value}
                label={opt.label}
                isSelected={module === opt.value}
                onClick={() => { setModule(opt.value); setCurrentPage(1); }}
              />
            ))}
          </div>
        </FilterAccordionItem>

        <FilterAccordionItem
          label="Priority"
          isExpanded={expandedSections.has("priority")}
          onToggle={() => toggleSection("priority")}
        >
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {[
              { label: "All Priorities", value: "all" },
              { label: "Critical", value: "critical" },
              { label: "High", value: "high" },
              { label: "Medium", value: "medium" },
              { label: "Low", value: "low" },
            ].map((opt) => (
              <FilterOptionButton
                key={opt.value}
                label={opt.label}
                isSelected={priority === opt.value}
                onClick={() => { setPriority(opt.value); setCurrentPage(1); }}
              />
            ))}
          </div>
        </FilterAccordionItem>

        <FilterAccordionItem
          label="Time Range"
          isExpanded={expandedSections.has("time")}
          onToggle={() => toggleSection("time")}
        >
          <div className="pt-2 pb-4">
            <DateRangePicker
              label=""
              startDate={dateFrom}
              endDate={dateTo}
              onStartDateChange={(val) => {
                setDateFrom(val);
                setCurrentPage(1);
              }}
              onEndDateChange={(val) => {
                setDateTo(val);
                setCurrentPage(1);
              }}
              placeholder="Select date range"
            />
          </div>
        </FilterAccordionItem>
      </FilterDrawer>
    </div>
  );
};
