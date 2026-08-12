import React from "react";
import {
  TimerReset,
} from "lucide-react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button/Button";
import type { CompletedCourseRecord, EmployeeTrainingFile } from "@/features/training/types";
import { IconBook } from "@tabler/icons-react";
import { formatDateUS } from "@/utils/format";

const FALLBACK_SOP_RECORDS: CompletedCourseRecord[] = Array.from({ length: 8 }, (_, index) => ({
  id: `fallback-sop-${index + 1}`,
  courseCode: `SOP-QA-00${index + 1}`,
  courseName: "Implementation of Environmental Monitoring Program",
  version: "v2.0",
  completionDate: "2026-03-15",
  expiryDate: "2027-03-15",
  score: 95,
  passingScore: 80,
  traineeName: "N/A",
  traineeId: "N/A",
  traineeEsignDate: "2026-03-15T08:00:00Z",
  trainerName: "Nguyen An",
  trainerId: `trainer-${index + 1}`,
  trainerEsignDate: "2026-03-16T09:30:00Z",
  status: "Pass",
  pendingSignaturesCount: 0,
}));

interface DossierSOPsTabProps {
  employee: EmployeeTrainingFile;
}

export const DossierSOPsTab: React.FC<DossierSOPsTabProps> = ({ employee }) => {
  const sopRecords = employee.completedCourses?.length ? employee.completedCourses : FALLBACK_SOP_RECORDS;

  return (
    <div className="p-4 md:p-5 space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900 tracking-tight flex items-center gap-2">
            <IconBook className="h-4 w-4 text-emerald-600" />
            Mandatory SOP Training Records
          </h3>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Requirements for {employee.jobPosition} role</p>
        </div>
        <Badge color="slate" variant="soft" size="sm" className="font-bold self-start sm:self-auto">EU-GMP Annex 1</Badge>
      </div>

      <div className="max-h-[460px] overflow-y-auto pr-2 -mr-2 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent hover:scrollbar-thumb-slate-300">
        <div className="grid grid-cols-1 gap-2.5">
          {sopRecords.map((record, index) => (
            <div
              key={record.id}
              className="rounded-lg md:rounded-xl border border-slate-200 md:border-slate-100 bg-white md:bg-slate-50/50 shadow-sm md:shadow-none md:hover:bg-white md:hover:border-emerald-200 transition-all"
            >
              <div className="p-3 space-y-3 md:hidden">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400">#{index + 1}</span>
                      <span className="text-xs font-semibold text-emerald-600">{record.courseCode}</span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-slate-900 leading-5">
                      {record.courseName}
                    </p>
                  </div>
                  <StatusBadge
                    status={record.status === "Pass" ? "effective" : "blocked"}
                    size="xs"
                    label={record.status === "Pass" ? "COMPLIANT" : "GAP"}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-slate-500">Version</p>
                    <p className="mt-0.5 font-medium text-slate-900">{record.version}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-slate-500">Completion Date</p>
                    <p className="mt-0.5 font-medium text-slate-900">{formatDateUS(record.completionDate)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-slate-200 px-3 py-2">
                    <p className="text-slate-500">Score</p>
                    <p className="mt-0.5 font-semibold text-emerald-700">
                      {record.score}/100
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 px-3 py-2">
                    <p className="text-slate-500">Trainer</p>
                    <p className="mt-0.5 font-semibold text-slate-900">{record.trainerName}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500">Validity</p>
                    <p className="mt-0.5 text-xs font-medium text-slate-700">
                      {record.expiryDate ? `Valid until ${formatDateUS(record.expiryDate)}` : "No expiry configured"}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">
                    <TimerReset className="h-4 w-4 text-emerald-600" />
                    Recurring 12M
                  </span>
                </div>
              </div>

              <div className="hidden md:block p-4 md:p-5 group">
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="h-8 w-8 rounded-lg bg-white border border-slate-200 text-slate-400 flex items-center justify-center group-hover:text-emerald-600 group-hover:border-emerald-100 transition-colors shrink-0">
                    <IconBook className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 leading-tight">
                      {record.courseCode}: {record.courseName}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-2 text-2xs text-slate-500 font-medium">
                      <span className="flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                        Ver {record.version}
                      </span>
                      <span>Date: {formatDateUS(record.completionDate)}</span>
                      <span className="text-emerald-600">Score: {record.score}/100</span>
                      <span>Trainer: {record.trainerName}</span>
                      <span className="text-emerald-600">Recurring: 12M</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 sm:mt-4">
                  <StatusBadge
                    status={record.status === "Pass" ? "effective" : "blocked"}
                    size="xs"
                    label={record.status === "Pass" ? "COMPLIANT" : "GAP"}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-2xs text-slate-500 font-medium">
        <p>Showing {sopRecords.length} records based on active matrices</p>
        <Button variant="link" size="xs" className="font-bold px-0 self-start sm:self-auto">View All Full History</Button>
      </div>
    </div>
  );
};
