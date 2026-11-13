import { CONTROL_STATE_CLASSES } from "@/components/ui/controlState";

/** A read-only fact shown as a labelled input, as the General Information of the Document details shows its fields. */
export function ReadonlyField({ label, value }: { label: string; value: string }) {
  const id = `report-field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-slate-700 sm:text-sm">
        {label}
      </label>
      <input id={id} type="text" value={value} readOnly className={CONTROL_STATE_CLASSES.readonlyField} />
    </div>
  );
}
