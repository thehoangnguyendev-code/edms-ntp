import { DateTimePicker } from "@/components/ui/datetime-picker";

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
