import { DateTimePicker } from "@/components/ui/datetime-picker";

/** What each date of a training means: the same words wherever the date is shown. */
export const DATE_HINT = {
  due: "The last day to complete the training: the end of the training period of the document or requirement.",
  scheduled: "The day planned for this session. Choose another day if the session is postponed.",
  conducted: "The day the session was actually held. The system fills it; it is not typed.",
} as const;

/** The project date picker with an ISO date (yyyy-MM-dd) in and out, which is what the Training API uses. */
export function TrainingDateField({ label, value, onChange, disabled, placeholder, error, hint }: { label?: string; value: string; onChange: (iso: string) => void; disabled?: boolean; placeholder?: string; error?: string; hint?: string }) {
  const picker = (
    <DateTimePicker
      label={label}
      value={value}
      disabled={disabled}
      error={error}
      placeholder={placeholder ?? "Select date"}
      onChange={(v) => {
        const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
        onChange(m ? `${m[3]}-${m[2]}-${m[1]}` : "");
      }}
    />
  );
  if (!hint) return picker;
  return <div>{picker}{!error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}</div>;
}
