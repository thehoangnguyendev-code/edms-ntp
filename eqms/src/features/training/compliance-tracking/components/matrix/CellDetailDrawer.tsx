import { Drawer, type DrawerHandle } from "@/components/ui/drawer";
import React, { useState } from "react";
import { User, Trophy, Clock, AlertTriangle, Send, Download, GraduationCap, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button/Button";
import { cn } from "@/components/ui/utils";
import { FormSection } from "@/components/ui/form";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { ROUTES } from "@/app/routes.constants";
import type { TrainingCell, EmployeeRow, SOPColumn } from "../../types";
import { CELL_CONFIG, formatDate } from "./constants";


interface CellDetailDrawerProps {
    cell: TrainingCell;
    employee: EmployeeRow;
    sop: SOPColumn;
    onClose: () => void;
}

export const CellDetailDrawer: React.FC<CellDetailDrawerProps> = ({
  cell,
  employee,
  sop,
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

  const cfg = CELL_CONFIG[cell.status];


  return <Drawer
    ref={drawer}
    onClose={onClose}
    title={cfg.label}
    subtitle="Compliance Tracking"
    icon={<span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", cfg.bg)}><cfg.Icon className={cn("h-4 w-4", cfg.iconColor)} /></span>}
    bodyClassName="space-y-5"
    footer={<>
      <Button variant="outline" size="sm" onClick={handleClose} className="text-xs sm:text-sm">Close</Button>
    </>}
  >

    {/* Quick Actions buttons */}
    <div className="grid grid-cols-2 gap-3">
      <Button
        variant="outline-emerald"
        size="sm"
        onClick={() => {
          handleNavigate(ROUTES.TRAINING.ASSIGNMENT_NEW + `?employeeId=${employee.id}&courseId=${sop.id}`);
          handleClose();
        }}
        className="w-full gap-2"
      >
        <Send className="h-4 w-4" />
        Assign Training
      </Button>
      <Button
        variant="outline-emerald"
        size="sm"
        onClick={handleClose}
        className="w-full gap-2"
      >
        <Download className="h-4 w-4" />
        Export Report
      </Button>
    </div>

    {/* ── Contextual alert for Required / InProgress ── */}
    {(cell.status === "Required" || cell.status === "InProgress") && (() => {
      const isRequired = cell.status === "Required";
      return (
        <div className={cn(
          "rounded-xl px-4 py-3 flex items-start gap-3 border",
          isRequired
            ? "bg-red-50 border-red-200"
            : "bg-amber-50 border-amber-200"
        )}>
          <AlertTriangle className={cn("h-4 w-4 mt-0.5 shrink-0", isRequired ? "text-red-500" : "text-amber-500")} />
          <div>
            <p className={cn("text-xs font-bold mb-0.5", isRequired ? "text-red-800" : "text-amber-800")}>
              {isRequired ? "Training Required" : "Training In Progress"}
            </p>
            <p className={cn("text-2xs leading-relaxed", isRequired ? "text-red-600" : "text-amber-600")}>
              {isRequired
                ? "Employee must complete training for compliance."
                : "A training assignment is currenty in progress."}
            </p>
          </div>
        </div>
      );
    })()}

    {/* Identification Info */}
    <div className="grid grid-cols-1 gap-5">
      {/* Employee card */}
      <FormSection title="Personnel Information" icon={<User className="h-4 w-4" />}>
        <div className="space-y-3">
          {/* Name */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 pb-2.5 sm:pb-3 border-b border-slate-100">
            <label className="text-2xs sm:text-xs font-normal text-slate-500 sm:text-slate-600 w-full sm:w-[150px] flex-shrink-0">Full Name</label>
            <p className="text-xs sm:text-sm text-slate-900 font-semibold flex-1">{employee.fullName}</p>
          </div>
          {/* Employee ID */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 pb-2.5 sm:pb-3 border-b border-slate-100">
            <label className="text-2xs sm:text-xs font-normal text-slate-500 sm:text-slate-600 w-full sm:w-[150px] flex-shrink-0">Employee ID</label>
            <a
              href={ROUTES.SETTINGS.USERS_PROFILE(employee.id)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs sm:text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:underline transition-colors flex-1 text-left"
            >
              {employee.employeeCode}
            </a>
          </div>
          {/* Email */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 pb-2.5 sm:pb-3 border-b border-slate-100">
            <label className="text-2xs sm:text-xs font-normal text-slate-500 sm:text-slate-600 w-full sm:w-[150px] flex-shrink-0">Email</label>
            <p className="text-xs sm:text-sm text-slate-900 flex-1">{employee.email}</p>
          </div>
          {/* Department */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 pb-2.5 sm:pb-3 border-b border-slate-100">
            <label className="text-2xs sm:text-xs font-normal text-slate-500 sm:text-slate-600 w-full sm:w-[150px] flex-shrink-0">Department</label>
            <p className="text-xs sm:text-sm text-slate-900 flex-1">{employee.department}</p>
          </div>
          {/* Position */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
            <label className="text-2xs sm:text-xs font-normal text-slate-500 sm:text-slate-600 w-full sm:w-[150px] flex-shrink-0">Position</label>
            <p className="text-xs sm:text-sm text-slate-900 flex-1">{employee.position}</p>
          </div>
        </div>
      </FormSection>

      {/* Course Information card */}
      <FormSection title="Course Information" icon={<GraduationCap className="h-4 w-4" />}>
        <div className="space-y-3">
          {/* General Course Information */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 pb-2.5 sm:pb-3 border-b border-slate-100">
            <label className="text-2xs sm:text-xs font-normal text-slate-500 sm:text-slate-600 w-full sm:w-[150px] flex-shrink-0">Course Name</label>
            <p className="text-xs sm:text-sm text-slate-900 font-semibold flex-1">{sop.title}</p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 pb-2.5 sm:pb-3 border-b border-slate-100">
            <label className="text-2xs sm:text-xs font-normal text-slate-500 sm:text-slate-600 w-full sm:w-[150px] flex-shrink-0">Course ID</label>
            <a
              href={ROUTES.TRAINING.COURSE_DETAIL(sop.id)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs sm:text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:underline transition-colors flex-1 text-left"
            >
              {sop.documentNumber}
            </a>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 pb-2.5 sm:pb-3 border-b border-slate-100">
            <label className="text-2xs sm:text-xs font-normal text-slate-500 sm:text-slate-600 w-full sm:w-[150px] flex-shrink-0">Training Type</label>
            <p className="text-xs sm:text-sm text-slate-900 flex-1">{sop.category}</p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
            <label className="text-2xs sm:text-xs font-normal text-slate-500 sm:text-slate-600 w-full sm:w-[150px] flex-shrink-0">Training Method</label>
            <p className="text-xs sm:text-sm text-slate-900 flex-1">Self-study</p>
          </div>
        </div>
      </FormSection>

      {/* Material Information card */}
      <FormSection title="Material Information" icon={<Info className="h-4 w-4" />}>
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 pb-2.5 sm:pb-3 border-b border-slate-100">
            <label className="text-2xs sm:text-xs font-normal text-slate-500 sm:text-slate-600 w-full sm:w-[150px] flex-shrink-0">Material Name</label>
            <p className="text-xs sm:text-sm text-slate-900 flex-1">{sop.materialName}</p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 pb-2.5 sm:pb-3 border-b border-slate-100">
            <label className="text-2xs sm:text-xs font-normal text-slate-500 sm:text-slate-600 w-full sm:w-[150px] flex-shrink-0">Material Number</label>
            <a
              href={ROUTES.TRAINING.MATERIAL_DETAIL(sop.materialNumber)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs sm:text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:underline transition-colors flex-1 text-left"
            >
              {sop.materialNumber}
            </a>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 pb-2.5 sm:pb-3 border-b border-slate-100">
            <label className="text-2xs sm:text-xs font-normal text-slate-500 sm:text-slate-600 w-full sm:w-[150px] flex-shrink-0">Version</label>
            <p className="text-xs sm:text-sm text-slate-900 flex-1">{sop.version}</p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
            <label className="text-2xs sm:text-xs font-normal text-slate-500 sm:text-slate-600 w-full sm:w-[150px] flex-shrink-0">Effective Date</label>
            <p className="text-xs sm:text-sm text-slate-900 flex-1">{formatDate(sop.effectiveDate ?? null)}</p>
          </div>
        </div>
      </FormSection>
    </div>



    {/* ── Score + Attempts ── */}
    <FormSection title="Assessment Result" icon={<Trophy className="h-4 w-4" />}>
      <div className="flex items-center gap-5">
        {/* Score ring */}
        {(() => {
          const score = cell.score ?? 0;
          const hasScore = cell.score != null;
          const radius = 28;
          const circumference = 2 * Math.PI * radius;
          const filled = hasScore ? (score / 100) * circumference : 0;
          const scoreColor =
            score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";
          return (
            <div className="relative shrink-0">
              <svg width="72" height="72" className="-rotate-90">
                <circle cx="36" cy="36" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="7" />
                {hasScore && (
                  <circle
                    cx="36" cy="36" r={radius}
                    fill="none"
                    stroke={scoreColor}
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference - filled}
                    style={{ transition: "stroke-dashoffset 0.6s ease" }}
                  />
                )}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-base font-extrabold text-slate-900 leading-none">
                  {hasScore ? `${score}` : "—"}
                </span>
                {hasScore && <span className="text-2xs text-slate-400 font-medium">pts</span>}
              </div>
            </div>
          );
        })()}

        <div className="flex-1 space-y-3">
          <div>
            <p className="text-2xs text-slate-400 uppercase tracking-wide font-medium mb-1">Score</p>
            <p className="text-sm font-semibold text-slate-900">
              {cell.score != null ? `${cell.score} / 100` : "Not assessed"}
            </p>
          </div>
          <div>
            <p className="text-2xs text-slate-400 uppercase tracking-wide font-medium mb-1.5">Attempts</p>
            <div className="flex items-center gap-1.5">
              {Array.from({ length: Math.min(cell.attempts || 0, 6) }).map((_, i) => (
                <span key={i} className="h-2 w-2 rounded-full bg-emerald-400" />
              ))}
              {(cell.attempts || 0) === 0 && <span className="text-xs text-slate-400">No attempts</span>}
            </div>
          </div>
        </div>
      </div>
    </FormSection>

    {/* ── Training Timeline ── */}
    <FormSection title="Training Timeline" icon={<Clock className="h-4 w-4" />}>
      <div className="flex items-start gap-4">
        <div className="flex flex-col items-center pt-1 shrink-0">
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-50" />
          <div className="w-px flex-1 bg-slate-100 my-1.5" style={{ minHeight: 32 }} />
          <div className={cn(
            "h-2.5 w-2.5 rounded-full ring-4",
            cell.status === "Required" ? "bg-red-500 ring-red-50"
              : cell.status === "InProgress" ? "bg-amber-500 ring-amber-50"
                : "bg-slate-400 ring-slate-100"
          )} />
        </div>
        <div className="flex-1 space-y-4">
          <div>
            <p className="text-2xs text-slate-400 font-medium uppercase tracking-wide">Last Trained</p>
            <p className="text-sm font-semibold text-slate-900 mt-0.5">{formatDate(cell.lastTrainedDate)}</p>
          </div>
          <div>
            <p className="text-2xs text-slate-400 font-medium uppercase tracking-wide">Evaluation Result</p>
            <p className="text-sm font-semibold text-slate-900 mt-0.5">{formatDate(cell.expiryDate)}</p>
          </div>
        </div>
      </div>
    </FormSection>

    {isNavigating && <FullPageLoading text="Navigating..." />}

  </Drawer>;
};
