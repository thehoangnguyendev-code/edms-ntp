import React, { useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Bell, CheckCircle2, PenTool, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { FormModal } from "@/components/ui/modal/FormModal";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { cn } from "@/components/ui/utils";
import { usePortalDropdown, PortalDropdownPosition } from "@/hooks";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import type { EmployeeTrainingFile, PendingSignatureRecord } from "../../types";

const CURRENT_TRAINER_ID = "trainer-001";

interface PendingSignaturesModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: EmployeeTrainingFile | null;
  pendingRecords: PendingSignatureRecord[];
  onSigned: (recordId: string) => void | Promise<void>;
}

// ── Row Action Dropdown ───────────────────────────────────────────────────────
interface RowDropdownProps {
  record: PendingSignatureRecord;
  isOpen: boolean;
  onClose: () => void;
  position: PortalDropdownPosition;
  reminded: boolean;
  canSign: boolean;
  onRemind: () => void;
  onSign: () => void;
}

const RowDropdown: React.FC<RowDropdownProps> = ({
  record,
  isOpen,
  onClose,
  position,
  reminded,
  canSign,
  onRemind,
  onSign,
}) => {
  if (!isOpen) return null;

  const items = [
    {
      label: reminded ? "Reminder Sent" : "Send Reminder",
      icon: Bell,
      disabled: reminded,
      color: reminded ? "text-emerald-600" : "text-slate-500",
      onClick: () => { onRemind(); onClose(); },
    },
    ...(canSign ? [{
      label: "Sign Now",
      icon: PenTool,
      disabled: false,
      color: "text-emerald-600",
      className: "-rotate-90",
      onClick: () => { onSign(); onClose(); },
    }] : []),
  ];

  return createPortal(
    <>
      {/* Backdrop: High z-index to be above the modal */}
      <div
        className="fixed inset-0 z-[70] animate-in fade-in duration-150 cursor-default"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      />
      <div
        className="absolute z-[80] min-w-[220px] py-1 rounded-lg border border-slate-200 bg-white animate-in fade-in slide-in-from-top-2 duration-200"
        style={position.style}
      >
        <div className="py-1">
          {items.map((item, i) => {
            const Icon = item.icon;
            const extraClass = (item as any).className || "";
            return (
              <button
                key={i}
                disabled={item.disabled}
                onClick={(e) => { e.stopPropagation(); item.onClick(); }}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-xs transition-colors hover:bg-slate-50 active:bg-slate-100",
                  item.disabled ? "opacity-50 cursor-default" : "",
                  item.color
                )}
              >
                <Icon className={cn("h-3.5 w-3.5 shrink-0", extraClass)} />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>,
    document.body
  );
};

// ── Days Pending Cell ─────────────────────────────────────────────────────────
const DaysPendingCell: React.FC<{ days: number }> = ({ days }) => (
  <span className={cn("text-xs font-bold whitespace-nowrap", days > 3 ? "text-red-600" : "text-slate-600")}>
    {days}d
    {days > 3 && <span className="ml-1 text-2xs font-semibold text-red-500 uppercase">overdue</span>}
  </span>
);

// ── Main Modal ────────────────────────────────────────────────────────────────
export const PendingSignaturesModal: React.FC<PendingSignaturesModalProps> = ({
  isOpen,
  onClose,
  employee,
  pendingRecords,
  onSigned,
}) => {
  const [eSignTarget, setESignTarget] = useState<PendingSignatureRecord | null>(null);
  const [remindedIds, setRemindedIds] = useState<Set<string>>(new Set());

  const {
    openId: openRowDropdownId,
    position: rowDropdownPosition,
    getRef,
    toggle: toggleRowDropdown,
    close: closeRowDropdown,
  } = usePortalDropdown();

  if (!isOpen || !employee) return null;

  const handleRemind = (id: string) => setRemindedIds((prev) => new Set(prev).add(id));
  const handleRemindAll = () => setRemindedIds(new Set(pendingRecords.map((r) => r.id)));

  const handleSignConfirm = async (_reason: string) => {
    if (!eSignTarget) return;
    await onSigned(eSignTarget.id);
    setESignTarget(null);
  };

  const canSignNow = (record: PendingSignatureRecord) =>
    record.trainerId === CURRENT_TRAINER_ID && record.missingRoles.includes("Trainer");

  const allReminded = remindedIds.size === pendingRecords.length && pendingRecords.length > 0;

  return (
    <>
      <FormModal
        isOpen={isOpen}
        onClose={onClose}
        size="xl"
        title="Pending Signatures Control"
        description={
          <div className="flex flex-col gap-2 mt-0.5">
            <p className="text-xs text-slate-500">
              <span className="font-semibold text-slate-700">{employee.employeeName}</span>
              {" · "}
              <span className="text-emerald-600 font-medium">{employee.employeeId}</span>
            </p>
          </div>
        }
        confirmText={allReminded ? "All Reminded" : "Remind All"}
        confirmDisabled={allReminded || pendingRecords.length === 0}
        onConfirm={handleRemindAll}
        cancelText="Close"
      >
        {pendingRecords.length > 0 && (
          <WarningBanner
            variant="warning"
            className="mb-4"
            description={
              <span className="text-xs text-amber-800 leading-relaxed">
                These records are{" "}
                <span className="font-bold">completed but legally invalid</span> due to
                missing electronic signatures.
              </span>
            }
          />
        )}
        {pendingRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
            <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            </div>
            <p className="text-sm font-semibold text-slate-700">
              All training records are fully verified and signed.
            </p>
            <p className="text-xs text-slate-400">
              No pending signatures remain for this employee.
            </p>
          </div>
        ) : (
          <>
            {/* ── Desktop / Tablet table (sm+) ── */}
            <div className="hidden sm:block border border-slate-200 rounded-xl overflow-hidden">
              {/* Scroll container: vertical scroll for many records, horizontal for narrow screens */}
              <div
                className="overflow-x-auto overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-50 hover:scrollbar-thumb-slate-400 [&::-webkit-scrollbar]:h-1"
                style={{ maxHeight: "300px" }}
              >
                <table className="w-full text-left  border-spacing-0">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {["Course & Version", "Missing Roles", "Completion Date", "Days Pending", "Action"].map((h) => (
                        <th
                          key={h}
                          className={cn(
                            "sticky top-0 z-20 bg-slate-50 px-3 py-1.5 text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap border-b border-slate-200",
                            h === "Action" && "text-center right-0 z-30 before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200 border-l border-slate-200"
                          )}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {pendingRecords.map((record) => (
                      <tr key={record.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="px-3 py-1.5 min-w-[160px] border-b border-slate-100">
                          <p className="text-2xs font-bold text-slate-900 leading-tight">{record.courseCode}</p>
                          <p className="text-2xs text-slate-500 mt-0.5 max-w-[180px] truncate leading-none">{record.courseName}</p>
                          <div className="flex items-center gap-1">
                            <span className="text-2xs font-semibold text-slate-400/80 uppercase tracking-tighter">{record.version}</span>
                            {record.isObsolete && (
                              <span title="Course version is obsolete">
                                <AlertTriangle className="h-2.5 w-2.5 text-orange-500" />
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-1.5 border-b border-slate-100">
                          <div className="flex flex-wrap gap-1">
                            {record.missingRoles.map((role) => (
                              <span key={role} title={role === "Trainer" ? (record.trainerName || "Assigned Trainer") : undefined}>
                                <Badge color={role === "Trainer" ? "amber" : "blue"} size="sm">
                                  {role}
                                </Badge>
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-1.5 text-2xs text-slate-600 whitespace-nowrap border-b border-slate-100">{record.completionDate}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap border-b border-slate-100">
                          <DaysPendingCell days={record.daysPending} />
                        </td>
                        {/* Sticky action column */}
                        <td className="sticky right-0 z-30 bg-white border-b border-slate-100 px-2 md:px-4 py-1.5 text-center whitespace-nowrap before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200 group-hover:bg-slate-50 transition-colors">
                          <button
                            ref={getRef(record.id)}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleRowDropdown(record.id, e);
                            }}
                            className="inline-flex items-center justify-center h-7 w-7 md:h-8 md:w-8 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors"
                          >
                            <MoreVertical className="h-3.5 w-3.5 md:h-4 md:w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Mobile card list (< sm) ── */}
            <div className="flex flex-col gap-2 sm:hidden overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-50" style={{ maxHeight: "360px" }}>
              {pendingRecords.map((record) => (
                <div key={record.id} className="border border-slate-200 rounded-xl p-4 md:p-5 bg-white space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 leading-tight">{record.courseCode}</p>
                      <p className="text-2xs text-slate-500 mt-0.5 truncate">{record.courseName}</p>
                      <div className="flex items-center gap-1">
                        <span className="text-2xs font-semibold text-slate-400 uppercase tracking-wider">{record.version}</span>
                        {record.isObsolete && (
                          <span title="Course version is obsolete">
                            <AlertTriangle className="h-2.5 w-2.5 text-orange-500" />
                          </span>
                        )}
                      </div>
                    </div>
                    <DaysPendingCell days={record.daysPending} />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-2xs text-slate-400 font-medium">Missing:</span>
                      <div className="flex gap-1">
                        {record.missingRoles.map((role) => (
                          <span key={role} title={role === "Trainer" ? (record.trainerName || "Assigned Trainer") : undefined}>
                            <Badge color={role === "Trainer" ? "amber" : "blue"} size="sm">
                              {role}
                            </Badge>
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-2xs text-slate-400 font-medium">Completed:</span>
                      <span className="text-2xs text-slate-600 font-semibold">{record.completionDate}</span>
                    </div>
                  </div>
                  {/* Mobile: inline buttons */}
                  <div className="flex gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "flex-1 h-7 text-2xs gap-1 px-2",
                        remindedIds.has(record.id)
                          ? "text-emerald-600 border-emerald-300 bg-emerald-50 cursor-default"
                          : "text-slate-600"
                      )}
                      onClick={() => handleRemind(record.id)}
                      disabled={remindedIds.has(record.id)}
                    >
                      <Bell className="h-3 w-3 shrink-0" />
                      {remindedIds.has(record.id) ? "Sent" : "Remind"}
                    </Button>
                    {canSignNow(record) && (
                      <Button
                        size="sm"
                        className="flex-1 h-7 text-2xs gap-1 px-2 bg-emerald-600 hover:bg-emerald-700 text-white border-none"
                        onClick={() => setESignTarget(record)}
                      >
                        <PenTool className="h-3 w-3 shrink-0 -rotate-[90deg]" />
                        Sign Now
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </FormModal>

      {/* Row dropdown portal (desktop/tablet) */}
      {openRowDropdownId && (() => {
        const record = pendingRecords.find((r) => r.id === openRowDropdownId);
        return record ? (
          <RowDropdown
            record={record}
            isOpen
            onClose={closeRowDropdown}
            position={rowDropdownPosition}
            reminded={remindedIds.has(record.id)}
            canSign={canSignNow(record)}
            onRemind={() => handleRemind(record.id)}
            onSign={() => setESignTarget(record)}
          />
        ) : null;
      })()}

      <ESignatureModal
        isOpen={!!eSignTarget}
        onClose={() => setESignTarget(null)}
        onConfirm={handleSignConfirm}
        actionTitle={`Sign Training Record — ${eSignTarget?.courseCode ?? ""}`}
        targetDetails={
          eSignTarget
            ? { code: eSignTarget.courseCode, title: eSignTarget.courseName, revision: eSignTarget.version }
            : undefined
        }
      />
    </>
  );
};
