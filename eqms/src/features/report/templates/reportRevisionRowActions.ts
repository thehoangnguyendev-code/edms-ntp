import type { ReportRevisionListRow } from "@/services/api/reportTemplates";

export type ReportRevisionRowAction = "view" | "edit" | "approve" | "upgrade";

/**
 * The entries of the row menu of the revisions lists, in order, built as the row menu of Document Control revisions is: "View Details" is first and for every
 * revision (it is the visible way to the page of the revision, and the menu is never empty); the other entries depend on the status of the revision (told by its
 * code, never by the words shown for it) and on what the server lets this person do to the template (`capabilities`, which carries the permission, the state of the
 * template and, for a decision, that the person is not the author or submitter). Every action is checked again by the service that carries it out.
 *  - Edit Revision: a Draft the person may edit or send for approval (the editor holds Save and Submit for Approval).
 *  - Approve Revision: a revision Pending Approval that the person may decide (the page of the template holds Approve and Reject).
 *  - Upgrade Report Template: the revision in force, when nothing is open and the person may upgrade (the details page opens the Upgrade dialog).
 */
export function reportRevisionRowActions(row: Pick<ReportRevisionListRow, "status" | "capabilities">): ReportRevisionRowAction[] {
  const can = (action: string) => row.capabilities?.actions?.[action]?.allowed === true;
  const actions: ReportRevisionRowAction[] = ["view"];
  if (row.status === "DRAFT" && (can("edit") || can("submitForApproval"))) actions.push("edit");
  if (row.status === "PENDING_APPROVAL" && can("approve")) actions.push("approve");
  if (row.status === "EFFECTIVE" && can("upgrade")) actions.push("upgrade");
  return actions;
}
