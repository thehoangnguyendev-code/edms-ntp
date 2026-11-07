export type RevisionRowAction = "edit" | "view" | "review" | "approve" | "training" | "controlledCopy" | "publish";

export interface RevisionRowActionFlags {
  state?: string;
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
  if (Boolean(revision.canEditRevision) || Boolean(revision.canSubmitForReview)) {
    actions.push("edit");
  }
  if (revision.state === "Pending Review" && Boolean(revision.canReviewRevision)) {
    actions.push("review");
  }
  if (revision.state === "Pending Approval" && Boolean(revision.canApproveRevision)) {
    actions.push("approve");
  }
  if (revision.state === "Pending Training" && Boolean(revision.canCompleteTraining)) {
    actions.push("training");
  }
  if (revision.state === "Effective" && Boolean(revision.canRequestControlledCopy)) {
    actions.push("controlledCopy");
  }
  if ((options.publish ?? true) && Boolean(revision.canPublishRevision)) {
    actions.push("publish");
  }
  return actions;
}
