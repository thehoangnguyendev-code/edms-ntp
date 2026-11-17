import { ROUTES } from "@/app/routes.constants";
import { getDefaultAuditTrailDateRange } from "./dateRange";

/**
 * The Audit Trail list of one object, from the first record to now (AUDIT-DETAIL-2026-11-17). The object is found by the id the record already carries;
 * the code is only the words the filter chip shows, so no technical id is ever shown.
 */
export const objectHistoryPath = (entityId: string, objectCode: string): string => {
  const params = new URLSearchParams({
    entityId,
    objectCode,
    dateFrom: "01/01/2000 00:00:00",
    dateTo: getDefaultAuditTrailDateRange().endDate,
  });
  return `${ROUTES.AUDIT_TRAIL}?${params.toString()}`;
};
