import { Drawer, type DrawerHandle } from "@/components/ui/drawer";
import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { User, FileText, Download, Send, TrendingUp, GraduationCap, Info } from "lucide-react";
import { Button } from "@/components/ui/button/Button";
import { FullPageLoading } from "@/components/ui/loading";
import { cn } from "@/components/ui/utils";
import { FormSection } from "@/components/ui/form";
import { Progress } from "@/components/ui";
import { ROUTES } from "@/app/routes.constants";
import { formatDate } from "./constants";
import type { EmployeeRow, SOPColumn } from "../../types";
import { MOCK_SOPS, MOCK_EMPLOYEES, getCell } from "../../mockData";

// ─── Props ────────────────────────────────────────────────────────────
export interface HeaderActionDrawerProps {
    type: "employee" | "sop";
    /** Full EmployeeRow when type="employee", full SOPColumn when type="sop" */
    data: EmployeeRow | SOPColumn;
    onClose: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────
const EMPLOYEE_ACTIONS = [
    { icon: Send, label: "Assign Training" },
    { icon: Download, label: "Export Report" },
] as const;

const SOP_ACTIONS = [
    { icon: Send, label: "Assign Training" },
    { icon: Download, label: "Export Report" },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────
const getInitials = (name: string) =>
    name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]).join("").toUpperCase();

const getRateColors = (rate: number) => {
    if (rate >= 80) return { text: "text-emerald-600", bar: "bg-emerald-500" };
    if (rate >= 60) return { text: "text-amber-600", bar: "bg-amber-500" };
    return { text: "text-red-600", bar: "bg-red-500" };
};

const StatTile: React.FC<{
    value: number;
    label: string;
    color: string;
    bg: string;
}> = ({ value, label, color, bg }) => (
    <div className={cn("rounded-lg p-2.5 text-center", bg)}>
        <p className={cn("text-xl font-bold leading-none mb-1", color)}>{value}</p>
        <p className="text-2xs text-slate-500 font-medium leading-tight">{label}</p>
    </div>
);

