import React, { useMemo } from 'react';
import { dashboardApi } from '@/services/api/dashboard';
import { BreakdownPanel } from './BreakdownPanel';
import type { RankedCount } from './dashboardMetrics';
import { useDashboardResource } from './useDashboardResource';
import { tr, trFormat } from "@/i18n";

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
      title={tr("Effective documents by type")}
      idleSubtitle={tr("Documents with an effective revision, per Document Type")}
      subtitle={(total, count) => trFormat("{total} effective documents across {count} {type}", { total: total.toLocaleString(), count, type: count === 1 ? tr("type") : tr("types") })}
      resource={resource}
      valueLabel={tr("Effective documents")}
      centerCaption={tr("Effective")}
      chartLabel={tr("effective documents by type")}
      emptyLabel={tr("No document is effective yet")}
      errorMessage={tr("Effective documents by type could not be loaded.")}
      idPrefix="effective-type"
      defaultView="donut"
    />
  );
};
