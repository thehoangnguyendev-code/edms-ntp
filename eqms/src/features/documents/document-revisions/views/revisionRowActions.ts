import { resolveStatusCode } from "@/features/documents/shared/statusMapping";
export type RevisionRowAction = "edit" | "view" | "review" | "approve" | "training" | "controlledCopy" | "publish";

export interface RevisionRowActionFlags {
  /** The words for the status, for people. Never compared: the menu decides on statusCode. */
  status?: string;
  /** The status as a code (PENDING_REVIEW, EFFECTIVE ...): what the menu decides on. */
  statusCode?: string | null;
  statusInfo?: { id?: string | null; code?: string | null } | null;
  canEditRevision?: boolean;
  canSubmitForReview?: boolean;
  canReviewRevision?: boolean;
  canApproveRevision?: boolean;
  canCompleteTraining?: boolean;
  canPublishRevision?: boolean;
  canRequestControlledCopy?: boolean;
}

export interface RevisionRowActionOptions {
  /** Whether the screen can publish from its row menu (only the full revision list has the publishing flow). Default true. */
  publish?: boolean;
}

/**
 * The entries of the row menu of every revision list, in order. The server has already decided what the person may do
 * (permission, assignment, scope, lifecycle state); this only maps those answers to menu entries. Both the row's menu
 * button and the menu it opens are built from this list, so they cannot disagree.
 *
 * "View Details" is always first and for every revision: it is the visible way to the detail page for a person who does not
 * know that the Document Number and Revision Number are links, and it keeps the menu from ever being empty. Whoever the
 * server lets edit or submit a Draft also gets "Edit Revision" right after it.
 */
export function revisionRowActions(
  revision: RevisionRowActionFlags,
  options: RevisionRowActionOptions = {},
): RevisionRowAction[] {
  const actions: RevisionRowAction[] = ["view"];
  // A status is told by its code, never by the words shown for it: a change of wording must not change what a person may do.
  const status = resolveStatusCode(revision.statusCode, revision.statusInfo ?? undefined);
  if (Boolean(revision.canEditRevision) || Boolean(revision.canSubmitForReview)) {
    actions.push("edit");
  }
  if (status === "PENDING_REVIEW" && Boolean(revision.canReviewRevision)) {
    actions.push("review");
  }
  if (status === "PENDING_APPROVAL" && Boolean(revision.canApproveRevision)) {
    actions.push("approve");
  }
  if (status === "PENDING_TRAINING" && Boolean(revision.canCompleteTraining)) {
    actions.push("training");
  }
  if (status === "EFFECTIVE" && Boolean(revision.canRequestControlledCopy)) {
    actions.push("controlledCopy");
  }
  if ((options.publish ?? true) && Boolean(revision.canPublishRevision)) {
    actions.push("publish");
  }
  return actions;
}
