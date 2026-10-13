import React, { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { TemplateNoTrainingNotice } from "./TemplateNoTrainingNotice";
import { DateTimePicker } from "@/components/ui/datetime-picker/DateTimePicker";
import { FormField, Input } from "@/components/ui/form/ResponsiveForm";

export interface TrainingInformationValue {
  trainingPlannedDate?: string | null;
  trainingPeriodEndDate?: string | null;
  trainingCompletionDate?: string | null;
  trainingPeriodDays?: number | null;
}

interface TrainingInformationTabProps {
  isReadOnly?: boolean;
  data?: TrainingInformationValue;
  onChange?: (value: TrainingInformationValue) => void;
  canEditPlannedDate?: boolean;
  canEditCompletionDate?: boolean;
  /** A controlled-document template never requires training: show a notice instead of the fields. */
  isTemplate?: boolean;
  /** Errors to display on fields — set by parent after attempted submit */
  submitValidationToken?: number;
}

const parseDate = (value: string) => {
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (!match) return null;

  const [, day, month, year, hours, minutes] = match;
  const parsed = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    hours ? Number(hours) : 0,
    minutes ? Number(minutes) : 0,
    0,
    0,
  );

  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDate = (date: Date) => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
};

const addDays = (value: string, days: number) => {
  if (!value || !Number.isFinite(days) || days < 1) {
    return "";
  }

  const parsed = parseDate(value);
  if (!parsed) {
    return "";
  }

  parsed.setDate(parsed.getDate() + days);
  return formatDate(parsed);
};

/** dd/mm/yyyy to the yyyy-mm-dd a date input speaks, and back. Empty or unreadable stays empty. */
const toIsoDate = (value: string) => {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
};
const fromIsoDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
};

