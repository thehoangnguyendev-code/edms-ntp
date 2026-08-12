import React from "react";
import {
  Briefcase,
  Mail,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Info,
  Award,
  ArrowRight,
  History
} from "lucide-react";
import { FormSection } from "@/components/ui/form";
import { Badge, Progress } from "@/components/ui";
import { cn } from "@/components/ui/utils";
import type { EmployeeTrainingFile } from "@/features/training/types";

interface DossierOverviewTabProps {
  employee: EmployeeTrainingFile;
}

export const DossierOverviewTab: React.FC<DossierOverviewTabProps> = ({ employee }) => {
  return (
    <div className="p-4 md:p-5 space-y-8 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div className="space-y-8">
          {/* Employment Information */}
          <FormSection title="Employment Information" icon={<Briefcase className="h-4 w-4" />}>
            <div className="space-y-0">
              {[
                { label: "Position", value: employee.jobPosition, bold: true },
                { label: "Department", value: employee.department },
                { label: "Manager", value: "Hoang Nguyen (QA Director)", underline: true },
                { label: "Business Unit", value: employee.businessUnit || "N/A" },
                { label: "Join Date", value: "15 Jan 2024 (2.5 Years Service)" },
              ].map((row, i, arr) => (
                <div key={i} className={cn(
                  "flex flex-col lg:flex-row lg:items-center gap-1.5 lg:gap-2 py-3 lg:py-4",
                  i !== arr.length - 1 && "border-b border-slate-100"
                )}>
                  <label className="text-xs sm:text-sm font-medium text-slate-500 w-full lg:w-40 flex-shrink-0">{row.label}</label>
                  <p className={cn(
                    "text-xs lg:text-sm text-slate-900 flex-1",
                    row.bold && "font-bold",
                    row.underline && "underline decoration-slate-200 cursor-pointer"
                  )}>
                    {row.value}
                  </p>
                </div>
              ))}
            </div>
          </FormSection>

          {/* Contact & System Info */}
          <FormSection title="Contact & Access Info" icon={<Mail className="h-4 w-4" />}>
            <div className="space-y-0">
              {[
                { label: "Email Address", value: employee.email || "N/A", bold: true },
                { label: "Phone Number", value: "+84 908 *** 123" },
                { label: "Last System Login", value: "Today, 08:45 AM (IP: 192.168.1.5)" },
                { label: "Auth Level", value: "Internal Personnel - Level 2" },
              ].map((row, i, arr) => (
                <div key={i} className={cn(
                  "flex flex-col lg:flex-row lg:items-center gap-1.5 lg:gap-2 py-3 lg:py-4",
                  i !== arr.length - 1 && "border-b border-slate-100"
                )}>
                  <label className="text-xs sm:text-sm font-medium text-slate-500 w-full lg:w-40 flex-shrink-0">{row.label}</label>
                  <p className={cn(
                    "text-xs lg:text-sm text-slate-900 flex-1",
                    row.bold && "font-bold"
                  )}>
                    {row.value}
                  </p>
                </div>
              ))}
            </div>
          </FormSection>
        </div>

        <div className="space-y-8">
          {/* Training & Compliance Summary */}
          <FormSection title="Compliance Status" icon={<ShieldCheck className="h-4 w-4" />}>
            <div className="space-y-5">
              <div className="p-4 md:p-5 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-between">
                <div>
                  <p className="text-2xs font-black text-emerald-700 uppercase tracking-widest mb-1">Audit Status</p>
                  <p className="text-sm font-bold text-emerald-900">GMP COMPLIANT - AUDIT READY</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-emerald-500 opacity-50" />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-500 uppercase tracking-tight">Overall SOP Progress</span>
                  <span className="text-slate-900">{Math.round((employee.coursesCompleted / employee.totalCoursesRequired) * 100)}%</span>
                </div>
                <Progress
                  value={(employee.coursesCompleted / employee.totalCoursesRequired) * 100}
                  size="sm"
                  variant="success"
                  animated
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-4 md:p-5 bg-red-50 rounded-lg border border-red-100">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="h-3.5 w-3.5 text-red-500" />
                    <span className="text-2xs font-black text-red-700 uppercase">Alert</span>
                  </div>
                  <p className="text-xs text-red-600 font-bold leading-tight">Refresher Due in 12 days</p>
                </div>
                <div className="p-4 md:p-5 bg-amber-50 rounded-lg border border-amber-100">
                  <div className="flex items-center gap-2 mb-1">
                    <Info className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-2xs font-black text-amber-700 uppercase">Remark</span>
                  </div>
                  <p className="text-xs text-amber-600 font-bold leading-tight">OJT Signature Required</p>
                </div>
              </div>
            </div>
          </FormSection>

          {/* Assignment & Qualifications */}
          <FormSection title="Assignment & Qualifications" icon={<Award className="h-4 w-4" />}>
            <div className="space-y-6">
              {/* Active JD Card */}
              <div className="p-4 md:p-5 rounded-xl bg-slate-900 text-white relative overflow-hidden group cursor-pointer">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 blur-3xl -mr-12 -mt-12 transition-colors group-hover:bg-emerald-500/20" />
                <div className="relative z-10">
                  <p className="text-2xs font-bold text-slate-400 uppercase tracking-[0.15em] mb-1.5 lead">Primary Assignment</p>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-white tracking-tight leading-tight">JD-QA-MGR-01</h4>
                      <p className="text-2xs text-slate-400 mt-0.5 font-medium">QA Manager (Revision 2.0)</p>
                    </div>
                    <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center group-hover:bg-emerald-500 transition-colors">
                      <ArrowRight className="h-4 w-4 text-white" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-widest block">Core Credentials</label>
                  <div className="flex flex-wrap gap-2">
                    <Badge color="emerald" variant="soft" size="sm" showDot className="font-bold">Master of Science</Badge>
                    <Badge color="blue" variant="soft" size="sm" showDot className="font-bold">Lean Six Sigma</Badge>
                    <Badge color="purple" variant="soft" size="sm" showDot className="font-bold">Internal Auditor</Badge>
                  </div>
                </div>

                <div className="pt-5 border-t border-slate-100">
                  <label className="text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <History className="h-3 w-3" /> Recent Verification Logs
                  </label>
                  <div className="space-y-4">
                    {[
                      { event: "Assessment passed: SOP-QA-001", time: "Today, 10:30 AM", user: "Hoang Nguyen" },
                      { event: "OJT Verified: Aseptic Gowning", time: "Yesterday, 02:45 PM", user: "System" },
                    ].map((l, i) => (
                      <div key={i} className="flex gap-3 pl-0.5 group">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-200 mt-1.5 shrink-0 transition-colors group-hover:bg-emerald-500" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-900 leading-tight truncate">{l.event}</p>
                          <div className="flex items-center gap-2 mt-0.5 text-2xs text-slate-500 font-medium">
                            <span>{l.time}</span>
                            <span className="w-1 h-1 rounded-full bg-slate-300" />
                            <span>by {l.user}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </FormSection>
        </div>
      </div>
    </div>
  );
};
