import React from 'react';
import { documentApi } from '@/services/api/documents';
import { BreakdownPanel } from '../shared/BreakdownPanel';
import { statusSlices, type RankedCount } from '../shared/dashboardMetrics';
import { DOCUMENT_STATUS, DOCUMENT_STATUS_ORDER } from '../shared/documentStatus';
import { useDashboardResource } from '../shared/useDashboardResource';
import { tr, trFormat } from "@/i18n";

/**
 * Documents the current user authored, per lifecycle status. Every figure is the total the document list
 * itself reports for `scope=owned-by-me` (and one status), so it follows the same visibility rules as that list.
 */
export async function loadMyDocumentsByStatus(): Promise<RankedCount[]> {
  const count = async (status?: string) => (await documentApi.getDocumentsPage({ scope: 'owned-by-me', status, limit: 1 })).pagination.total;
  const [total, ...perStatus] = await Promise.all([count(), ...DOCUMENT_STATUS_ORDER.map((code) => count(code))]);
  const counts = Object.fromEntries(DOCUMENT_STATUS_ORDER.map((code, index) => [code, perStatus[index]]));
  return statusSlices(total, counts, DOCUMENT_STATUS_ORDER)
    .filter((slice) => slice.value > 0)
    .map((slice) => ({ key: slice.key, name: DOCUMENT_STATUS[slice.key].label, shortCode: DOCUMENT_STATUS[slice.key].label, value: slice.value }));
}

const statusColor = (row: RankedCount) => DOCUMENT_STATUS[row.key]?.color ?? DOCUMENT_STATUS.OTHER.color;

/** "My documents" in the shared bar/donut panel; statuses keep the colours they have everywhere else on the dashboard. */
export const MyDocumentsPanel: React.FC<{ className?: string }> = ({ className }) => {
  const mine = useDashboardResource(loadMyDocumentsByStatus, []);

  return (
    <BreakdownPanel
      className={className}
      title={tr("My documents by status")}
      idleSubtitle={tr("Documents you authored, per lifecycle status")}
      subtitle={(total) => trFormat("{total} documents authored by you", { total: total.toLocaleString() })}
      resource={mine}
      valueLabel={tr("My documents")}
      centerCaption={tr("Mine")}
      chartLabel={tr("my documents by status")}
      emptyLabel={tr("You have not authored any document yet")}
      errorMessage={tr("Your documents could not be loaded.")}
      idPrefix="my-documents"
      defaultView="bar"
      colorFor={statusColor}
    />
  );
};
