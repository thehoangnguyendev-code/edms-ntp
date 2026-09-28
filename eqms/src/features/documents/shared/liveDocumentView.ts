/**
 * Stages where the Document tab shows the working file in a read-only OnlyOffice viewer instead of a
 * converted PDF. Once published (Effective and later) the published PDF is shown instead.
 *
 * A controlled-document template is the exception: it is never converted to PDF at any stage (it is kept
 * and used as its Word file), so it is viewed through OnlyOffice at every stage, Effective included.
 */
const LIVE_VIEW_STAGES = new Set(["DRAFT", "PENDING_REVIEW", "PENDING_APPROVAL", "PENDING_TRAINING", "READY_FOR_PUBLISHING"]);

export const isLiveViewStage = (
  detail: { statusCode?: string | null; status?: string | null; isTemplate?: boolean | null } | null | undefined,
): boolean => {
  if (detail?.isTemplate === true) return true;
  const raw = String(detail?.statusCode ?? detail?.status ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  return LIVE_VIEW_STAGES.has(raw);
};
