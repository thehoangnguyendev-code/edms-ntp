import React from "react";
import {
  Pickaxe,
  Plus,
  Verified,
  Clock,
  FileSignature,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/utils";
import type { EmployeeTrainingFile } from "@/features/training/types";
import { formatDateUS } from "@/utils/format";

interface DossierOJTTabProps {
  employee: EmployeeTrainingFile;
  onVerifyOJT: (ojt: any) => void;
}

export const DossierOJTTab: React.FC<DossierOJTTabProps> = ({ employee, onVerifyOJT }) => {
  return (
    <div className="p-4 md:p-5 space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900 tracking-tight flex items-center gap-2">
            <Pickaxe className="h-4 w-4 text-emerald-600" />
            Practical Competence (OJT)
          </h3>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Hands-on skill verification records</p>
        </div>
        <Button size="sm" variant="default" className="h-8 gap-2 self-start sm:self-auto">
          <Plus className="h-3.5 w-3.5" /> Add Record
        </Button>
      </div>

      <div className="max-h-[460px] overflow-y-auto pr-2 -mr-2 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent hover:scrollbar-thumb-slate-300">
        <div className="grid grid-cols-1 gap-2.5">
          {employee.ojtRecords?.map((record, index) => {
            const scoreValue = typeof record.assessmentScore === "number" ? `${record.assessmentScore}/100` : "N/A";
            const scoreColor =
              typeof record.assessmentScore === "number" && record.assessmentScore >= 80
                ? "text-emerald-700"
                : "text-slate-500";

            return (
              <div
                key={record.id}
                className="rounded-lg md:rounded-xl border border-slate-200 md:border-slate-100 bg-white md:bg-slate-50/50 shadow-sm md:shadow-none md:hover:bg-white md:hover:border-emerald-200 transition-all"
              >
                <div className="p-3 space-y-3 md:hidden">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400">#{index + 1}</span>
                        <span className="text-xs font-semibold text-emerald-600">OJT</span>
                      </div>
                      <p className="text-sm font-semibold text-slate-900 mt-1 leading-5">
                        {record.taskName}
                      </p>
                    </div>

                    {record.status === "Completed" ? (
                      <Badge color="emerald" variant="soft" size="sm" icon={<Check className="h-3.5 w-3.5" />}>
                        Verified
                      </Badge>
                    ) : record.status === "In-Progress" ? (
                      <Badge color="blue" size="sm">
                        In Progress
                      </Badge>
                    ) : (
                      <Badge color="amber" size="sm">
                        Pending
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                      <p className="text-slate-500">Trainer</p>
                      <p className="mt-0.5 font-medium text-slate-900">{record.trainerName || "Unassigned"}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                      <p className="text-slate-500">Verification Date</p>
                      <p className="mt-0.5 font-medium text-slate-900">
                        {record.dateCompleted ? formatDateUS(record.dateCompleted) : "Pending"}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg border border-slate-200 px-3 py-2">
                      <p className="text-slate-500">Assessment Score</p>
                      <p className={cn("mt-0.5 font-semibold", scoreColor)}>{scoreValue}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 px-3 py-2">
                      <p className="text-slate-500">Status Detail</p>
                      <p className="mt-0.5 font-semibold text-slate-900">{record.status}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500">Comments</p>
                      <p className="mt-0.5 text-xs font-medium text-slate-700 truncate">
                        {record.comments || "No remarks attached"}
                      </p>
                    </div>
                    {record.status === "Pending" ? (
                      <Button
                        size="xs"
                        variant="outline-emerald"
                        className="h-8 gap-1.5 px-3 text-xs"
                        onClick={() => onVerifyOJT(record)}
                      >
                        <FileSignature className="h-3 w-3" />
                        Verify
                      </Button>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">
                        {record.status === "Completed" ? <Verified className="h-4 w-4 text-emerald-600" /> : <Clock className="h-4 w-4 text-blue-600" />}
                        {record.status === "Completed" ? "Verified record" : "Ongoing review"}
                      </span>
                    )}
                  </div>
                </div>

                <div className="hidden md:block p-4 md:p-5 group">
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div
                      className={cn(
                        "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border transition-colors",
                        record.status === "Completed"
                          ? "bg-emerald-50 border-emerald-100 text-emerald-600"
                          : "bg-white border-slate-200 text-slate-400 group-hover:border-amber-100 group-hover:text-amber-600"
                      )}
                    >
                      {record.status === "Completed" ? <Verified className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 leading-tight">
                        {record.taskName}
                      </p>
                      <div className="flex flex-col gap-1.5 mt-2 text-2xs text-slate-500 font-medium sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-1">
                        <span>Trainer: {record.trainerName}</span>
                        <span className="hidden sm:block w-1 h-1 rounded-full bg-slate-300" />
                        <span>
                          {record.dateCompleted ? `Verified: ${formatDateUS(record.dateCompleted)}` : "Pending Verification"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 mt-3 sm:mt-4">
                    {record.status === "Pending" ? (
                      <Button
                        size="xs"
                        variant="outline-emerald"
                        className="h-8 text-xs gap-1.5 px-3 w-full sm:w-auto"
                        onClick={() => onVerifyOJT(record)}
                      >
                        <FileSignature className="h-3 w-3" /> Verify
                      </Button>
                    ) : (
                      <Badge color="emerald" variant="soft" size="sm" icon={<Check className="h-3.5 w-3.5" />}>
                        Verified
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 text-2xs text-slate-500 font-medium">
        <p>Total {employee.ojtRecords?.length || 0} practical competencies recorded for this dossier.</p>
      </div>
    </div>
  );
};
