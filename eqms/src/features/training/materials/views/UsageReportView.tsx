import React, { useState, useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ROUTES } from "@/app/routes.constants";
import { navigateBack } from "@/app/navigation/backNavigation";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import {
  ArrowLeft,
  GraduationCap,
  Users,
  TrendingUp,
  Calendar,
  BarChart3,
  CheckCircle,
  Check,
  Clock,
  XCircle,
  Search,
  X,
  Download,
  FileText,
  Video,
  FileImage,
  GitBranch,
  Building2,
  Award,
  Activity,
  Eye,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { materialUsageReport } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { Button } from "@/components/ui/button/Button";
import { StatusBadge, type StatusType } from "@/components/ui/badge";
import { formatDateUS } from "@/utils/format";
import { Select } from "@/components/ui/select/Select";
import { cn } from "@/components/ui/utils";
import { Progress } from "@/components/ui";
import {
  MOCK_USAGE_REPORT_MATERIAL_INFO,
  MOCK_USAGE_REPORT_COURSES,
  getFallbackUsageReportCourses,
  type UsageCourseRecord,
  type UsageReportMaterialType,
  type UsageReportCourseStatus,
} from "./usageReportMockData";

// ─── Helpers ────────────────────────────────────────────────────────

const getTypeIcon = (type: UsageReportMaterialType) => {
  switch (type) {
    case "Video": return <Video className="h-5 w-5 text-purple-600" />;
    case "PDF": return <FileText className="h-5 w-5 text-red-600" />;
    case "Image": return <FileImage className="h-5 w-5 text-blue-600" />;
    default: return <GraduationCap className="h-5 w-5 text-slate-600" />;
  }
};

const getCourseStatusConfig = (status: UsageReportCourseStatus): { label: string; type: StatusType } => {
  switch (status) {
    case "Active":
      return { label: "Active", type: "current" };
    case "In Progress":
      return { label: "In Progress", type: "inProgress" };
    case "Completed":
      return { label: "Completed", type: "completed" };
    case "Cancelled":
      return { label: "Cancelled", type: "cancelled" };
  }
};

// ─── Component ──────────────────────────────────────────────────────
export const UsageReportView: React.FC = () => {
  const { materialId } = useParams<{ materialId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [isNavigating, setIsNavigating] = useState(false);
  const [expandedCourseIds, setExpandedCourseIds] = useState<Set<string>>(new Set());

  const handleNavigate = (path: string) => {
    setIsNavigating(true);
    setTimeout(() => navigate(path), 600);
  };

  const handleBack = () => {
    setIsNavigating(true);
    setTimeout(() => navigateBack(navigate, location.state, ROUTES.TRAINING.MATERIALS), 600);
  };

  const toggleCourseDetails = (courseId: string) => {
    setExpandedCourseIds((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) {
        next.delete(courseId);
      } else {
        next.add(courseId);
      }
      return next;
    });
  };

  const material = MOCK_USAGE_REPORT_MATERIAL_INFO[materialId ?? ""] ?? null;
  const allRecords: UsageCourseRecord[] = materialId
    ? (MOCK_USAGE_REPORT_COURSES[materialId] ?? getFallbackUsageReportCourses(materialId))
    : [];

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [departmentFilter, setDepartmentFilter] = useState("All");

  const statusOptions = [
    { label: "All Statuses", value: "All" },
    { label: "Active", value: "Active" },
    { label: "In Progress", value: "In Progress" },
    { label: "Completed", value: "Completed" },
    { label: "Cancelled", value: "Cancelled" },
  ];

  const departmentOptions = useMemo(() => {
    const depts = [...new Set(allRecords.map((r) => r.department))].sort();
    return [{ label: "All Departments", value: "All" }, ...depts.map((d) => ({ label: d, value: d }))];
  }, [allRecords]);

  const filteredRecords = useMemo(() => {
    return allRecords.filter((r) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q ||
        r.courseId.toLowerCase().includes(q) ||
        r.courseName.toLowerCase().includes(q) ||
        r.department.toLowerCase().includes(q) ||
        r.instructor.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "All" || r.courseStatus === statusFilter;
      const matchesDept = departmentFilter === "All" || r.department === departmentFilter;
      return matchesSearch && matchesStatus && matchesDept;
    });
  }, [allRecords, searchQuery, statusFilter, departmentFilter]);

  // Summary stats
  const stats = useMemo(() => {
    const totalCourses = allRecords.length;
    const totalLearners = allRecords.reduce((s, r) => s + r.learnersEnrolled, 0);
    const totalCompleted = allRecords.reduce((s, r) => s + r.learnersCompleted, 0);
    const completionRate = totalLearners > 0 ? Math.round((totalCompleted / totalLearners) * 100) : 0;
    const activeCourses = allRecords.filter((r) => r.courseStatus === "Active" || r.courseStatus === "In Progress").length;
    const currentVersionCourses = allRecords.filter((r) => r.isCurrentVersion).length;
    const departments = new Set(allRecords.map((r) => r.department)).size;
    const versionsUsed = new Set(allRecords.map((r) => r.materialVersion)).size;
    return { totalCourses, totalLearners, totalCompleted, completionRate, activeCourses, currentVersionCourses, departments, versionsUsed };
  }, [allRecords]);

  // Version breakdown
  const versionBreakdown = useMemo(() => {
    const map: Record<string, { count: number; learners: number; completed: number }> = {};
    allRecords.forEach((r) => {
      if (!map[r.materialVersion]) map[r.materialVersion] = { count: 0, learners: 0, completed: 0 };
      map[r.materialVersion].count++;
      map[r.materialVersion].learners += r.learnersEnrolled;
      map[r.materialVersion].completed += r.learnersCompleted;
    });
    return Object.entries(map)
      .map(([version, d]) => ({ version, ...d, rate: d.learners > 0 ? Math.round((d.completed / d.learners) * 100) : 0 }))
      .sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));
  }, [allRecords]);

  // Department breakdown
  const deptBreakdown = useMemo(() => {
    const map: Record<string, { count: number; learners: number }> = {};
    allRecords.forEach((r) => {
      if (!map[r.department]) map[r.department] = { count: 0, learners: 0 };
      map[r.department].count++;
      map[r.department].learners += r.learnersEnrolled;
    });
    return Object.entries(map)
      .map(([dept, d]) => ({ dept, ...d }))
      .sort((a, b) => b.count - a.count);
  }, [allRecords]);

  const maxDeptCount = deptBreakdown[0]?.count ?? 1;

  if (!material) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
          <BarChart3 className="h-8 w-8 text-red-500" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900">Material Not Found</h2>
        <Button variant="outline-emerald" size="sm" onClick={handleBack} className="whitespace-nowrap gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Materials
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 w-full min-w-0 flex-1 flex flex-col">
      {/* ─── Header ──────────────────────────────────────────────── */}
      <PageHeader
        title="Usage Report"
        breadcrumbItems={materialUsageReport(navigate)}
        actions={
          <>

            <Button variant="outline-emerald" size="sm" onClick={handleBack} className="whitespace-nowrap gap-2">
              Back
            </Button>
            <Button variant="outline" size="sm" onClick={() => console.log("Export report")} className="gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
          </>
        }
      />

      {/* ─── Material Info Card ───────────────────────────────────── */}
      <div className="relative bg-white rounded-lg sm:rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex flex-col gap-3 p-3 pr-28 sm:flex-row sm:items-start sm:gap-4 sm:p-4 sm:pr-32 md:p-5 md:pr-36">
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 flex-wrap sm:items-center sm:gap-3">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-2xs font-bold bg-purple-100 text-purple-700 border border-purple-200 flex-shrink-0">
                {material.materialNumber}
              </span>
              <h2 className="w-full text-sm font-semibold leading-snug text-slate-900 break-words sm:w-auto sm:min-w-0 sm:flex-1 sm:text-base sm:truncate">{material.title}</h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 flex-shrink-0">
                v{material.currentVersion} (current)
              </span>
            </div>
            <div className="grid grid-cols-1 gap-1.5 mt-2 text-xs text-slate-500 sm:flex sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-1">
              <span className="flex min-w-0 items-center gap-1"><Building2 className="h-3.5 w-3.5 flex-shrink-0" /> <span className="truncate">{material.department}</span></span>
              <span className="flex min-w-0 items-center gap-1"><GitBranch className="h-3.5 w-3.5 flex-shrink-0" /> <span>{material.allVersions.length} versions published</span></span>
              <span className="flex min-w-0 items-center gap-1"><Calendar className="h-3.5 w-3.5 flex-shrink-0" /> <span>Uploaded {formatDateUS(material.uploadedAt)}</span></span>
            </div>
          </div>
          <div className="absolute right-3 top-3 sm:right-4 sm:top-4 md:right-5 md:top-5">
            <button
              onClick={() => handleNavigate(ROUTES.TRAINING.MATERIAL_DETAIL(materialId ?? ""))}
              className="inline-flex items-center justify-center gap-1 px-2 py-1 text-2xs font-medium text-slate-700 border border-slate-200 rounded-md bg-white hover:bg-slate-50 transition-colors"
            >
              <Eye className="h-3.5 w-3.5" />
              View Detail
            </button>
          </div>
        </div>
      </div>

      {/* ─── Summary Stats ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <div className="bg-white p-3 sm:p-4 md:p-5 rounded-lg sm:rounded-xl border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 font-medium">Total Courses</p>
              <p className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">{stats.totalCourses}</p>
              <p className="text-xs text-slate-400 mt-0.5">{stats.activeCourses} currently active</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-3 sm:p-4 md:p-5 rounded-lg sm:rounded-xl border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Users className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 font-medium">Total Learners</p>
              <p className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">{stats.totalLearners.toLocaleString()}</p>
              <p className="text-xs text-slate-400 mt-0.5">{stats.totalCompleted.toLocaleString()} completed</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-3 sm:p-4 md:p-5 rounded-lg sm:rounded-xl border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 font-medium">Completion Rate</p>
              <p className={cn("text-xl sm:text-2xl font-bold leading-tight", stats.completionRate >= 80 ? "text-emerald-700" : stats.completionRate >= 60 ? "text-amber-700" : "text-red-700")}>
                {stats.completionRate}%
              </p>
              <p className="text-xs text-slate-400 mt-0.5">across all courses</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-3 sm:p-4 md:p-5 rounded-lg sm:rounded-xl border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
              <GitBranch className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 font-medium">Versions Used</p>
              <p className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">{stats.versionsUsed}</p>
              <p className="text-xs text-slate-400 mt-0.5">{stats.departments} departments</p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Charts Row ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:gap-5 xl:grid-cols-3">
        {/* Version Breakdown */}
        <div className="bg-white rounded-lg sm:rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-start justify-between gap-3 px-3 py-3 border-b border-slate-100 sm:items-center sm:px-5 sm:py-4">
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-purple-600" />
              <h3 className="text-sm font-semibold text-slate-900">Usage by Version</h3>
            </div>
            <span className="text-right text-xs text-slate-500">{versionBreakdown.length} version{versionBreakdown.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="p-3 sm:p-4 md:p-5 space-y-4">
            {versionBreakdown.map(({ version, count, learners, completed, rate }) => {
              const isCurrent = version === material.currentVersion;
              const pct = Math.round((count / stats.totalCourses) * 100);
              return (
                <div key={version} className="space-y-1.5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border flex-shrink-0",
                        isCurrent ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-slate-100 text-slate-700 border-slate-200"
                      )}>
                        v{version}
                      </span>
                      {isCurrent && <span className="text-xs text-emerald-600 font-medium">(current)</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs flex-shrink-0">
                      <span className="text-slate-500"><span className="font-semibold text-slate-700">{count}</span> courses</span>
                      <span className="text-slate-500"><span className="font-semibold text-slate-700">{learners}</span> learners</span>
                      <span className={cn("font-semibold", rate >= 80 ? "text-emerald-600" : rate >= 60 ? "text-amber-600" : "text-red-600")}>
                        {rate}%
                      </span>
                    </div>
                  </div>
                  <Progress
                    value={pct}
                    size="md"
                    variant={isCurrent ? "success" : "default"}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Department Breakdown */}
        <div className="bg-white rounded-lg sm:rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-3 border-b border-slate-100 sm:px-5 sm:py-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-slate-900">Usage by Department</h3>
            </div>
          </div>
          <div className="p-3 sm:p-4 md:p-5 space-y-3">
            {deptBreakdown.map(({ dept, count, learners }) => {
              const pct = Math.round((count / maxDeptCount) * 100);
              return (
                <div key={dept} className="space-y-1">
                  <div className="flex flex-col gap-1 text-xs sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-medium text-slate-700 break-words sm:mr-2 sm:truncate">{dept}</span>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 flex-shrink-0">
                      <span className="text-slate-500"><span className="font-semibold text-slate-700">{count}</span> courses</span>
                      <span className="text-slate-500"><span className="font-semibold text-slate-700">{learners}</span> learners</span>
                    </div>
                  </div>
                  <Progress
                    value={pct}
                    size="md"
                    variant="blue"
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Insights */}
        <div className="bg-white rounded-lg sm:rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-3 py-3 border-b border-slate-100 sm:px-5 sm:py-4">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-600" />
              <h3 className="text-sm font-semibold text-slate-900">Insights</h3>
            </div>
          </div>
          <div className="p-3 sm:p-4 md:p-5 space-y-3">
            <div className="flex items-start gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
              <CheckCircle className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-emerald-800">High Completion</p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  {stats.completionRate}% of enrolled learners finished courses using this material.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <Activity className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-blue-800">Currently Active</p>
                <p className="text-xs text-blue-700 mt-0.5">
                  {stats.activeCourses} course{stats.activeCourses !== 1 ? "s are" : " is"} actively using this material right now.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg border border-purple-100">
              <GitBranch className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-purple-800">Version Adoption</p>
                <p className="text-xs text-purple-700 mt-0.5">
                  {stats.currentVersionCourses} of {stats.totalCourses} courses use the latest v{material.currentVersion}.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <Building2 className="h-4 w-4 text-slate-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-slate-900">Wide Reach</p>
                <p className="text-xs text-slate-600 mt-0.5">
                  Used across {stats.departments} department{stats.departments !== 1 ? "s" : ""} with {stats.totalLearners.toLocaleString()} total learners.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Course History Table ─────────────────────────────────── */}
      <div className="border rounded-xl bg-white overflow-hidden flex flex-col">
        {/* Table header with filters */}
        <div className="p-4 md:p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Course History</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                All courses that have used <span className="font-medium text-slate-700">{material.materialNumber}</span> · {filteredRecords.length} of {allRecords.length} records
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
            {/* Search */}
            <div>
              <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search course ID, name, instructor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-9 pl-10 pr-10 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm placeholder:text-slate-400 transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            <Select
              label="Status"
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as string)}
              options={statusOptions}
              placeholder="All Statuses"
            />
            <Select
              label="Department"
              value={departmentFilter}
              onChange={(v) => setDepartmentFilter(v as string)}
              options={departmentOptions}
              placeholder="All Departments"
            />
          </div>
        </div>

        {/* Table Container */}
        <div className="px-4 md:px-5 pb-4 md:pb-5 flex-1 flex flex-col relative">
          <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col bg-white">
            <div className="lg:hidden p-3 space-y-3">
              {filteredRecords.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center">
                      <BarChart3 className="h-6 w-6 text-slate-300" />
                    </div>
                    <p className="text-sm font-medium text-slate-900">No records found</p>
                    <p className="text-xs text-slate-500">Try adjusting your filters.</p>
                  </div>
                </div>
              ) : (
                filteredRecords.map((record, index) => {
                  const completionRate = record.learnersEnrolled > 0
                    ? Math.round((record.learnersCompleted / record.learnersEnrolled) * 100)
                    : 0;
                  const statusConfig = getCourseStatusConfig(record.courseStatus);
                  const isExpanded = expandedCourseIds.has(record.courseId);

                  return (
                    <div
                      key={record.courseId}
                      className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => toggleCourseDetails(record.courseId)}
                        className="w-full text-left p-3 flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-400">#{index + 1}</span>
                            <span className="text-xs font-semibold text-emerald-700">{record.courseId}</span>
                          </div>
                          <p className="text-sm font-semibold text-slate-900 mt-1">{record.courseName}</p>
                          <p className="text-xs text-slate-500 mt-1">{record.department}</p>
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <StatusBadge
                            status={statusConfig.type}
                            label={statusConfig.label}
                            size="sm"
                          />
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-slate-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-slate-400" />
                          )}
                        </div>
                      </button>

                      <div className="px-3 pb-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-lg bg-slate-50 px-3 py-2">
                            <p className="text-2xs text-slate-500">Version</p>
                            <p className="text-xs font-semibold text-slate-900 mt-0.5">
                              v{record.materialVersion}{record.isCurrentVersion ? " (current)" : ""}
                            </p>
                          </div>
                          <div className="rounded-lg bg-slate-50 px-3 py-2">
                            <p className="text-2xs text-slate-500">Learners</p>
                            <p className="text-xs font-semibold text-slate-900 mt-0.5">
                              {record.learnersCompleted}/{record.learnersEnrolled}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 rounded-lg border border-slate-200 px-3 py-2.5">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-2xs text-slate-500">Completion</p>
                            <span className={cn(
                              "text-xs font-bold",
                              completionRate === 100 ? "text-emerald-600" :
                                completionRate >= 70 ? "text-emerald-600" :
                                  completionRate >= 40 ? "text-amber-600" : "text-slate-500"
                            )}>
                              {completionRate}%
                            </span>
                          </div>
                          <Progress
                            value={completionRate}
                            size="xs"
                            variant={
                              completionRate === 100 ? "success" :
                                completionRate >= 70 ? "success" :
                                  completionRate >= 40 ? "warning" : "default"
                            }
                          />
                        </div>

                        {isExpanded && (
                          <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                            <div className="flex items-start justify-between gap-3 text-xs">
                              <span className="text-slate-500">Instructor</span>
                              <span className="font-medium text-slate-900 text-right">{record.instructor}</span>
                            </div>
                            <div className="flex items-start justify-between gap-3 text-xs">
                              <span className="text-slate-500">Period</span>
                              <span className="font-medium text-slate-900 text-right">
                                {formatDateUS(record.startDate)}
                                {record.endDate ? ` -> ${formatDateUS(record.endDate)}` : " -> Ongoing"}
                              </span>
                            </div>
                            <div className="flex items-start justify-between gap-3 text-xs">
                              <span className="text-slate-500">Department</span>
                              <span className="font-medium text-slate-900 text-right">{record.department}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full min-w-[920px] md:min-w-[1120px] lg:min-w-[1280px] xl:min-w-[1420px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 text-center text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap w-10 sm:w-12">No.</th>
                    <th className="py-3 px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Course ID</th>
                    <th className="py-3 px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Course Name</th>
                    <th className="py-3 px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Department</th>
                    <th className="py-3 px-4 text-center text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Version Used</th>
                    <th className="py-3 px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Instructor</th>
                    <th className="py-3 px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Period</th>
                    <th className="py-3 px-4 text-center text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Learners</th>
                    <th className="py-3 px-4 text-center text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Completion</th>
                    <th className="py-3 px-4 text-center text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center">
                            <BarChart3 className="h-6 w-6 text-slate-300" />
                          </div>
                          <p className="text-sm font-medium text-slate-900">No records found</p>
                          <p className="text-xs text-slate-500">Try adjusting your filters.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((record, index) => {
                      const completionRate = record.learnersEnrolled > 0
                        ? Math.round((record.learnersCompleted / record.learnersEnrolled) * 100)
                        : 0;
                      const statusConfig = getCourseStatusConfig(record.courseStatus);
                      return (
                        <tr key={record.courseId} className="hover:bg-slate-50/80 transition-colors">
                          {/* No */}
                          <td className="py-3 px-4 text-xs sm:text-sm text-center text-slate-500 font-medium">{index + 1}</td>
                          {/* Course ID */}
                          <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
                            <span className="font-medium text-emerald-700">{record.courseId}</span>
                          </td>
                          {/* Course Name */}
                          <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
                            <p className="font-medium text-slate-900">{record.courseName}</p>
                          </td>
                          {/* Department */}
                          <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700">{record.department}</td>
                          {/* Version Used */}
                          <td className="py-3 px-4 text-xs sm:text-sm text-center whitespace-nowrap">
                            <span className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border",
                              record.isCurrentVersion
                                ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                : "bg-slate-100 text-slate-600 border-slate-200"
                            )}>
                              v{record.materialVersion}
                              {record.isCurrentVersion && <Check className="h-3 w-3 text-emerald-600" />}
                            </span>
                          </td>
                          {/* Instructor */}
                          <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-700">{record.instructor}</td>
                          {/* Period */}
                          <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
                            <div className="text-slate-700">{formatDateUS(record.startDate)}</div>
                            {record.endDate ? (
                              <div className="text-xs text-slate-500">→ {formatDateUS(record.endDate)}</div>
                            ) : (
                              <div className="text-xs text-blue-500 font-medium">Ongoing</div>
                            )}
                          </td>
                          {/* Learners */}
                          <td className="py-3 px-4 text-xs sm:text-sm text-center whitespace-nowrap">
                            <span className="font-semibold text-slate-900">{record.learnersCompleted}</span>
                            <span className="text-slate-400 text-xs"> / {record.learnersEnrolled}</span>
                          </td>
                          {/* Completion Rate */}
                          <td className="py-3 px-4 text-xs sm:text-sm text-center whitespace-nowrap">
                            <div className="flex flex-col items-center gap-1">
                              <span className={cn(
                                "text-sm font-bold",
                                completionRate === 100 ? "text-emerald-600" :
                                  completionRate >= 70 ? "text-emerald-600" :
                                    completionRate >= 40 ? "text-amber-600" : "text-slate-500"
                              )}>
                                {completionRate}%
                              </span>
                              <Progress
                                value={completionRate}
                                size="xs"
                                variant={
                                  completionRate === 100 ? "success" :
                                    completionRate >= 70 ? "success" :
                                      completionRate >= 40 ? "warning" : "default"
                                }
                              />
                            </div>
                          </td>
                          {/* Status */}
                          <td className="py-3 px-4 text-xs sm:text-sm text-center whitespace-nowrap">
                            <StatusBadge
                              status={statusConfig.type}
                              label={statusConfig.label}
                              size="sm"
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer summary */}
            {filteredRecords.length > 0 && (
              <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between flex-wrap gap-2">
                <p className="text-xs text-slate-500">
                  Showing <span className="font-semibold text-slate-700">{filteredRecords.length}</span> record{filteredRecords.length !== 1 ? "s" : ""}
                  {filteredRecords.length !== allRecords.length && <> of <span className="font-semibold text-slate-700">{allRecords.length}</span></>}
                </p>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span>Total learners in view: <span className="font-semibold text-slate-700">{filteredRecords.reduce((s, r) => s + r.learnersEnrolled, 0).toLocaleString()}</span></span>
                  <span>Avg. completion: <span className={cn(
                    "font-semibold",
                    (() => {
                      const total = filteredRecords.reduce((s, r) => s + r.learnersEnrolled, 0);
                      const done = filteredRecords.reduce((s, r) => s + r.learnersCompleted, 0);
                      const rate = total > 0 ? Math.round((done / total) * 100) : 0;
                      return rate >= 70 ? "text-emerald-700" : rate >= 40 ? "text-amber-700" : "text-slate-700";
                    })()
                  )}>
                    {(() => {
                      const total = filteredRecords.reduce((s, r) => s + r.learnersEnrolled, 0);
                      const done = filteredRecords.reduce((s, r) => s + r.learnersCompleted, 0);
                      return total > 0 ? `${Math.round((done / total) * 100)}%` : "—";
                    })()}
                  </span></span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Loading Overlay ──────────────────────────────────── */}
      {isNavigating && <FullPageLoading text="Loading..." />}
    </div>
  );
};
