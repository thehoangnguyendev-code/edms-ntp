import { useState } from "react";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { FormField, Input } from "@/components/ui/form/ResponsiveForm";
import { TimePicker } from "@/components/ui/datetime-picker/TimePicker";
import {
  HOUR_STEPS,
  MINUTE_CHOICES,
  WEEKDAYS,
  WEEKDAY_NAMES,
  describeFrequency,
  fromCron,
  timeOf,
  toCron,
  type FrequencyKind,
  type FrequencySpec,
} from "./scheduleFrequency";
import { tr, trFormat } from "@/i18n";

const KINDS: Array<{ value: FrequencyKind; label: string }> = [
  { value: "HOURLY", label: "Hourly" },
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "CUSTOM", label: tr("Custom cron") },
];
const two = (n: number) => String(n).padStart(2, "0");

/**
 * The frequency of a scheduled report: Hourly (every 1 to 12 hours), Daily, Weekly (any days of the week), Monthly (a day, or the last day) or a Custom cron. What is chosen is
 * written as the cron expression the server keeps, and said in words below; a custom cron is typed. `onChange` gets the cron expression.
 */
export function ScheduleFrequencyField({ cron, onChange }: { cron: string; onChange: (cron: string) => void }) {
  const [spec, setSpec] = useState<FrequencySpec>(() => fromCron(cron));
  const change = (patch: Partial<FrequencySpec>) => {
    const next = { ...spec, ...patch };
    setSpec(next);
    onChange(toCron(next));
  };
  const chooseKind = (kind: FrequencyKind) => {
    // A change of kind starts from what the person had, not from nothing: the cron so far becomes the custom text.
    change({ kind, custom: kind === "CUSTOM" ? toCron(spec) : spec.custom });
  };
  const timeChange = (value: string) => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(value);
    if (match) change({ hour: Number(match[1]), minute: Number(match[2]) });
  };

  return (
    <div className="space-y-3 md:col-span-2">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
        <Select label={tr("Frequency")} value={spec.kind} options={KINDS} enableSearch={false} onChange={(value) => chooseKind(String(value) as FrequencyKind)} />
        {spec.kind === "HOURLY" && (
          <div className="grid grid-cols-2 gap-3 md:gap-4">
            <Select
              label={tr("Every")}
              value={String(spec.everyHours)}
              options={HOUR_STEPS.map((n) => ({ value: String(n), label: n === 1 ? tr("1 hour") : trFormat("{count} hours", { count: n }) }))}
              enableSearch={false}
              onChange={(value) => change({ everyHours: Number(value) })}
            />
            <Select
              label={tr("At minute")}
              value={String(spec.minute)}
              options={MINUTE_CHOICES.map((n) => ({ value: String(n), label: `:${two(n)}` }))}
              enableSearch={false}
              onChange={(value) => change({ minute: Number(value) })}
            />
          </div>
        )}
        {(spec.kind === "DAILY" || spec.kind === "WEEKLY" || spec.kind === "MONTHLY") && <TimePicker label={tr("Time")} value={timeOf(spec)} onChange={timeChange} />}
        {spec.kind === "MONTHLY" && (
          <Select
            label={tr("Day Of The Month")}
            value={String(spec.dayOfMonth)}
            options={[...Array.from({ length: 28 }, (_, i) => ({ value: String(i + 1), label: trFormat("Day {day}", { day: i + 1 }) })), { value: "L", label: tr("Last day of the month") }]}
            onChange={(value) => change({ dayOfMonth: value === "L" ? "L" : Number(value) })}
          />
        )}
        {spec.kind === "CUSTOM" && (
          <FormField label={tr("Cron Expression")} hint={tr("For advanced schedules. Write six parts separated by spaces: second, minute, hour, day of the month, month, day of the week; * means every. Examples: 0 30 6 * * MON-FRI is 06:30 on weekdays; 0 0 */4 * * * is every 4 hours.")}>
            <Input value={spec.custom} onChange={(event) => change({ custom: event.target.value })} />
          </FormField>
        )}
      </div>
      {spec.kind === "WEEKLY" && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-700 sm:text-sm">{tr("Days Of The Week")}</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-lg border border-slate-200 p-3">
            {WEEKDAYS.map((day) => {
              const on = spec.weekdays.includes(day);
              return (
                <Checkbox
                  key={day}
                  label={WEEKDAY_NAMES[day]}
                  checked={on}
                  // At least one day stays: a weekly schedule on no day would never run.
                  disabled={on && spec.weekdays.length === 1}
                  onChange={(checked) => change({ weekdays: checked ? [...spec.weekdays, day] : spec.weekdays.filter((d) => d !== day) })}
                />
              );
            })}
          </div>
        </div>
      )}
      <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
        {describeFrequency(spec)}
      </p>
    </div>
  );
}