// ─── Main Component ───────────────────────────────────────────────────
export const HeaderActionDrawer: React.FC<HeaderActionDrawerProps> = ({
  type,
  data,
  onClose,
}) => {
  const drawer = React.useRef<DrawerHandle>(null);
  const handleClose = () => drawer.current?.close();

  const navigate = useNavigate();
  const [isNavigating, setIsNavigating] = useState(false);

  const handleNavigate = (path: string) => {
    setIsNavigating(true);
    setTimeout(() => navigate(path), 600);
  };

  // ── Employee compliance stats ───────────────────────────────────
  const employeeStats = useMemo(() => {
    if (type !== "employee") return null;
    const emp = data as EmployeeRow;
    const required = MOCK_SOPS.filter((sop) => {
      const cell = getCell(emp.id, sop.id);
      return cell && cell.status !== "NotRequired";
    });
    const qualified = required.filter((sop) => getCell(emp.id, sop.id)?.status === "Qualified").length;
    const overdue = required.filter((sop) => getCell(emp.id, sop.id)?.status === "Required").length;
    const inProgress = required.filter((sop) => getCell(emp.id, sop.id)?.status === "InProgress").length;
    const total = required.length;
    const rate = total > 0 ? Math.round((qualified / total) * 100) : 100;
    return { qualified, overdue, inProgress, total, rate };
  }, [type, data]);

  // ── SOP compliance stats ────────────────────────────────────────
  const sopStats = useMemo(() => {
    if (type !== "sop") return null;
    const sop = data as SOPColumn;
    const required = MOCK_EMPLOYEES.filter((emp) => {
      const cell = getCell(emp.id, sop.id);
      return cell && cell.status !== "NotRequired";
    });
    const qualified = required.filter((emp) => getCell(emp.id, sop.id)?.status === "Qualified").length;
    const overdue = required.filter((emp) => getCell(emp.id, sop.id)?.status === "Required").length;
    const inProgress = required.filter((emp) => getCell(emp.id, sop.id)?.status === "InProgress").length;
    const total = required.length;
    const rate = total > 0 ? Math.round((qualified / total) * 100) : 100;
    return { qualified, overdue, inProgress, total, rate };
  }, [type, data]);

  const stats = type === "employee" ? employeeStats : sopStats;
  const empData = type === "employee" ? (data as EmployeeRow) : null;
  const sopData = type === "sop" ? (data as SOPColumn) : null;
  const actions = type === "employee" ? EMPLOYEE_ACTIONS : SOP_ACTIONS;
  const rateColors = getRateColors(stats?.rate ?? 100);


  return <><Drawer
    ref={drawer}
    onClose={onClose}
    title={empData?.fullName ?? sopData?.title ?? "Training details"}
    subtitle={empData ? "Employee" : "Training Course"}
    icon={empData ? <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-emerald-200 bg-emerald-100 text-xs font-bold text-emerald-700">{getInitials(empData.fullName)}</span> : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-blue-50"><FileText className="h-4 w-4 text-blue-600" /></span>}
    bodyClassName="space-y-5"
    footer={<>
      <Button variant="outline" size="sm" onClick={handleClose} className="text-xs sm:text-sm">
        Close
      </Button>
    </>}
  >

    {/* Quick Actions buttons */}
    <div className="grid grid-cols-2 gap-3">
      {actions.map(({ icon: Icon, label: actionLabel }) => (
        <Button
          key={actionLabel}
          variant="outline-emerald"
          size="sm"
          onClick={() => {
            if (actionLabel === "Assign Training") {
              if (type === "employee") {
                handleNavigate(ROUTES.TRAINING.ASSIGNMENT_NEW + `?employeeId=${(data as EmployeeRow).id}`);
              } else {
                handleNavigate(ROUTES.TRAINING.ASSIGNMENT_NEW + `?courseId=${(data as SOPColumn).id}`);
              }
            }
            handleClose();
          }}
          className="w-full gap-2 text-xs sm:text-sm"
        >
          <Icon className="h-4 w-4" />
          {actionLabel}
        </Button>
      ))}
    </div>

    {/* Identification / Info Card */}
    <FormSection
      title={empData ? "Personnel Information" : "Course Information"}
      icon={empData ? <User className="h-4 w-4" /> : <GraduationCap className="h-4 w-4" />}
    >
      {empData ? (
        <div className="space-y-3">
          {/* Name */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 pb-2.5 sm:pb-3 border-b border-slate-100">
            <label className="text-2xs sm:text-xs font-normal text-slate-500 sm:text-slate-600 w-full sm:w-[150px] flex-shrink-0">Full Name</label>
            <p className="text-xs sm:text-sm text-slate-900 font-semibold flex-1">{empData.fullName}</p>
          </div>
          {/* Employee ID */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 pb-2.5 sm:pb-3 border-b border-slate-100">
            <label className="text-2xs sm:text-xs font-normal text-slate-500 sm:text-slate-600 w-full sm:w-[150px] flex-shrink-0">Employee ID</label>
            <a
              href={ROUTES.SETTINGS.USERS_PROFILE(empData.id)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs sm:text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:underline transition-colors flex-1 text-left"
            >
              {empData.employeeCode}
            </a>
          </div>
          {/* Email */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 pb-2.5 sm:pb-3 border-b border-slate-100">
            <label className="text-2xs sm:text-xs font-normal text-slate-500 sm:text-slate-600 w-full sm:w-[150px] flex-shrink-0">Email</label>
            <p className="text-xs sm:text-sm text-slate-900 flex-1">{empData.email}</p>
          </div>
          {/* Department */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 pb-2.5 sm:pb-3 border-b border-slate-100">
            <label className="text-2xs sm:text-xs font-normal text-slate-500 sm:text-slate-600 w-full sm:w-[150px] flex-shrink-0">Department</label>
            <p className="text-xs sm:text-sm text-slate-900 flex-1">{empData.department}</p>
          </div>
          {/* Position */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
            <label className="text-2xs sm:text-xs font-normal text-slate-500 sm:text-slate-600 w-full sm:w-[150px] flex-shrink-0">Position</label>
            <p className="text-xs sm:text-sm text-slate-900 flex-1">{empData.position}</p>
          </div>
        </div>
      ) : sopData ? (
        <div className="space-y-3">
          {/* General Course Information */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 pb-2.5 sm:pb-3 border-b border-slate-100">
            <label className="text-2xs sm:text-xs font-normal text-slate-500 sm:text-slate-600 w-full sm:w-[150px] flex-shrink-0">Course Name</label>
            <p className="text-xs sm:text-sm text-slate-900 font-semibold flex-1">{sopData.title}</p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 pb-2.5 sm:pb-3 border-b border-slate-100">
            <label className="text-2xs sm:text-xs font-normal text-slate-500 sm:text-slate-600 w-full sm:w-[150px] flex-shrink-0">Course ID</label>
            <a
              href={ROUTES.TRAINING.COURSE_DETAIL(sopData.id)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs sm:text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:underline transition-colors flex-1 text-left"
            >
              {sopData.documentNumber}
            </a>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 pb-2.5 sm:pb-3 border-b border-slate-100">
            <label className="text-2xs sm:text-xs font-normal text-slate-500 sm:text-slate-600 w-full sm:w-[150px] flex-shrink-0">Training Type</label>
            <p className="text-xs sm:text-sm text-slate-900 flex-1">{sopData.category}</p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
            <label className="text-2xs sm:text-xs font-normal text-slate-500 sm:text-slate-600 w-full sm:w-[150px] flex-shrink-0">Training Method</label>
            <p className="text-xs sm:text-sm text-slate-900 flex-1">Self-study</p>
          </div>
        </div>
      ) : null}
    </FormSection>

    {/* Dedicated Material Information Card */}
    {sopData && (
      <FormSection title="Material Information" icon={<Info className="h-4 w-4" />}>
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 pb-2.5 sm:pb-3 border-b border-slate-100">
            <label className="text-2xs sm:text-xs font-normal text-slate-500 sm:text-slate-600 w-full sm:w-[150px] flex-shrink-0">Material Name</label>
            <p className="text-xs sm:text-sm text-slate-900 flex-1">{sopData.materialName}</p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 pb-2.5 sm:pb-3 border-b border-slate-100">
            <label className="text-2xs sm:text-xs font-normal text-slate-500 sm:text-slate-600 w-full sm:w-[150px] flex-shrink-0">Material Number</label>
            <a
              href={ROUTES.TRAINING.MATERIAL_DETAIL(sopData.materialNumber)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs sm:text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:underline transition-colors flex-1 text-left"
            >
              {sopData.materialNumber}
            </a>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 pb-2.5 sm:pb-3 border-b border-slate-100">
            <label className="text-2xs sm:text-xs font-normal text-slate-500 sm:text-slate-600 w-full sm:w-[150px] flex-shrink-0">Version</label>
            <p className="text-xs sm:text-sm text-slate-900 flex-1">{sopData.version}</p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
            <label className="text-2xs sm:text-xs font-normal text-slate-500 sm:text-slate-600 w-full sm:w-[150px] flex-shrink-0">Effective Date</label>
            <p className="text-xs sm:text-sm text-slate-900 flex-1">{formatDate(sopData.effectiveDate)}</p>
          </div>
        </div>
      </FormSection>
    )}

    {/* Compliance summary card */}
    {stats && (
      <FormSection title="Training Compliance" icon={<TrendingUp className="h-4 w-4" />}>
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-500">Compliance Rate</span>
            <span className={cn("text-sm font-bold tabular-nums", rateColors.text)}>
              {stats.rate}%
            </span>
          </div>
          <Progress
            value={stats.rate}
            variant={stats.rate >= 80 ? "success" : stats.rate >= 60 ? "warning" : "error"}
            animated
          />
          <p className="mt-1.5 text-2xs text-slate-400">
            {stats.qualified} qualified out of {stats.total} required
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <StatTile value={stats.qualified} label="Qualified" color="text-emerald-600" bg="bg-emerald-50" />
          <StatTile value={stats.overdue} label="Required" color="text-red-600" bg="bg-red-50" />
          <StatTile value={stats.inProgress} label="In Progress" color="text-amber-600" bg="bg-amber-50" />
        </div>
      </FormSection>
    )}

  </Drawer>
    {isNavigating && <FullPageLoading text="Navigating..." />}
  </>;
};
