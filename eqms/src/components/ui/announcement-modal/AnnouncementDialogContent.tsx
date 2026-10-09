import React from "react";
import { CalendarClock, Info, OctagonAlert, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { cn } from "@/components/ui/utils";

export type AnnouncementSeverity = "INFO" | "WARNING" | "CRITICAL";

/**
 * The visual elements of each severity. Severity is never shown by colour alone: every level has its own icon and a text label.
 * Pairs follow the project's status colours (-50 surface, -600 icon, -700 text).
 */
const SEVERITY: Record<
  AnnouncementSeverity,
  { label: string; badge: "blue" | "amber" | "red"; accent: string; tile: string; Icon: React.ElementType }
> = {
  INFO: { label: "Information", badge: "blue", accent: "bg-blue-500", tile: "bg-blue-50 text-blue-600 ring-blue-100", Icon: Info },
  WARNING: { label: "Warning", badge: "amber", accent: "bg-amber-500", tile: "bg-amber-50 text-amber-600 ring-amber-100", Icon: TriangleAlert },
  CRITICAL: { label: "Critical", badge: "red", accent: "bg-red-500", tile: "bg-red-50 text-red-600 ring-red-100", Icon: OctagonAlert },
};

export interface AnnouncementDialogContentProps {
  title: string;
  /** Plain text. Rendered as text (line breaks kept), never as markup. */
  message: string;
  severity?: AnnouncementSeverity;
  /** The period the announcement is shown, or any short note under the message. */
  footnote?: React.ReactNode;
  /** "2 of 3" is shown when there is more than one announcement waiting. */
  position?: number;
  total?: number;
  onClose: () => void;
  closeLabel?: string;
  titleId?: string;
  descriptionId?: string;
  closeButtonRef?: React.Ref<HTMLButtonElement>;
  className?: string;
}

/** The card of an announcement dialog: severity accent, icon, title, message, period and the Close button. */
export const AnnouncementDialogContent: React.FC<AnnouncementDialogContentProps> = ({
  title,
  message,
  severity = "INFO",
  footnote,
  position,
  total,
  onClose,
  closeLabel = "Close",
  titleId,
  descriptionId,
  closeButtonRef,
  className,
}) => {
  const style = SEVERITY[severity] ?? SEVERITY.INFO;
  const SeverityIcon = style.Icon;
  const showCount = typeof total === "number" && total > 1 && typeof position === "number";

  return (
    <div className={cn("w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl", className)}>
      <div aria-hidden className={cn("h-1.5 w-full", style.accent)} />
      <div className="px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
        <div className="flex items-start gap-4">
          <span aria-hidden className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full ring-1", style.tile)}>
            <SeverityIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <Badge color={style.badge} size="sm">
              {style.label}
            </Badge>
            <h2 id={titleId} className="mt-2 break-words text-base font-semibold leading-snug text-slate-900 sm:text-lg">
              {title}
            </h2>
          </div>
        </div>
        {/* A long message scrolls inside the card; it is focusable so a keyboard user can scroll it. */}
        <div
          id={descriptionId}
          tabIndex={0}
          style={{ maxHeight: "45dvh" }}
          className="custom-scrollbar mt-4 overflow-y-auto whitespace-pre-line break-words rounded pr-1 text-sm leading-relaxed text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          {message}
        </div>
        {footnote && (
          <p className="mt-4 flex items-start gap-1.5 text-xs text-slate-500">
            <CalendarClock aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 break-words">{footnote}</span>
          </p>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/60 px-5 py-3 sm:px-6">
        <span aria-live="polite" className="text-xs text-slate-500">
          {showCount ? `${position} of ${total}` : ""}
        </span>
        <Button ref={closeButtonRef} type="button" size="sm" onClick={onClose}>
          {closeLabel}
        </Button>
      </div>
    </div>
  );
};