/** Types dd/mm/yyyy: keeps digits only and puts the slashes in as the user goes. */
const formatTypedDate = (raw: string) => {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

const validatePlannedDate = (value: string, shouldValidate: boolean) => {
  if (!shouldValidate) {
    return undefined;
  }

  if (!value.trim()) {
    return "Training Planned Date is required.";
  }

  // Date() rolls 31/02 over to 03/03, so the day and month typed must be the ones that come back.
  const typed = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  const parsed = typed ? parseDate(value) : null;
  const real = !!typed && !!parsed && parsed.getDate() === Number(typed[1]) && parsed.getMonth() + 1 === Number(typed[2]);
  return real ? undefined : "Enter a real date as dd/mm/yyyy.";
};

export const TrainingInformationTab: React.FC<TrainingInformationTabProps> = ({
  isReadOnly = false,
  data,
  onChange,
  canEditPlannedDate = false,
  canEditCompletionDate = false,
  isTemplate = false,
  submitValidationToken = 0,
}) => {
  const trainingPeriodDays = useMemo(() => data?.trainingPeriodDays ?? null, [data?.trainingPeriodDays]);
  const [trainingPlannedDate, setTrainingPlannedDate] = useState<string>(data?.trainingPlannedDate ?? "");
  const [trainingPeriodEndDate, setTrainingPeriodEndDate] = useState<string>(data?.trainingPeriodEndDate ?? "");
  const [trainingCompletionDate, setTrainingCompletionDate] = useState<string>(data?.trainingCompletionDate ?? "");
  const [touchedPlannedDate, setTouchedPlannedDate] = useState(false);
  const [localErrors, setLocalErrors] = useState<{ trainingPlannedDate?: string }>({});

  useEffect(() => {
    setTrainingPlannedDate(data?.trainingPlannedDate ?? "");
    setTrainingPeriodEndDate(data?.trainingPeriodEndDate ?? "");
    setTrainingCompletionDate(data?.trainingCompletionDate ?? "");
    setTouchedPlannedDate(false);
    setLocalErrors({});
  }, [data?.trainingCompletionDate, data?.trainingPeriodEndDate, data?.trainingPlannedDate]);

  useEffect(() => {
    if (isReadOnly || !onChange) {
      return;
    }

    onChange({
      trainingPlannedDate,
      trainingPeriodEndDate,
      trainingCompletionDate,
      trainingPeriodDays,
    });
  }, [onChange, isReadOnly, trainingCompletionDate, trainingPeriodDays, trainingPeriodEndDate, trainingPlannedDate]);

  useEffect(() => {
    if (isReadOnly || !canEditPlannedDate) {
      return;
    }

    if (!trainingPlannedDate || !Number.isFinite(trainingPeriodDays ?? NaN) || (trainingPeriodDays ?? 0) < 1) {
      return;
    }

    const nextEndDate = addDays(trainingPlannedDate, Number(trainingPeriodDays));
    if (nextEndDate && nextEndDate !== trainingPeriodEndDate) {
      setTrainingPeriodEndDate(nextEndDate);
    }
  }, [canEditPlannedDate, isReadOnly, trainingPeriodDays, trainingPeriodEndDate, trainingPlannedDate]);

  useEffect(() => {
    const shouldValidate = !isReadOnly && canEditPlannedDate;
    const shouldDisplay = touchedPlannedDate || submitValidationToken > 0;
    const nextError = shouldDisplay ? validatePlannedDate(trainingPlannedDate, shouldValidate) : undefined;

    setLocalErrors((prev) =>
      prev.trainingPlannedDate === nextError ? prev : { trainingPlannedDate: nextError },
    );
  }, [canEditPlannedDate, isReadOnly, submitValidationToken, touchedPlannedDate, trainingPlannedDate]);

  const handlePlannedDateChange = (value: string) => {
    setTouchedPlannedDate(true);
    setTrainingPlannedDate(value);

    if (canEditPlannedDate && !isReadOnly) {
      if (!value) {
        setTrainingPeriodEndDate("");
        return;
      }

      const nextEndDate = addDays(value, Number(trainingPeriodDays ?? 0));
      if (nextEndDate) {
        setTrainingPeriodEndDate(nextEndDate);
      }
    }
  };

  const calendarRef = useRef<HTMLInputElement>(null);
  const openCalendar = () => {
    const input = calendarRef.current;
    if (!input) return;
    if (typeof input.showPicker === "function") input.showPicker();
    else input.focus();
  };

  const handleCompletionDateChange = (value: string) => {
    setTrainingCompletionDate(value);
  };

  if (isTemplate) {
    return <TemplateNoTrainingNotice />;
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <FormField
          label="Training Planned Date"
          required={!isReadOnly && canEditPlannedDate}
          error={localErrors.trainingPlannedDate}
        >
          <div className="flex items-center gap-2">
            <Input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="dd/mm/yyyy"
              maxLength={10}
              value={trainingPlannedDate}
              onChange={(event) => handlePlannedDateChange(formatTypedDate(event.target.value))}
              disabled={isReadOnly || !canEditPlannedDate}
              error={Boolean(localErrors.trainingPlannedDate)}
            />
            <button
              type="button"
              onClick={openCalendar}
              disabled={isReadOnly || !canEditPlannedDate}
              aria-label="Choose the planned date from the calendar"
              title="Choose from calendar"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            >
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
            </button>
            <input
              ref={calendarRef}
              type="date"
              tabIndex={-1}
              aria-hidden="true"
              className="sr-only"
              value={toIsoDate(trainingPlannedDate)}
              onChange={(event) => handlePlannedDateChange(fromIsoDate(event.target.value))}
              disabled={isReadOnly || !canEditPlannedDate}
            />
          </div>
        </FormField>

        <DateTimePicker
          label="Training Period End Date"
          value={trainingPeriodEndDate}
          onChange={setTrainingPeriodEndDate}
          placeholder="Select end date"
          disabled={isReadOnly}
        />

        <DateTimePicker
          label="Training Completion Date"
          value={trainingCompletionDate}
          onChange={handleCompletionDateChange}
          placeholder="Select completion date"
          disabled={isReadOnly || !canEditCompletionDate}
        />
      </div>

      {!isReadOnly && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] sm:text-xs text-slate-600 leading-relaxed space-y-1.5">
          <p>
            <span className="font-medium text-slate-700">Training Planned Date:</span> editable only while the revision is in Pending Training and your assigned permissions allow training-plan management.
          </p>
          <p>
            <span className="font-medium text-slate-700">Training Period End Date:</span> auto-calculated from Training Planned Date + Training Period (Days) and always read-only.
          </p>
          <p>
            <span className="font-medium text-slate-700">Training Completion Date:</span> editable only while Pending Training and your assigned permissions allow training completion; if left blank, the server may use the current date on complete.
          </p>
        </div>
      )}
    </div>
  );
};
