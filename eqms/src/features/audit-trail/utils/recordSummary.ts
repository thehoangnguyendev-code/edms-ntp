import type { AuditTrailRecord } from "../types";
import { formatWorkflowStatusLabel } from "./statusLabel";

/**
 * What changed in a record, in one line: the fields with their old and new values (a status that did not move is left out; older rows kept a synthetic
 * "Obsoleted -> Obsoleted" for actions that change nothing), or else the description or the reason.
 */
export const buildChangeSummary = (record: AuditTrailRecord) => {
  if (record.changes && record.changes.length > 0) {
    const rendered = record.changes
      .filter((change) => {
        if (!/status|state/i.test(change.field || "")) return true;
        const o = (change.oldValue ?? "").trim();
        const n = (change.newValue ?? "").trim();
        return o !== "" && n !== "" && o.toLowerCase() !== n.toLowerCase();
      })
      .map((change) => {
        const field = change.field || "Field";
        const isStatusField = /status|state/i.test(field);
        const oldValue = isStatusField ? formatWorkflowStatusLabel(change.oldValue) : change.oldValue || "-";
        const newValue = isStatusField ? formatWorkflowStatusLabel(change.newValue) : change.newValue || "-";
        return `${field}: ${oldValue} → ${newValue}`;
      })
      .join("; ");
    if (rendered) return rendered;
  }
  return record.description || record.reason || record.metadata?.reason || record.metadata?.comment || "-";
};

/** What the record is about: the name of the thing, else its type, else its module. */
export const buildEntityLabel = (record: AuditTrailRecord) =>
  record.entityName || record.metadata?.entityName || record.metadata?.entityType || record.module || "-";
