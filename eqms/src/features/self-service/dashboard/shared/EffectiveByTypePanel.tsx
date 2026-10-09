import React, { useMemo } from 'react';
import { dashboardApi } from '@/services/api/dashboard';
import { BreakdownPanel } from './BreakdownPanel';
import type { RankedCount } from './dashboardMetrics';
import { useDashboardResource } from './useDashboardResource';

/** Effective Documents per Document Type, in the shared bar/donut panel. */
export const EffectiveByTypePanel: React.FC<{ className?: string }> = ({ className }) => {
  const types = useDashboardResource(() => dashboardApi.getEffectiveDocumentsByType(), []);
  const resource = useMemo(
    () => ({
      ...types,
      data: types.data
        ? types.data.map<RankedCount>((row) => ({ key: row.typeId, name: row.name, shortCode: row.shortCode, value: row.documents }))
        : null,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [types.data, types.loading, types.error],
  );

  return (
    <BreakdownPanel
      className={className}
      title="Effective documents by type"
      idleSubtitle="Documents with an effective revision, per Document Type"
      subtitle={(total, count) => `${total.toLocaleString()} effective documents across ${count} ${count === 1 ? 'type' : 'types'}`}
      resource={resource}
      valueLabel="Effective documents"
      centerCaption="Effective"
      chartLabel="effective documents by type"
      emptyLabel="No document is effective yet"
      errorMessage="Effective documents by type could not be loaded."
      idPrefix="effective-type"
      defaultView="donut"
    />
  );
};
