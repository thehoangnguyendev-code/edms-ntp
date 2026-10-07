import React, { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Select } from '@/components/ui/select/Select';
import { dashboardApi } from '@/services/api/dashboard';
import { ActivityBarChart } from '../shared/ActivityBarChart';
import { fillActivityPeriods, longPeriodLabel, shortPeriodLabel, type ActivityPeriod } from '../shared/dashboardMetrics';
import { PanelError } from '../shared/dashboardParts';
import { Card, CardHeader } from '../shared/dashboardUi';
import { useDashboardResource } from '../shared/useDashboardResource';

const PERIOD_OPTIONS = [
  { label: 'Monthly', value: 'month' },
  { label: 'Quarterly', value: 'quarter' },
  { label: 'Yearly', value: 'year' },
];

const PERIOD_LABEL: Record<ActivityPeriod, string> = { month: 'last 12 months', quarter: 'last 4 quarters', year: 'last 5 years' };

/** Documents created over time. Empty periods are drawn as zero so the axis is evenly spaced. */
export const DocumentActivityPanel: React.FC<{ className?: string }> = ({ className }) => {
  const [period, setPeriod] = useState<ActivityPeriod>('month');
  const reduceMotion = useReducedMotion();
  const activity = useDashboardResource(() => dashboardApi.getDocumentActivity(period), [period]);
  const series = useMemo(() => fillActivityPeriods(activity.data ?? [], period), [activity.data, period]);
  const total = series.reduce((sum, point) => sum + point.value, 0);

  return (
    <Card className={className} aria-label="Document activity">
      <CardHeader
        title="Document activity"
        subtitle={activity.data ? `${total.toLocaleString()} documents created in the ${PERIOD_LABEL[period]}` : 'Documents created over time'}
        right={<div className="w-32"><Select value={period} onChange={(value) => setPeriod(value as ActivityPeriod)} enableSearch={false} options={PERIOD_OPTIONS} /></div>}
      />
      {activity.error ? (
        <PanelError message="Document activity could not be loaded." onRetry={activity.reload} />
      ) : activity.loading && !activity.data ? (
        <div className="m-4 h-[232px] animate-pulse rounded-lg bg-slate-50" aria-hidden />
      ) : total === 0 ? (
        <div className="flex h-[232px] items-center justify-center text-sm text-slate-400">No documents were created in this period</div>
      ) : (
        <motion.div
          key={period}
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.2, 0.8, 0.3, 1] }}
        >
          <ActivityBarChart data={series} color="#10b981" valueLabel="Documents created" titleFor={longPeriodLabel} shortLabel={shortPeriodLabel} showValues={series.length <= 13} />
        </motion.div>
      )}
    </Card>
  );
};
