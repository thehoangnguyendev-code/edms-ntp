import React, { useMemo } from 'react';
import type { DashboardAdminStats } from '@/services/api/dashboard';
import { BreakdownPanel } from '../shared/BreakdownPanel';
import { statusSlices, type RankedCount } from '../shared/dashboardMetrics';
import { DOCUMENT_STATUS, DOCUMENT_STATUS_ORDER } from '../shared/documentStatus';
import type { DashboardResource } from '../shared/useDashboardResource';

const statusColor = (row: RankedCount) => DOCUMENT_STATUS[row.key]?.color ?? DOCUMENT_STATUS.OTHER.color;

/**
 * Every Document by lifecycle status, as bars or a ring. The four listed statuses are always shown, even at zero;
 * documents in any other status are counted as "Other", so the rows add up to the total.
 */
export const DocumentsByStatusPanel: React.FC<{ stats: DashboardResource<DashboardAdminStats>; className?: string }> = ({ stats, className }) => {
  const resource = useMemo<DashboardResource<RankedCount[]>>(() => {
    const data = stats.data;
    return {
      ...stats,
      data: data
        ? data.totalDocuments > 0
          ? statusSlices(data.totalDocuments, data.documentsByStatus, DOCUMENT_STATUS_ORDER)
              .map((slice) => ({ key: slice.key, name: DOCUMENT_STATUS[slice.key].label, shortCode: DOCUMENT_STATUS[slice.key].label, value: slice.value }))
          : []
        : null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats.data, stats.loading, stats.error]);

  return (
    <BreakdownPanel
      className={className}
      title="Documents by status"
      idleSubtitle="All documents, per lifecycle status"
      subtitle={(total) => `${total.toLocaleString()} total`}
      resource={resource}
      valueLabel="Documents"
      centerCaption="Documents"
      chartLabel="documents by status"
      emptyLabel="There are no documents yet"
      errorMessage="Documents by status could not be loaded."
      idPrefix="documents-status"
      defaultView="bar"
      colorFor={statusColor}
    />
  );
};
