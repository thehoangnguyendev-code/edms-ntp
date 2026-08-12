import React from "react";
import { AlertTriangle, CalendarDays, Bell, ShieldCheck } from "lucide-react";
import { IconAdjustmentsHorizontal } from "@tabler/icons-react";
import { Select } from "@/components/ui/select/Select";
import { DateTimePicker } from "@/components/ui/datetime-picker/DateTimePicker";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { FormSection, Switch } from "@/components/ui";
import { cn } from "@/components/ui/utils";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import type { AssignmentPriority } from "../../../../types/assignment.types";
import { PRIORITY_DEADLINE_DAYS } from "../../../../types/assignment.types";
import { PRIORITY_OPTIONS } from "../AssignTrainingView";

export interface Step3Props {
  priority: AssignmentPriority;
  onPriorityChange: (v: string) => void;
  deadlineDate: string;
  onDeadlineChange: (v: string) => void;
  trainingBeforeAuthorized: boolean;
  onToggleBeforeAuth: () => void;
  requiresESign: boolean;
  onToggleESign: () => void;
  isCrossTraining: boolean;
  onToggleCrossTraining: () => void;
  reminders: number[];
  onReminderToggle: (days: number) => void;
}

export const Step3Config: React.FC<Step3Props> = ({
  priority,
  onPriorityChange,
  deadlineDate,
  onDeadlineChange,
  trainingBeforeAuthorized,
  onToggleBeforeAuth,
  requiresESign,
  onToggleESign,
  isCrossTraining,
  onToggleCrossTraining,
  reminders,
  onReminderToggle,
}) => (
  <FormSection
    title="Assignment Configuration"
    icon={<IconAdjustmentsHorizontal className="h-4 w-4" />}
  >
    <div className="space-y-6">
      {priority === "Critical" && (
        <WarningBanner
          variant="error"
          title="Critical Priority Selected"
          description="An e-signature will be required at submission to authorize this assignment (EU-GMP Annex 11)."
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FormSection
          title="Schedules & Priority"
          icon={<CalendarDays className="h-4 w-4" />}
        >
          <div className="space-y-4">
            <div>
              <Select
                label="Priority"
                value={priority}
                onChange={onPriorityChange}
                options={PRIORITY_OPTIONS}
              />
              <p className="text-2xs sm:text-xs font-normal text-slate-400 flex items-center gap-1">
                Recommended deadline: within {PRIORITY_DEADLINE_DAYS[priority]}{" "}
                days from today
              </p>
            </div>

            <div>
              <DateTimePicker
                label="Deadline Date"
                value={deadlineDate}
                onChange={onDeadlineChange}
                placeholder="Select deadline…"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                Reminders Before Deadline
              </label>
              <div className="mt-2 flex flex-col sm:gap-3">
                {[
                  { days: 1, label: "1 day" },
                  { days: 3, label: "3 days" },
                  { days: 7, label: "1 week" },
                  { days: 14, label: "2 weeks" },
                  { days: 30, label: "1 month" },
                  { days: 60, label: "2 months" },
                ].map(({ days, label }) => (
                  <label
                    key={days}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Checkbox
                      id={`reminder-${days}`}
                      checked={reminders.includes(days)}
                      onChange={() => onReminderToggle(days)}
                    />
                    <span className="text-sm text-slate-700">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </FormSection>

        <FormSection
          title="Compliance Controls"
          icon={<ShieldCheck className="h-4 w-4" />}
        >
          <div className="divide-y divide-slate-100 -mt-2">
            {/* Training Before Authorized */}
            <div className="py-4">
              <div className="flex items-start gap-3">
                <Switch
                  checked={trainingBeforeAuthorized}
                  onChange={onToggleBeforeAuth}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    Training Before Authorized
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Block system tasks until training is completed{" "}
                    <span className="text-emerald-600 font-medium">
                      (EU-GMP Chapter 2.8)
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* Require E-Sign */}
            <div className="py-4">
              <div className="flex items-start gap-3">
                <Switch
                  checked={requiresESign}
                  onChange={onToggleESign}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    Require E-Signature on Completion
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Trainees must e-sign when marking training complete{" "}
                    <span className="text-emerald-600 font-medium">
                      (Annex 11)
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* Cross-training */}
            <div className="py-4">
              <div className="flex items-start gap-3">
                <Switch
                  checked={isCrossTraining}
                  onChange={onToggleCrossTraining}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    Cross-Training Assignment
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Does not count toward mandatory compliance rate — for
                    skills versatility only
                  </p>
                </div>
              </div>
            </div>
          </div>
        </FormSection>
      </div>
    </div>
  </FormSection>
);
