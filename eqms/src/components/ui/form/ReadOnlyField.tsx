import React from "react";
import { cn } from "@/components/ui/utils";

interface ReadOnlyFieldProps {
  /** The value to display. Renders a placeholder when falsy. */
  value?: string | number | null;
  /** Placeholder text shown when value is empty. Defaults to "—" */
  placeholder?: string;
  /** Additional className for the container element */
  className?: string;
}

/**
 * ReadOnlyField — Displays a form field value in read-only mode.
 *
 * Matches the `h-9` height of the editable inputs so that read-only and
 * edit modes share the same vertical rhythm.
 *
 * Usage:
 * ```tsx
 * import { ReadOnlyField } from "@/components/ui/form/ReadOnlyField";
 *
 * <ReadOnlyField value={course.title} />
 * <ReadOnlyField value={course.scheduledDate} placeholder="Not set" />
 * ```
 */
export const ReadOnlyField: React.FC<ReadOnlyFieldProps> = ({
  value,
  placeholder = "—",
  className,
}) => (
  <p
    className={cn(
      "text-sm text-slate-700 h-9 flex items-center px-3 font-medium",
      "bg-slate-100 border border-slate-200 rounded-lg",
      className
    )}
  >
    {value !== undefined && value !== null && value !== "" ? (
      value
    ) : (
      <span className="text-slate-400">{placeholder}</span>
    )}
  </p>
);
