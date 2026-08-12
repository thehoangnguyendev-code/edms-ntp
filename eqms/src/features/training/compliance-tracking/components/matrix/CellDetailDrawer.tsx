import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, User, FileText, CalendarDays, Trophy, Clock, AlertTriangle, CalendarCheck, Send, Download, GraduationCap, Info } from "lucide-react";
import { IconBook, IconLocation } from "@tabler/icons-react";
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

export const CellDetailDrawer: React.FC<CellDetailDrawerProps> = ({
    cell,
    employee,
    sop,
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

    const cfg = CELL_CONFIG[cell.status];
    const isFullHeight = drawerHeight >= 98;

    return createPortal(
        <div className="fixed inset-0 z-50 flex justify-center md:justify-end items-end md:items-center">
            {/* Unified Animation Styles (consistent with TaskDetailDrawer) */}
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
                {/* Mobile drag handle */}
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

                {/* Header */}
                <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-slate-100 bg-white flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", cfg.bg)}>
                            <cfg.Icon className={cn("h-4 w-4", cfg.iconColor)} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-2xs text-slate-400 font-medium">Compliance Tracking</p>
                            <p className="text-xs sm:text-sm font-bold text-slate-900 truncate" title={cfg.label}>{cfg.label}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="flex-shrink-0 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                        aria-label="Close"
                    >
                        <X className="h-4 w-4 text-slate-500" />
                    </button>
                </div>

                {/* Scrollable body */}
                <div
                    className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-50/30 scroll-smooth custom-scrollbar"
                    style={{
                        WebkitOverflowScrolling: "touch",
                        overscrollBehavior: "contain"
                    }}
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
                </div>

                {/* Footer */}
                <div className="px-4 py-3 border-t border-slate-100 bg-white shrink-0 flex justify-end">
                    <Button variant="outline" size="sm" onClick={handleClose} className="text-xs sm:text-sm">Close</Button>
                </div>
            </div>
        </div>,
        document.body
    );
};
