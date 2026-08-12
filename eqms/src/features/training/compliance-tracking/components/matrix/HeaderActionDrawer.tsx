import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
    X,
    User,
    FileText,
    Download,
    Send,
    TrendingUp,
    GraduationCap,
    Info,
} from "lucide-react";
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

const useIsMobile = () => {
    const [isMobile, setIsMobile] = useState(() => {
        if (typeof window !== "undefined") {
            return window.innerWidth < 768;
        }
        return false;
    });

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);
    return isMobile;
};

// ─── Main Component ───────────────────────────────────────────────────
export const HeaderActionDrawer: React.FC<HeaderActionDrawerProps> = ({
    type,
    data,
    onClose,
}) => {
    const navigate = useNavigate();
    const [isNavigating, setIsNavigating] = useState(false);

    const handleNavigate = (path: string) => {
        setIsNavigating(true);
        setTimeout(() => navigate(path), 600);
    };

    const [isClosing, setIsClosing] = useState(false);
    const isMobile = useIsMobile();

    // Dragging / Bottom Sheet State
    const [drawerHeight, setDrawerHeight] = useState(88); // vh
    const [isDragging, setIsDragging] = useState(false);
    const dragStartY = React.useRef(0);
    const dragStartHeight = React.useRef(88);

    const MIN_HEIGHT = 40;
    const MAX_HEIGHT = 100;
    const CLOSE_THRESHOLD = 25;

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            setIsClosing(false);
            onClose();
        }, 300);
    };

    useEffect(() => {
        document.body.style.overflow = "hidden";
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") handleClose();
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.body.style.overflow = "";
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, []);

    // Handling both touch AND mouse events for better desktop-mobile-simulation testing
    const handleDragStart = (clientY: number) => {
        setIsDragging(true);
        dragStartY.current = clientY;
        dragStartHeight.current = drawerHeight;
    };

    const handleDragMove = (clientY: number) => {
        if (!isDragging) return;
        const viewportHeight = window.innerHeight;
        const deltaY = dragStartY.current - clientY;
        const deltaVh = (deltaY / viewportHeight) * 100;
        let newHeight = dragStartHeight.current + deltaVh;
        newHeight = Math.max(0, Math.min(MAX_HEIGHT, newHeight));
        setDrawerHeight(newHeight);
    };

    const handleDragEnd = () => {
        setIsDragging(false);
        if (drawerHeight < CLOSE_THRESHOLD) {
            handleClose();
        } else {
            setDrawerHeight(88); // Snap back to 88
        }
    };

    useEffect(() => {
        if (!isDragging) return;
        const onMove = (e: MouseEvent) => handleDragMove(e.clientY);
        const onEnd = () => handleDragEnd();
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onEnd);
        return () => {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onEnd);
        };
    }, [isDragging, drawerHeight]);

    const handleTouchStart = (e: React.TouchEvent) => handleDragStart(e.touches[0].clientY);
    const handleTouchMove = (e: React.TouchEvent) => handleDragMove(e.touches[0].clientY);
    const handleTouchEnd = () => handleDragEnd();

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
    const isFullHeight = drawerHeight >= 98;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:justify-end">
            <style>{`
                @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
                @keyframes slideOutRight { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
                @keyframes slideInBottom { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                @keyframes slideOutBottom { from { transform: translateY(0); opacity: 1; } to { transform: translateY(100%); opacity: 0; } }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
                .desktop-drawer-enter { animation: slideInRight 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .desktop-drawer-exit { animation: slideOutRight 0.25s cubic-bezier(0.4, 0, 1, 1) forwards; }
                .mobile-drawer-enter { animation: slideInBottom 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .mobile-drawer-exit { animation: slideOutBottom 0.3s cubic-bezier(0.4, 0, 1, 1) forwards; }
                .backdrop-enter { animation: fadeIn 0.3s ease-out forwards; }
                .backdrop-exit { animation: fadeOut 0.25s ease-in forwards; }
            `}</style>

            {/* Backdrop */}
            <div
                className={cn(
                    "absolute inset-0 bg-slate-900/60 backdrop-blur-sm pointer-events-auto",
                    isClosing ? "backdrop-exit" : "backdrop-enter"
                )}
                onClick={handleClose}
            />

            {/* Floating Drawer panel */}
            <div
                className={cn(
                    "pointer-events-auto bg-white flex flex-col relative overflow-hidden shadow-2xl",
                    isMobile
                        ? cn("w-full transition-all flex flex-col", isFullHeight ? "rounded-none" : "rounded-t-2xl")
                        : "w-[500px] h-[calc(100vh-32px)] mr-4 rounded-2xl border border-slate-200",
                    isClosing
                        ? (isMobile ? "mobile-drawer-exit" : "desktop-drawer-exit")
                        : (isMobile ? (!isDragging && "mobile-drawer-enter") : "desktop-drawer-enter"),
                )}
                style={isMobile ? {
                    height: `${drawerHeight}dvh`,
                    transition: isDragging ? 'none' : 'transform 400ms cubic-bezier(0.16, 1, 0.3, 1), height 400ms cubic-bezier(0.16, 1, 0.3, 1), border-radius 200ms ease',
                    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                    paddingTop: isFullHeight ? 'env(safe-area-inset-top, 0px)' : '0px',
                } : {}}
            >
                {/* Mobile Drag Handle */}
                {isMobile && (
                    <div
                        className="flex flex-col items-center py-3 cursor-grab active:cursor-grabbing select-none touch-none bg-white shrink-0"
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                        onMouseDown={(e) => handleDragStart(e.clientY)}
                    >
                        <div className={cn(
                            "rounded-full transition-all duration-200",
                            isDragging ? "w-20 h-1.5 bg-slate-400" : "w-12 h-1 bg-slate-200 hover:bg-slate-300"
                        )} />
                    </div>
                )}

                {/* ── Header ───────────────────────────────────────────────────── */}
                <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-slate-100 shrink-0 bg-white">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            {empData ? (
                                <>
                                    {/* Initials avatar */}
                                    <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-emerald-100 border-2 border-emerald-200 flex items-center justify-center flex-shrink-0">
                                        <span className="text-2xs sm:text-xs font-bold text-emerald-700">
                                            {getInitials(empData.fullName)}
                                        </span>
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs sm:text-sm font-bold text-slate-900 leading-tight truncate">{empData.fullName}</p>
                                    </div>
                                </>
                            ) : sopData ? (
                                <>
                                    {/* Document icon */}
                                    <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center flex-shrink-0">
                                        <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="text-2xs font-medium text-slate-500 uppercase tracking-wider">Training Course</span>
                                        </div>
                                        <p className="text-xs sm:text-sm font-bold text-slate-900 leading-tight truncate">{sopData.title}</p>
                                    </div>
                                </>
                            ) : null}
                        </div>

                        <button
                            onClick={handleClose}
                            className="flex-shrink-0 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                            aria-label="Close"
                        >
                            <X className="h-4 w-4 text-slate-500" />
                        </button>
                    </div>
                </div>

                {/* ── Scrollable Body ──────────────────────────────────────── */}
                <div
                    className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-50/30 scroll-smooth custom-scrollbar"
                    style={{
                        WebkitOverflowScrolling: "touch",
                        overscrollBehavior: "contain"
                    }}
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
                </div>

                {/* ── Footer ───────────────────────────────────────────────── */}
                <div className="px-4 py-3 border-t border-slate-200 bg-white shrink-0 flex justify-end">
                    <Button variant="outline" size="sm" onClick={handleClose} className="text-xs sm:text-sm">
                        Close
                    </Button>
                </div>
            </div>

            {isNavigating && <FullPageLoading text="Navigating..." />}
        </div>,
        document.body
    );
};
