import React from "react";
import type { UncontrolledCopyPolicyMarking } from "@/services/api/uncontrolledCopyPolicy";

export const MANDATORY_WATERMARK_TEXT = "UNCONTROLLED COPY — NOT VALID FOR PRODUCTION USE";

/** Corner fallback (page-fraction insets) used only when the saved policy has no explicit drag position for this
 *  page (placements[]) -- e.g. a brand-new policy row that was never opened in the drag editor yet. */
const STAMP_CORNER_FALLBACK: Record<string, React.CSSProperties> = {
  TOP_LEFT: { top: "2%", left: "2%" },
  TOP_RIGHT: { top: "2%", right: "2%" },
  BOTTOM_LEFT: { bottom: "2%", left: "2%" },
  BOTTOM_RIGHT: { bottom: "2%", right: "2%" },
};

/** Resolves the stamp box position/size the same way MarkingPreviewPane's drag editor commits it: top-left-origin
 *  page fractions (0..1) for stampX/stampY, page-width percent for stampWidthPercent. Prefers the saved placement
 *  for the page this preview represents (first page), falling back to a plain corner if none was ever saved. */
const resolveStampStyle = (marking: UncontrolledCopyPolicyMarking): React.CSSProperties => {
  const placement = marking.placements?.find((p) => p.pages === "FIRST" || p.pages === "ALL");
  // minWidth (not width): the saved width sets the box's saved footprint, but the illustrative box must never force
  // its text onto a second line just to stay inside a narrower saved percentage -- it grows past that if it has to.
  const minWidth = `${placement?.stampWidthPercent ?? 22}%`;
  if (placement?.stampX != null && placement?.stampY != null) {
    return { left: `${placement.stampX * 100}%`, top: `${placement.stampY * 100}%`, minWidth };
  }
  return { ...(STAMP_CORNER_FALLBACK[marking.stampPosition] ?? STAMP_CORNER_FALLBACK.TOP_RIGHT), minWidth };
};

/**
 * Illustrative, client-side picture of the marks an Uncontrolled Copy carries: the watermark title line (always
 * drawn, every page -- defaults to the mandatory text but is editable) plus the optionally-shown recipient/issue
 * time lines, and the optional stamp (title, optionally-shown copy number/date). Same "what will it look like"
 * role as the Controlled Copies Policy MarkingPreviewPane, but not server-rendered -- the exact placement on the
 * real PDF is decided by the server's marking engine at Generate time. Mirrors UncontrolledCopyService.markingPlan().
 */
export const UncontrolledCopyMarkingPreview: React.FC<{
  marking: UncontrolledCopyPolicyMarking;
  recipientLabel?: string;
  copyNumberLabel?: string;
  mandatoryText?: string;
}> = ({ marking, recipientLabel = "Recipient name", copyNumberLabel = "UC-DOC-001", mandatoryText = MANDATORY_WATERMARK_TEXT }) => {
  const issuedAt = new Date().toLocaleString();
  const titleText = (marking.watermarkText || "").trim() || mandatoryText;
  const watermarkLines = [
    titleText,
    ...(marking.watermarkShowRecipient ?? true ? [`Issued to: ${recipientLabel}`] : []),
    ...(marking.watermarkShowIssuedDate ?? true ? [`Issued: ${issuedAt}`] : []),
  ];
  const angle = -(marking.watermarkAngleDegrees ?? 35);
  const stampStyle = resolveStampStyle(marking);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 md:p-5">
      <p className="mb-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Marking preview (illustrative)</p>
      <div className="relative mx-auto aspect-[1/1.414] w-full max-w-sm overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="space-y-2 p-6">
          <div className="h-3 w-2/3 rounded bg-slate-200" />
          {Array.from({ length: 14 }).map((_, index) => (
            <div key={index} className="h-2 rounded bg-slate-100" style={{ width: `${70 + ((index * 13) % 30)}%` }} />
          ))}
        </div>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className="text-center font-bold leading-tight"
            style={{
              color: marking.watermarkColor,
              opacity: Math.min(Math.max((marking.watermarkOpacityPercent ?? 25) / 100, 0.05), 1),
              transform: `rotate(${angle}deg)`,
            }}
          >
            {watermarkLines.map((line, index) => (
              <div key={index} className={index === 0 ? "text-sm" : "text-2xs"}>
                {line}
              </div>
            ))}
          </div>
        </div>
        {marking.stampEnabled && (
          <div
            className="pointer-events-none absolute whitespace-nowrap rounded border-2 px-2 py-1 text-center text-2xs font-bold"
            style={{
              ...stampStyle,
              color: marking.stampColor,
              borderColor: marking.stampColor,
              opacity: Math.min(Math.max((marking.stampOpacityPercent ?? 90) / 100, 0.3), 1),
            }}
          >
            <div>{marking.stampText || "UNCONTROLLED COPY"}</div>
            {(marking.stampShowCopyNumber ?? true) && <div className="font-medium">{copyNumberLabel}</div>}
            {marking.stampShowDate && <div className="font-medium">{issuedAt}</div>}
          </div>
        )}
      </div>
      <p className="mt-3 text-2xs text-slate-400">
        The watermark itself always prints on every page; its title line defaults to the mandatory text but can be replaced.
      </p>
    </div>
  );
};
