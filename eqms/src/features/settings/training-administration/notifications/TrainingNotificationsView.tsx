import { ClearFiltersButton } from "@/components/ui/filter/ClearFiltersButton";
import { ConfiguredDesktopFilters } from "@/components/ui/filter/ConfiguredDesktopFilters";
import { usePersistedState } from "@/hooks/usePersistedState";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { BellRing, Check, Search, X } from "lucide-react";
import { IconFilter2 } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { DateRangePicker } from "@/components/ui/datetime-picker/DateRangePicker";
import { FilterAccordionItem, FilterDrawer } from "@/components/ui/filter/FilterDrawer";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Select } from "@/components/ui/select/Select";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { DataTable, useCustomColumnLayout, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { cn } from "@/components/ui/utils";
import { trainingNotifications } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { usePermissions } from "@/hooks/usePermissions";
import { useDictionaryServerTable } from "@/features/settings/dictionaries/hooks/useDictionaryServerTable";
import { trainingError, trainingNotificationsApi, type TrainingNotificationLogRow, type TrainingNotificationLogPage } from "@/services/api/trainingActivities";
import { formatDateTime } from "@/utils/format";

type StatusFilter = "All" | TrainingNotificationLogRow["status"];
type ChannelFilter = "All" | TrainingNotificationLogRow["channel"];
type ResultModalState = { isOpen: boolean; type: "success" | "error"; title: string; description: string };

const STATUS_OPTIONS = [
  { label: "All", value: "All" },
  { label: "Sent", value: "SENT" },
  { label: "Skipped", value: "SKIPPED" },
  { label: "Failed", value: "FAILED" },
];
const CHANNEL_OPTIONS = [
  { label: "All", value: "All" },
  { label: "In-app", value: "IN_APP" },
  { label: "E-mail", value: "EMAIL" },
];
const STATUS_COLOR: Record<TrainingNotificationLogRow["status"], "emerald" | "red" | "slate"> = { SENT: "emerald", FAILED: "red", SKIPPED: "slate" };
const STATUS_LABEL: Record<TrainingNotificationLogRow["status"], string> = { SENT: "Sent", FAILED: "Failed", SKIPPED: "Skipped" };

/** A machine code written for people: TRAINING_DUE_SOON becomes "Due soon". The code itself is never shown as the value of anything. */
const readable = (code?: string | null) => {
  if (!code) return "—";
  const words = code.replace(/^TRAINING_/, "").toLowerCase().split("_").join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** The date picker works in dd/MM/yyyy; the server takes an ISO date. */
const toIsoDate = (value: string) => {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(value);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : undefined;
};

const getOptionClassName = (isActive: boolean) =>
  cn(
    "w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-all",
    isActive ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
  );

/**
 * Training Notifications: the log of every notice Training Management sent, did not send (and why) or failed to send, and a manual run of
 * the reminders. Laid out like Document Types; the log is searched, filtered, sorted and paged on the server.
 */
export const TrainingNotificationsView: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("training.admin.manage");

  const [statusFilter, setStatusFilter] = usePersistedState<StatusFilter>("training.admin.notifications.status", "All");
  const [channelFilter, setChannelFilter] = usePersistedState<ChannelFilter>("training.admin.notifications.channel", "All");
  const [sentFromDate, setSentFromDate] = usePersistedState("training.admin.notifications.from", "");
  const [sentToDate, setSentToDate] = usePersistedState("training.admin.notifications.to", "");
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["status", "channel", "date"]));
  const [summary, setSummary] = useState<TrainingNotificationLogPage["summary"]>({ SENT: 0, FAILED: 0, SKIPPED: 0 });
  const [showRunModal, setShowRunModal] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [resultModal, setResultModal] = useState<ResultModalState>({ isOpen: false, type: "success", title: "", description: "" });

  // The hook re-reads the page whenever the fetcher changes, so it must stay the same function; the totals by outcome ride along on each page.
  const fetcher = useCallback(async (params: Parameters<typeof trainingNotificationsApi.log>[0]) => {
    const page = await trainingNotificationsApi.log(params);
    setSummary(page.summary);
    return page;
  }, []);

  const { searchQuery, setSearchQuery, currentPage, setCurrentPage, itemsPerPage, setItemsPerPage, totalPages, totalItems, items, sortConfig, handleSort, reload } =
    useDictionaryServerTable<TrainingNotificationLogRow>({
      fetcher,
      persistKey: "training.admin.notifications",
      liveTypes: ["TRAINING"],
      defaultSortBy: "sentAt",
      defaultSortDirection: "desc",
      extraParams: {
        status: statusFilter === "All" ? undefined : statusFilter,
        channel: channelFilter === "All" ? undefined : channelFilter,
        from: toIsoDate(sentFromDate),
        to: toIsoDate(sentToDate),
      },
    });

  const filtersSeen = useRef(false);
  useEffect(() => {
    // The first run is the arrival on the screen: the page that was restored stays.
    if (!filtersSeen.current) { filtersSeen.current = true; return; }
    setCurrentPage(1);
  }, [statusFilter, channelFilter, sentFromDate, sentToDate, setCurrentPage]);

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("All");
    setChannelFilter("All");
    setSentFromDate("");
    setSentToDate("");
    setCurrentPage(1);
  };
  const hasActiveFilters = searchQuery.length > 0 || statusFilter !== "All" || channelFilter !== "All" || sentFromDate.length > 0 || sentToDate.length > 0;

  const toggleSection = (section: string) =>
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });

  const runReminders = async () => {
    setIsRunning(true);
    try {
      const run = await trainingNotificationsApi.runReminders();
      setShowRunModal(false);
      setResultModal({
        isOpen: true,
        type: "success",
        title: "Reminders Run",
        description: `${run.sent} notice${run.sent === 1 ? "" : "s"} sent, ${run.skipped} skipped (already sent for this day or week), ${run.failed} failed.`,
      });
      reload();
    } catch (error) {
      setShowRunModal(false);
      setResultModal({ isOpen: true, type: "error", title: "Reminders Run Failed", description: trainingError(error) });
    } finally {
      setIsRunning(false);
    }
  };

  const sortFor = (key: string) => ({ direction: sortConfig.key === key ? sortConfig.direction : undefined, onSort: () => handleSort(key) });
  const columns: DataTableColumn<TrainingNotificationLogRow>[] = [
    { id: "no", header: "No.", label: "No.", locked: true, cell: (_item, index) => (currentPage - 1) * itemsPerPage + index + 1 },
    { id: "sentAt", header: "Sent At", label: "Sent At", sort: sortFor("sentAt"), cellClassName: "whitespace-nowrap text-slate-600", cell: (item) => formatDateTime(item.createdAt) },
    { id: "event", header: "Event", label: "Event", sort: sortFor("event"), cell: (item) => <span className="font-medium text-slate-900">{readable(item.eventCode)}</span> },
    { id: "recipient", header: "Recipient", label: "Recipient", sort: sortFor("recipient"), cell: (item) => item.recipientName },
    { id: "channel", header: "Channel", label: "Channel", sort: sortFor("channel"), cell: (item) => <Badge color={item.channel === "EMAIL" ? "amber" : "blue"} size="sm">{item.channel === "EMAIL" ? "E-mail" : "In-app"}</Badge> },
    { id: "status", header: "Status", label: "Status", sort: sortFor("status"), cell: (item) => <Badge color={STATUS_COLOR[item.status]} size="sm">{STATUS_LABEL[item.status]}</Badge> },
    { id: "reason", header: "Reason", label: "Reason", cellClassName: "text-slate-600", cell: (item) => (item.reasonCode ? readable(item.reasonCode) : "—") },
    { id: "title", header: "Notice", label: "Notice", sort: sortFor("title"), cellClassName: "max-w-xs truncate text-slate-600", cell: (item) => item.title || "—" },
  ];
  const { layout, control } = useCustomColumnLayout("training.notifications", columns);

  const stat = (status: TrainingNotificationLogRow["status"]) => (
    <button
      key={status}
      type="button"
      onClick={() => setStatusFilter(statusFilter === status ? "All" : status)}
      aria-pressed={statusFilter === status}
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs sm:text-sm transition-colors",
        statusFilter === status ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
      )}
    >
      <span className="font-semibold tabular-nums text-slate-900">{summary[status].toLocaleString()}</span>
      {STATUS_LABEL[status]}
    </button>
  );

  return (
    <div className="h-full flex flex-col gap-6">
      <PageHeader
        title="Training Notifications"
        breadcrumbItems={trainingNotifications(navigate)}
        actions={
          canManage ? (
            <Button size="sm" onClick={() => setShowRunModal(true)} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700">
              <BellRing className="h-4 w-4" />
              Run Reminders Now
            </Button>
          ) : undefined
        }
      />

      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex-1 overflow-auto p-4 md:p-5">
            <div className="compact-filter-stack flex-1 flex flex-col gap-4 md:gap-5 min-h-0">
              <div className="flex flex-wrap items-center gap-2" aria-label="Notices by outcome">
                {(["SENT", "SKIPPED", "FAILED"] as const).map(stat)}
                <span className="text-xs text-slate-500">Totals follow the other filters. The reminders also run by themselves every day at 06:30 (Asia/Ho_Chi_Minh).</span>
              </div>

              <div className="bg-white w-full">
                <div className="flex md:hidden flex-col gap-1.5 w-full">
                  <label className="text-xs sm:text-sm font-medium text-slate-700 block">Search</label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search notices..."
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="w-full h-10 pl-10 pr-9 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => {
                            setSearchQuery("");
                            setCurrentPage(1);
                          }}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400"
                        >
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
                  trailing={<div className="hidden md:block">{control}</div>}
                  search={
                    <input
                      aria-label="Search"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      placeholder="Search notices..."
                      className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500"
                    />
                  }
                  filters={[
                    { id: "statusFilter", label: "Status", value: String(statusFilter), options: STATUS_OPTIONS, onChange: (value) => { setStatusFilter(value as StatusFilter); setCurrentPage(1); } },
                    { id: "channelFilter", label: "Channel", value: String(channelFilter), options: CHANNEL_OPTIONS, onChange: (value) => { setChannelFilter(value as ChannelFilter); setCurrentPage(1); } },
                  ]}
                  dates={[
                    {
                      id: "sentDate",
                      label: "Sent Date Range",
                      from: sentFromDate,
                      to: sentToDate,
                      onFromChange: (v) => { setSentFromDate(v); setCurrentPage(1); },
                      onToChange: (v) => { setSentToDate(v); setCurrentPage(1); },
                    },
                  ]}
                >
                  <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 sm:gap-4 items-end">
                    <div className="sm:col-span-1 lg:col-span-4">
                      <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">Search</label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search notices..."
                          value={searchQuery}
                          onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setCurrentPage(1);
                          }}
                          className="w-full h-9 pl-10 pr-4 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                        />
                      </div>
                    </div>
                    <div className="sm:col-span-1 lg:col-span-4">
                      <Select label="Status" value={statusFilter} onChange={(value) => { setStatusFilter(value as StatusFilter); setCurrentPage(1); }} options={STATUS_OPTIONS} placeholder="All" />
                    </div>
                    <div className="sm:col-span-1 lg:col-span-4">
                      <Select label="Channel" value={channelFilter} onChange={(value) => { setChannelFilter(value as ChannelFilter); setCurrentPage(1); }} options={CHANNEL_OPTIONS} placeholder="All" />
                    </div>
                    <div className="sm:col-span-1 lg:col-span-4">
                      <DateRangePicker
                        label="Sent Date Range"
                        startDate={sentFromDate}
                        endDate={sentToDate}
                        onStartDateChange={(v) => { setSentFromDate(v); setCurrentPage(1); }}
                        onEndDateChange={(v) => { setSentToDate(v); setCurrentPage(1); }}
                        placeholder="Select range"
                      />
                    </div>
                    {/* The two buttons share the row of the date range, on its right. */}
                    <div className="flex justify-end gap-2 sm:col-span-1 lg:col-span-8">
                      <ClearFiltersButton onClearSearch={() => setSearchQuery("")} onClear={clearFilters} disabled={!hasActiveFilters} />
                      {control}
                    </div>
                  </div>
                </ConfiguredDesktopFilters>
              </div>

              <div className="flex-1 overflow-hidden border border-slate-200 rounded-xl bg-white shadow-sm flex flex-col">
                <DataTable
                  rows={items}
                  getRowKey={(item) => item.id}
                  columns={layout.columns}
                  columnLayout={layout}
                  emptyState={<TableEmptyState title="No notices found" description="Try adjusting your search or filters" />}
                  pagination={
                    totalItems > 0 ? (
                      <TablePagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} onItemsPerPageChange={setItemsPerPage} />
                    ) : undefined
                  }
                />
              </div>

              <AlertModal
                isOpen={showRunModal}
                onClose={() => setShowRunModal(false)}
                onConfirm={runReminders}
                type="confirm"
                title="Run the reminders now?"
                description={
                  <p className="text-sm text-slate-600">
                    This sends today's reminders at once: trainings due soon, trainings overdue, steps waiting for a person, and the attendance list for QA.
                    A reminder already sent for the same day or week is not sent again. The run is recorded in the Audit Trail.
                  </p>
                }
                confirmText="Run Reminders"
                cancelText="Cancel"
                isLoading={isRunning}
              />

              <AlertModal
                isOpen={resultModal.isOpen}
                onClose={() => setResultModal((prev) => ({ ...prev, isOpen: false }))}
                title={resultModal.title}
                description={resultModal.description}
                type={resultModal.type}
                confirmText="OK"
                showCancel={false}
              />

              <FilterDrawer isOpen={isFilterDrawerOpen} onClose={() => setIsFilterDrawerOpen(false)} onClear={clearFilters} onApply={() => setIsFilterDrawerOpen(false)}>
                <FilterAccordionItem label="Status" isExpanded={expandedSections.has("status")} onToggle={() => toggleSection("status")}>
                  <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
                    {STATUS_OPTIONS.map((opt) => (
                      <button key={opt.value} onClick={() => { setStatusFilter(opt.value as StatusFilter); setCurrentPage(1); }} className={getOptionClassName(statusFilter === opt.value)}>
                        <span className="text-xs">{opt.label}</span>
                        {statusFilter === opt.value && <Check size={16} className="text-emerald-500" />}
                      </button>
                    ))}
                  </div>
                </FilterAccordionItem>
                <FilterAccordionItem label="Channel" isExpanded={expandedSections.has("channel")} onToggle={() => toggleSection("channel")}>
                  <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
                    {CHANNEL_OPTIONS.map((opt) => (
                      <button key={opt.value} onClick={() => { setChannelFilter(opt.value as ChannelFilter); setCurrentPage(1); }} className={getOptionClassName(channelFilter === opt.value)}>
                        <span className="text-xs">{opt.label}</span>
                        {channelFilter === opt.value && <Check size={16} className="text-emerald-500" />}
                      </button>
                    ))}
                  </div>
                </FilterAccordionItem>
                <FilterAccordionItem label="Sent Date Range" isExpanded={expandedSections.has("date")} onToggle={() => toggleSection("date")}>
                  <div className="pt-2 pb-4">
                    <DateRangePicker
                      label=""
                      startDate={sentFromDate}
                      endDate={sentToDate}
                      onStartDateChange={(v) => { setSentFromDate(v); setCurrentPage(1); }}
                      onEndDateChange={(v) => { setSentToDate(v); setCurrentPage(1); }}
                      placeholder="Select range"
                    />
                  </div>
                </FilterAccordionItem>
              </FilterDrawer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
