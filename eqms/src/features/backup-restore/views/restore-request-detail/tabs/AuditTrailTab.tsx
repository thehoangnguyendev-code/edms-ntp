import React from "react";
import { AuditTrailTab as SharedAuditTrailTab } from "@/features/documents/shared/components/AuditTrailTab";
import type { RestoreRequestRecord } from "@/services/api/backupRestore";

/**
 * The audit trail of one restore request: the same screen as the audit trail of a document, filtered to this request. Every step the
 * request went through (asked, approved, rejected, refused) is an audit record written with the request as its entity.
 */
export const AuditTrailTab: React.FC<{ request: RestoreRequestRecord }> = ({ request }) => (
  <SharedAuditTrailTab entityId={request.id} entityType="BACKUP_RESTORE" emptyMessage="No audit trail records for this request." />
);
