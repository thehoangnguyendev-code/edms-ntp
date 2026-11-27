import React from "react";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { DateRangePicker } from "@/components/ui/datetime-picker/DateRangePicker";
import { tr } from "@/i18n";

const labelClass = "mb-1.5 block text-xs font-medium text-slate-700 sm:text-sm";
const textareaClass = "w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm transition-colors placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-50";

interface TimeLimitedUserGrantFieldsProps {
  startDisplay: string;
  endDisplay: string;
  notifyEmailOnExpiry: boolean;
  reason: string;
  onStartDisplayChange: (value: string) => void;
  onEndDisplayChange: (value: string) => void;
  onNotifyEmailOnExpiryChange: (value: boolean) => void;
  onReasonChange: (value: string) => void;
  disabled?: boolean;
  reasonPlaceholder: string;
}

/** Shared editable access-window controls. User selection/identity and save behavior stay in each screen. */
export const TimeLimitedUserGrantFields: React.FC<TimeLimitedUserGrantFieldsProps> = ({
  startDisplay,
  endDisplay,
  notifyEmailOnExpiry,
  reason,
  onStartDisplayChange,
  onEndDisplayChange,
  onNotifyEmailOnExpiryChange,
  onReasonChange,
  disabled = false,
  reasonPlaceholder,
}) => (
  <div className="space-y-5">
    <div>
      <DateRangePicker
        label={<>{tr("Active Window")} <span className="text-red-500">*</span></>}
        startDate={startDisplay}
        endDate={endDisplay}
        includeTime
        onStartDateChange={onStartDisplayChange}
        onEndDateChange={onEndDisplayChange}
        onApply={({ startDate, endDate }) => {
          onStartDisplayChange(startDate);
          onEndDisplayChange(endDate);
        }}
        placeholder={tr("Select the allowed active date and time range")}
        disabled={disabled}
      />
      <p className="mt-1.5 text-xs text-slate-500 flex items-center gap-1 font-normal">{tr("The user can only sign in from Start through End. Outside this window their account is automatically suspended.")}</p>
    </div>
    <Checkbox
      checked={notifyEmailOnExpiry}
      onChange={onNotifyEmailOnExpiryChange}
      disabled={disabled}
      label={tr("Send an e-mail notification to the user when their access expires")}
    />
    <div>
      <label className={labelClass}>{tr("Reason / Comment")}</label>
      <textarea
        value={reason}
        onChange={(event) => onReasonChange(event.target.value)}
        className={textareaClass}
        rows={3}
        placeholder={reasonPlaceholder}
        disabled={disabled}
      />
    </div>
  </div>
);
