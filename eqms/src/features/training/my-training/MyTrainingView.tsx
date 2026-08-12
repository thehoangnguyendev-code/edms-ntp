import React, { useState, useMemo } from "react";
import {
  CheckCircle2,
  Check,
  Clock,
  ExternalLink,
  FileText,
  GraduationCap,
  PlayCircle,
  Search,
  Trophy,
  Calendar,
  ShieldCheck,
  Star,
  Award,
  ChevronUp,
  ChevronDown,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { cn } from "@/components/ui/utils";
import { TabNav } from "@/components/ui/tabs/TabNav";
import type { TabItem } from "@/components/ui/tabs/TabNav";
import { Badge } from "@/components/ui/badge/Badge";
import type { BadgeColor } from "@/components/ui/badge/Badge";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import * as breadcrumbs from "@/components/ui/breadcrumb/breadcrumbs.config";
import { IconFilter2, IconMenu3, IconTrophy } from "@tabler/icons-react";
import { Select } from "@/components/ui/select/Select";
import { FullPageLoading } from "@/components/ui/loading";
import { useNavigateWithLoading, useTableDragScroll } from "@/hooks";
import { FilterAccordionItem, FilterDrawer } from "@/components/ui/filter/FilterDrawer";

// --- Mock Data ---
interface TrainingTask {
  id: string;
  title: string;
  deadline: string;
  type: string;
  testType: string;
  status: "Assigned" | "Pending" | "Expiring Soon";
  materialType: "PDF" | "Video";
  materialUrl: string;
}

const MOCK_TODO_TASKS: TrainingTask[] = [
  {
    id: "TRN-001",
    title: "Bio-decontamination Standard Operating Procedure",
    deadline: "20/03/2026",
    type: "SOP",
    testType: "Quiz Offline",
    status: "Expiring Soon",
    materialType: "PDF",
    materialUrl: "/sample.pdf",
  },
  {
    id: "TRN-002",
    title: "Cleanroom Safety & Gowning Protocol",
    deadline: "25/03/2026",
    type: "GMP",
    testType: "Hands-on",
    status: "Assigned",
    materialType: "Video",
    materialUrl: "/sample-video.mp4",
  },
  {
    id: "TRN-003",
    title: "Quality Risk Management – ICH Q9",
    deadline: "30/03/2026",
    type: "GMP",
    testType: "Quiz Offline",
    status: "Assigned",
    materialType: "PDF",
    materialUrl: "/sample.pdf",
  },
  {
    id: "TRN-004",
    title: "Data Integrity & ALCOA+ Principles",
    deadline: "10/04/2026",
    type: "Compliance",
    testType: "Written Test",
    status: "Pending",
    materialType: "Video",
    materialUrl: "/sample-video.mp4",
  },
];

interface TranscriptRecord {
  id: string;
  title: string;
  completedDate: string;
  score: number;
  type: string;
  certUrl: string;
}

const MOCK_TRANSCRIPT: TranscriptRecord[] = [
  {
    id: "TRN-PY-001",
    title: "Introduction to GxP Documentation",
    completedDate: "15/01/2026",
    score: 95,
    type: "GMP",
    certUrl: "#",
  },
  {
    id: "TRN-PY-002",
    title: "Cybersecurity Awareness 2026",
    completedDate: "10/01/2026",
    score: 100,
    type: "Compliance",
    certUrl: "#",
  },
  {
    id: "TRN-PY-003",
    title: "Laboratory Equipment Calibration SOP",
    completedDate: "05/01/2026",
    score: 88,
    type: "SOP",
    certUrl: "#",
  },
];

const MY_TRAINING_TABS: TabItem[] = [
  {
    id: "todo",
    label: "To-do List",
    icon: IconMenu3,
    count: MOCK_TODO_TASKS.length,
  },
  {
    id: "transcript",
    label: "My Transcript",
    icon: IconTrophy,
    count: MOCK_TRANSCRIPT.length,
  },
];

// --- Status helpers ---
const TODO_STATUS_MAP: Record<
  TrainingTask["status"],
  { label: string; color: BadgeColor; className?: string }
> = {
  "Expiring Soon": {
    label: "Expiring Soon",
    color: "amber",
    className: "ring-1 ring-inset ring-amber-600/20 animate-pulse",
  },
  Assigned: {
    label: "Assigned",
    color: "blue",
    className: "ring-1 ring-inset ring-blue-600/10",
  },
  Pending: {
    label: "Pending",
    color: "slate",
    className: "ring-1 ring-inset ring-slate-600/10",
  },
};

// --- Main View ---

export const MyTrainingView: React.FC = () => {
  const { navigateTo, isNavigating } = useNavigateWithLoading();
  const [activeTab, setActiveTab] = useState<"todo" | "transcript">("todo");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" }>({
    key: "title",
    direction: "asc",
  });
  const { scrollerRef, isDragging, dragEvents } = useTableDragScroll();

  // Filter states
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [assessmentFilter, setAssessmentFilter] = useState("All");
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["type", "status", "assessment"])
  );

  const pendingCount = MOCK_TODO_TASKS.length;

  // Reset pagination on tab or search change
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId as "todo" | "transcript");
    setCurrentPage(1);
    setSearchQuery("");
    setTypeFilter("All");
    setStatusFilter("All");
    setAssessmentFilter("All");
    setIsFilterDrawerOpen(false);
  };

  const handleSearch = (val: string) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

  const filteredTasks = useMemo(
    () =>
      MOCK_TODO_TASKS.filter((t) => {
        const matchesSearch =
          t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.id.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesType = typeFilter === "All" || t.type === typeFilter;
        const matchesStatus =
          statusFilter === "All" || t.status === statusFilter;
        const matchesAssessment =
          assessmentFilter === "All" || t.testType === assessmentFilter;

        return matchesSearch && matchesType && matchesStatus && matchesAssessment;
      }),
    [searchQuery, typeFilter, statusFilter, assessmentFilter],
  );

  const filteredTranscript = useMemo(
    () =>
      MOCK_TRANSCRIPT.filter((r) => {
        const matchesSearch =
          r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.id.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesType = typeFilter === "All" || r.type === typeFilter;

        return matchesSearch && matchesType;
      }),
    [searchQuery, typeFilter],
  );

  const parseDate = (dStr: string) => {
    if (!dStr) return 0;
    const parts = dStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (parts) {
      return new Date(parseInt(parts[3]), parseInt(parts[2]) - 1, parseInt(parts[1])).getTime();
    }
    return new Date(dStr).getTime();
  };

  const sortedTasks = useMemo(() => {
    return [...filteredTasks].sort((a, b) => {
      const key = sortConfig.key as keyof TrainingTask;
      let valA: any = a[key] || "";
      let valB: any = b[key] || "";

      if (key === 'deadline') {
        valA = parseDate(valA);
        valB = parseDate(valB);
      } else if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
      if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredTasks, sortConfig]);

  const sortedTranscript = useMemo(() => {
    return [...filteredTranscript].sort((a, b) => {
      const key = sortConfig.key as keyof TranscriptRecord;
      let valA: any = a[key] || "";
      let valB: any = b[key] || "";

      if (key === 'completedDate') {
        valA = parseDate(valA);
        valB = parseDate(valB);
      } else if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
      if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredTranscript, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
    setCurrentPage(1);
  };

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

  const getOptionClassName = (isActive: boolean) =>
    cn(
      "w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-all",
      isActive
        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
        : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
    );

  // Pagination
  const activeData = activeTab === "todo" ? sortedTasks : sortedTranscript;
  const totalPages = Math.ceil(activeData.length / itemsPerPage);
  const paginatedTasks = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedTasks.slice(start, start + itemsPerPage);
  }, [sortedTasks, currentPage, itemsPerPage]);
  const paginatedTranscript = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedTranscript.slice(start, start + itemsPerPage);
  }, [sortedTranscript, currentPage, itemsPerPage]);

  return (
    <div className="space-y-4 md:space-y-6 w-full flex-1 flex flex-col pb-8">
      {/* Page Header */}
      <PageHeader
        title="My Training"
        breadcrumbItems={breadcrumbs.myTraining(navigateTo)}
      />

      {/* Hero / Overview Banner */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col md:flex-row relative">
        {/* Decorative background element */}
        <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-emerald-50/50 to-transparent pointer-events-none" />

        {/* Identity Section */}
        <div className="p-4 md:p-5 flex-1 flex items-center gap-5 border-b md:border-b-0 md:border-r border-slate-100 relative z-10">
          <div className="w-16 h-16 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
            <GraduationCap className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              My Training Overview
            </h2>
            <p className="text-slate-500 mt-1 text-sm">
              You have{" "}
              <span className="font-semibold text-emerald-600">
                {pendingCount} assignments
              </span>{" "}
              pending completion.
            </p>
          </div>
        </div>

        {/* Highlight Stats */}
        <div className="flex shrink-0">
          <div className="p-4 md:p-5 flex flex-col items-center justify-center border-r border-slate-100 min-w-[160px] bg-slate-50/30">
            <div className="flex items-center gap-1.5 text-emerald-600 mb-2">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-widest">
                Compliance
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold text-slate-900 tracking-tighter">
                92
              </span>
              <span className="text-xl font-bold text-slate-400">%</span>
            </div>
          </div>
          <div className="p-4 md:p-5 flex flex-col items-center justify-center min-w-[160px] bg-slate-50/30">
            <div className="flex items-center gap-1.5 text-amber-500 mb-2">
              <Star className="h-4 w-4 fill-amber-500" />
              <span className="text-xs font-bold uppercase tracking-widest text-amber-600">
                Credits
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold text-slate-900 tracking-tighter">
                14
              </span>
              <span className="text-xl font-bold text-slate-400">pts</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Card: Tabs + Table ─────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex-1 flex flex-col">
        {/* Tab Navigation — underline variant, identical to MaterialsView */}
        <TabNav
          tabs={MY_TRAINING_TABS}
          activeTab={activeTab}
          onChange={handleTabChange}
          variant="underline"
        />

        {/* ── To-do List Tab ── */}
        {activeTab === "todo" && (
          <div className="p-4 md:p-5 flex-1 flex flex-col">
            {/* Filter / Search row */}
            <div className="flex md:hidden flex-col gap-1.5 w-full mb-4">
              <label className="text-xs sm:text-sm font-medium text-slate-700 block">Search</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search by title or ID..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="block w-full pl-10 pr-9 h-10 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-colors placeholder:text-slate-400"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => handleSearch("")}
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

            <div className="hidden md:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 items-end mb-5">
              <div className="w-full">
                <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">
                  Search
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by title or ID..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="w-full h-9 pl-10 pr-10 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm placeholder:text-slate-400 transition-colors"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => handleSearch("")}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <Select
                label="Training Type"
                value={typeFilter}
                onChange={setTypeFilter}
                options={[
                  { label: "All Types", value: "All" },
                  { label: "SOP", value: "SOP" },
                  { label: "GMP", value: "GMP" },
                  { label: "Compliance", value: "Compliance" },
                ]}
              />

              <Select
                label="Status"
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { label: "All Status", value: "All" },
                  { label: "Assigned", value: "Assigned" },
                  { label: "Pending", value: "Pending" },
                  { label: "Expiring Soon", value: "Expiring Soon" },
                ]}
              />

              <Select
                label="Assessment"
                value={assessmentFilter}
                onChange={setAssessmentFilter}
                options={[
                  { label: "All Assessments", value: "All" },
                  { label: "Quiz Offline", value: "Quiz Offline" },
                  { label: "Hands-on", value: "Hands-on" },
                  { label: "Written Test", value: "Written Test" },
                ]}
              />
            </div>

            {/* Table container */}
            <div className="flex-1 overflow-hidden border border-slate-200 rounded-xl bg-white flex flex-col">
              <div
                ref={scrollerRef}
                className={cn(
                  "overflow-x-auto flex-1 transition-colors",
                  isDragging ? "cursor-grabbing select-none" : "cursor-grab"
                )}
                {...dragEvents}
              >
                <table className="w-full min-w-[800px] md:min-w-[950px] lg:min-w-[1100px] xl:min-w-[1300px]">
                  <thead className="bg-slate-50 border-b-2 border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="py-3 px-4 text-center text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap w-10 sm:w-16">
                        No.
                      </th>
                      {[
                        { label: "Course ID", id: "id", sortable: true },
                        { label: "Course Name", id: "title", sortable: true },
                        { label: "Material", id: "materialType", sortable: true },
                        { label: "Type", id: "type", sortable: true },
                        { label: "Assessment", id: "testType", sortable: true },
                        { label: "Deadline", id: "deadline", sortable: true },
                        { label: "Status", id: "status", sortable: true, align: "text-center" }
                      ].map((col, idx) => {
                        const isSorted = sortConfig.key === col.id;
                        const canSort = col.sortable;
                        return (
                          <th
                            key={idx}
                            onClick={canSort ? () => handleSort(col.id!) : undefined}
                            className={cn(
                              "py-3 px-4 text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap transition-colors",
                              canSort && "cursor-pointer hover:bg-slate-100 hover:text-slate-700 group",
                              col.align || "text-left"
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
                      <th className="sticky right-0 bg-slate-50 py-3 px-4 lg:px-6 text-center text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider z-20 whitespace-nowrap before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[1px] before:bg-slate-200 min-w-[100px] w-[100px] sm:min-w-[120px] sm:w-[120px] md:min-w-[140px] md:w-[140px] lg:min-w-[160px] lg:w-[160px]">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {paginatedTasks.map((task, index) => {
                      const isExpiring = task.status === "Expiring Soon";
                      const statusStyle = TODO_STATUS_MAP[task.status];
                      return (
                        <tr
                          key={task.id}
                          className="hover:bg-slate-50 transition-colors cursor-pointer group"
                        >
                          <td className="py-2.5 px-2 md:py-3 md:px-4 whitespace-nowrap text-center">
                            <div className="text-xs md:text-sm text-slate-500">
                              {(currentPage - 1) * itemsPerPage + index + 1}
                            </div>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="text-xs md:text-sm font-medium text-emerald-600">
                              {task.id}
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 sm:gap-2">
                              <div
                                className={cn(
                                  "flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105",
                                  task.materialType === "PDF"
                                    ? "bg-rose-50 text-rose-600"
                                    : "bg-indigo-50 text-indigo-600",
                                )}
                              >
                                {task.materialType === "PDF" ? (
                                  <FileText className="h-4 w-4" />
                                ) : (
                                  <PlayCircle className="h-4 w-4" />
                                )}
                              </div>
                              <div>
                                <p className="font-medium whitespace-nowrap text-xs md:text-sm text-slate-900 group-hover:text-emerald-700 transition-colors">
                                  {task.title}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="text-xs md:text-sm text-slate-700 font-medium">
                              {task.materialType}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 md:py-3 md:px-4 text-xs md:text-sm whitespace-nowrap text-slate-700">
                            {task.type}
                          </td>
                          <td className="py-2.5 px-2 md:py-3 md:px-4 text-xs md:text-sm whitespace-nowrap text-slate-700">
                            {task.testType}
                          </td>
                          <td className="py-2.5 px-2 md:py-3 md:px-4 text-xs md:text-sm whitespace-nowrap">
                            <div
                              className={cn(
                                "flex items-center gap-1",
                                isExpiring
                                  ? "text-amber-600 font-semibold"
                                  : "text-slate-700",
                              )}
                            >
                              <Calendar
                                className={cn(
                                  "h-3.5 w-3.5",
                                  isExpiring
                                    ? "text-amber-500"
                                    : "text-slate-400",
                                )}
                              />
                              {task.deadline}
                            </div>
                          </td>
                          <td className="py-2.5 px-2 md:py-3 md:px-4 text-xs md:text-sm whitespace-nowrap text-center">
                            <Badge
                              color={statusStyle.color}
                              size="sm"
                              className={cn(
                                "font-bold tracking-wide uppercase",
                                statusStyle.className,
                              )}
                            >
                              {statusStyle.label}
                            </Badge>
                          </td>
                          <td className="sticky right-0 bg-white group-hover:bg-slate-50 py-3 px-4 lg:px-6 text-center whitespace-nowrap z-20 before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[1px] before:bg-slate-200 min-w-[100px] w-[100px] sm:min-w-[120px] sm:w-[120px] md:min-w-[140px] md:w-[140px] lg:min-w-[160px] lg:w-[160px]">
                            <Button
                              size="xs"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                              Start
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {sortedTasks.length > 0 && (
                <TablePagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                  totalItems={sortedTasks.length}
                  itemsPerPage={itemsPerPage}
                  onItemsPerPageChange={setItemsPerPage}
                  showItemCount={true}
                />
              )}

              {sortedTasks.length === 0 && (
                <TableEmptyState
                  icon={<CheckCircle2 className="h-8 w-8 text-emerald-400" />}
                  title="All caught up!"
                  description={
                    searchQuery
                      ? "No assignments match your search. Try a different keyword."
                      : "You have completed all pending training assignments. Great job staying compliant."
                  }
                />
              )}
            </div>
          </div>
        )}

        {/* ── My Transcript Tab ── */}
        {activeTab === "transcript" && (
          <div className="p-4 md:p-5 flex-1 flex flex-col">
            {/* Filter / Search row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6 items-end mb-5">
              <div className="w-full">
                <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">
                  Search
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by title or ID..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="w-full h-9 pl-10 pr-10 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm placeholder:text-slate-400 transition-colors"
                  />
                </div>
              </div>

              <Select
                label="Training Type"
                value={typeFilter}
                onChange={setTypeFilter}
                options={[
                  { label: "All Types", value: "All" },
                  { label: "SOP", value: "SOP" },
                  { label: "GMP", value: "GMP" },
                  { label: "Compliance", value: "Compliance" },
                ]}
              />
            </div>

            {/* Table container */}
            <div className="flex-1 overflow-hidden border border-slate-200 rounded-xl bg-white flex flex-col">
              <div
                ref={scrollerRef}
                className={cn(
                  "overflow-x-auto flex-1 transition-colors",
                  isDragging ? "cursor-grabbing select-none" : "cursor-grab"
                )}
                {...dragEvents}
              >
                <table className="w-full min-w-[800px] md:min-w-[950px] lg:min-w-[1100px] xl:min-w-[1300px]">
                  <thead className="bg-slate-50 border-b-2 border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="py-3 px-4 text-center text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap w-10 sm:w-16">
                        No.
                      </th>
                      {[
                        { label: "Course ID", id: "id", sortable: true },
                        { label: "Course Name", id: "title", sortable: true },
                        { label: "Type", id: "type", sortable: true },
                        { label: "Completed Date", id: "completedDate", sortable: true },
                        { label: "Score", id: "score", sortable: true, align: "text-center" }
                      ].map((col, idx) => {
                        const isSorted = sortConfig.key === col.id;
                        const canSort = col.sortable;
                        return (
                          <th
                            key={idx}
                            onClick={canSort ? () => handleSort(col.id!) : undefined}
                            className={cn(
                              "py-3 px-4 text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap transition-colors",
                              canSort && "cursor-pointer hover:bg-slate-100 hover:text-slate-700",
                              col.align || "text-left"
                            )}
                          >
                            <div className="flex items-center justify-between gap-2 w-full">
                              <span className="truncate">{col.label}</span>
                              {canSort && (
                                <div className="flex flex-col text-slate-400 flex-shrink-0 group-hover:text-slate-500">
                                  <ChevronUp className={cn("h-3 w-3 -mb-1", isSorted && sortConfig.direction === 'asc' ? "text-emerald-600 font-bold" : "")} />
                                  <ChevronDown className={cn("h-3 w-3", isSorted && sortConfig.direction === 'desc' ? "text-emerald-600 font-bold" : "")} />
                                </div>
                              )}
                            </div>
                          </th>
                        );
                      })}
                      <th className="sticky right-0 bg-slate-50 py-3 px-4 lg:px-6 text-center text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider z-20 whitespace-nowrap before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[1px] before:bg-slate-200 w-[80px] sm:w-[150px] md:w-[170px] lg:w-[190px]">
                        E-Certificate
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {paginatedTranscript.map((record, index) => (
                      <tr
                        key={record.id}
                        className="hover:bg-slate-50 transition-colors cursor-pointer group"
                      >
                        <td className="py-2.5 px-2 md:py-3 md:px-4 whitespace-nowrap text-center">
                          <div className="text-xs md:text-sm text-slate-500">
                            {(currentPage - 1) * itemsPerPage + index + 1}
                          </div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="text-xs md:text-sm font-medium text-emerald-600">
                            {record.id}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <div className="flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 group-hover:scale-105 transition-transform">
                              <Award className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="font-medium whitespace-nowrap text-xs md:text-sm text-slate-900 group-hover:text-emerald-700 transition-colors">
                                {record.title}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-2 md:py-3 md:px-4 text-xs md:text-sm whitespace-nowrap text-slate-700">
                          {record.type}
                        </td>
                        <td className="py-2.5 px-2 md:py-3 md:px-4 text-xs md:text-sm whitespace-nowrap text-slate-700">
                          {record.completedDate}
                        </td>
                        <td className="py-2.5 px-2 md:py-3 md:px-4 text-center whitespace-nowrap">
                          <Badge
                            color={record.score >= 90 ? "emerald" : "blue"}
                            pill
                            size="sm"
                            className="font-bold ring-1 ring-inset ring-emerald-600/10"
                          >
                            {record.score}%
                          </Badge>
                        </td>
                        <td className="sticky right-0 bg-white group-hover:bg-slate-50 py-3 px-4 lg:px-6 text-center whitespace-nowrap z-20 before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[1px] before:bg-slate-200 w-[80px] sm:w-[150px] md:w-[170px] lg:w-[190px]">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 gap-1.5 font-semibold h-7 sm:h-8 text-2xs sm:text-xs"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">View Cert</span>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {sortedTranscript.length > 0 && (
                <TablePagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                  totalItems={sortedTranscript.length}
                  itemsPerPage={itemsPerPage}
                  onItemsPerPageChange={setItemsPerPage}
                  showItemCount={true}
                />
              )}

              {sortedTranscript.length === 0 && (
                <TableEmptyState
                  icon={<Trophy className="h-8 w-8 text-slate-300" />}
                  title="No records found"
                  description={
                    searchQuery
                      ? "No transcript records match your search. Try a different keyword."
                      : "Your completed training records will appear here."
                  }
                />
              )}
            </div>
          </div>
        )}
      </div>

      <FilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        onClear={() => {
          setTypeFilter("All");
          setStatusFilter("All");
          setAssessmentFilter("All");
          setCurrentPage(1);
        }}
        onApply={() => setIsFilterDrawerOpen(false)}
        
      >
        <FilterAccordionItem
          label="Training Type"
          isExpanded={expandedSections.has("type")}
          onToggle={() => toggleSection("type")}
        >
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {[
              { label: "All Types", value: "All" },
              { label: "SOP", value: "SOP" },
              { label: "GMP", value: "GMP" },
              { label: "Compliance", value: "Compliance" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setTypeFilter(opt.value);
                  setCurrentPage(1);
                }}
                className={getOptionClassName(typeFilter === opt.value)}
              >
                <span className="text-xs">{opt.label}</span>
                {typeFilter === opt.value && <Check size={16} className="text-emerald-500" />}
              </button>
            ))}
          </div>
        </FilterAccordionItem>

        <FilterAccordionItem
          label="Status"
          isExpanded={expandedSections.has("status")}
          onToggle={() => toggleSection("status")}
        >
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {[
              { label: "All Status", value: "All" },
              { label: "Assigned", value: "Assigned" },
              { label: "Pending", value: "Pending" },
              { label: "Expiring Soon", value: "Expiring Soon" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setStatusFilter(opt.value);
                  setCurrentPage(1);
                }}
                className={getOptionClassName(statusFilter === opt.value)}
              >
                <span className="text-xs">{opt.label}</span>
                {statusFilter === opt.value && <Check size={16} className="text-emerald-500" />}
              </button>
            ))}
          </div>
        </FilterAccordionItem>

        <FilterAccordionItem
          label="Assessment"
          isExpanded={expandedSections.has("assessment")}
          onToggle={() => toggleSection("assessment")}
        >
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {[
              { label: "All Assessments", value: "All" },
              { label: "Quiz Offline", value: "Quiz Offline" },
              { label: "Hands-on", value: "Hands-on" },
              { label: "Written Test", value: "Written Test" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setAssessmentFilter(opt.value);
                  setCurrentPage(1);
                }}
                className={getOptionClassName(assessmentFilter === opt.value)}
              >
                <span className="text-xs">{opt.label}</span>
                {assessmentFilter === opt.value && <Check size={16} className="text-emerald-500" />}
              </button>
            ))}
          </div>
        </FilterAccordionItem>
      </FilterDrawer>

      {isNavigating && <FullPageLoading text="Loading..." />}
    </div>
  );
};
