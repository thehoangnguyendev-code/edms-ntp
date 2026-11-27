import { tr as __ariaTr } from "@/i18n";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { ChartConfiguration, Plugin } from 'chart.js';
import { Chart } from 'chart.js';
import { IconAlertCircle, IconDatabase, IconDownload, IconTrendingUp } from '@tabler/icons-react';
import { ChartCanvas } from '@/components/ui/chart';
import { api } from '@/services/api/client';
import { Badge } from '@/components/ui/badge/Badge';
import { Button } from '@/components/ui/button/Button';
import { FormField, Input } from '@/components/ui/form/ResponsiveForm';
import { BarFill } from '@/components/ui/progress/BarFill';
import { TableMarkup } from '@/components/ui/table/TablePrimitives';
import { TabNav, type TabItem } from '@/components/ui/tabs';
import { useBarWipe } from '@/hooks/useBarFill';
import { formatDate, formatDateTime } from '@/utils/format';
import type { StoragePolicyController, StoragePolicyValue } from '../useStoragePolicyDraft';
import { dailySeries, forecastOf, growthByPart, growthOf, jumpsOf, measurementsToCsv, withinDays, type Forecast, type Jump, type UsageSnapshot } from './storageUsage';
import { tr, trFormat } from "@/i18n";

export { growthOf };

const GIB = 1024 ** 3;
const size = (bytes: number) => {
  const unit = bytes >= GIB ? 'GiB' : bytes >= 1024 ** 2 ? 'MiB' : bytes >= 1024 ? 'KiB' : 'B';
  const divisor = unit === 'GiB' ? GIB : unit === 'MiB' ? 1024 ** 2 : unit === 'KiB' ? 1024 : 1;
  return `${Math.round((bytes / divisor) * 100) / 100} ${unit}`;
};
const signedSize = (bytes: number) => `${bytes < 0 ? '−' : '+'}${size(Math.abs(bytes))}`;

const RANGES: TabItem[] = [{ id: '7', label: '7 days' }, { id: '30', label: '30 days' }, { id: '90', label: '90 days' }];
const VIEWS: TabItem[] = [{ id: 'chart', label: 'Chart' }, { id: 'table', label: 'Table' }];
const PARTS: TabItem[] = [{ id: 'byDomain', get label() { return tr('By storage domain'); } }, { id: 'byFileType', get label() { return tr('By file type'); } }];
const JUMPS_LABEL = 'Biggest jumps';
const FORECAST_LABEL = 'Estimate at the current growth';

/** The size over time on a time axis (oldest first), with the budget and the warning level on the same axis when a budget is set, the estimate of when the budget is reached, and the biggest jumps. */
const historyConfiguration = (snapshots: UsageSnapshot[], policy: StoragePolicyValue | null, forecast: Forecast | null, jumps: Jump[]): ChartConfiguration<'line'> => {
  const ordered = [...snapshots].reverse();
  const at = (snapshot: UsageSnapshot) => new Date(snapshot.measuredAt).getTime();
  const firstX = at(ordered[0]);
  const lastSnapshot = ordered[ordered.length - 1];
  const lastX = at(lastSnapshot);
  const lastEnd = forecast ? forecast.reachesAt : lastX;
  const lastEndX = lastEnd + (lastEnd - firstX) * 0.04;
  const budget = policy?.budgetBytes ?? null;
  const reference = (label: string, bytes: number, color: string, dash: number[]) => ({
    label, data: [{ x: firstX, y: bytes }, { x: lastEndX, y: bytes }], borderColor: color, borderWidth: 1.5, borderDash: dash, pointRadius: 0, pointHoverRadius: 0, fill: false, tension: 0,
  });
  const jumpPlugin: Plugin<'line'> = {
    id: 'jumpLabels',
    afterDatasetsDraw(chart) {
      const index = chart.data.datasets.findIndex((dataset) => dataset.label === JUMPS_LABEL);
      if (index < 0) return;
      const { ctx } = chart;
      ctx.save();
      ctx.font = `600 11px ${Chart.defaults.font.family}`;
      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'right';
      chart.getDatasetMeta(index).data.forEach((point, i) => {
        const jump = jumps[i];
        if (jump) ctx.fillText(`${signedSize(jump.delta)} · ${formatDate(jump.snapshot.measuredAt).slice(0, 5)}`, point.x - 8, point.y - 8);
      });
      ctx.restore();
    },
  };
  let previousTick = '';
  return {
    type: 'line',
    data: {
      datasets: [
        { label: tr('Object-version size'), data: ordered.map((snapshot) => ({ x: at(snapshot), y: snapshot.totalBytes })), borderColor: '#059669', backgroundColor: 'rgba(5, 150, 105, 0.12)', fill: true, tension: 0.3, pointRadius: 0, pointHoverRadius: 4, borderWidth: 2 },
        ...(budget ? [
          reference(`Budget ${size(budget)}`, budget, '#475569', []),
          reference(`Warning at ${policy?.warningPercent}%`, budget * ((policy?.warningPercent ?? 100) / 100), '#d97706', [5, 4]),
        ] : []),
        ...(budget && forecast ? [{
          label: FORECAST_LABEL, data: [{ x: lastX, y: lastSnapshot.totalBytes }, { x: forecast.reachesAt, y: budget }], borderColor: '#059669', borderWidth: 2, borderDash: [3, 4],
          pointRadius: [0, 5], pointBackgroundColor: '#ffffff', pointBorderColor: '#059669', pointBorderWidth: 2, pointHoverRadius: 0, fill: false, tension: 0,
        }] : []),
        ...(jumps.length ? [{
          label: JUMPS_LABEL, data: jumps.map((jump) => ({ x: at(jump.snapshot), y: jump.snapshot.totalBytes })), showLine: false, pointRadius: 4, pointHoverRadius: 5,
          pointBackgroundColor: '#059669', pointBorderColor: '#ffffff', pointBorderWidth: 2,
        }] : []),
      ],
    },
    plugins: [jumpPlugin],
    options: {
      animation: { duration: 700, easing: 'easeOutQuad' },
      interaction: { mode: 'nearest', axis: 'x', intersect: false },
      scales: {
        x: {
          type: 'linear', min: firstX, max: lastEndX, grid: { display: false },
          ticks: {
            maxTicksLimit: 8,
            callback: (value, index) => {
              const label = formatDate(new Date(Number(value)));
              if (index === 0) previousTick = '';
              const shown = label === previousTick ? '' : label;
              previousTick = label;
              return shown;
            },
          },
        },
        y: { beginAtZero: Boolean(budget), suggestedMax: budget ?? undefined, grid: { color: '#f1f5f9' }, border: { display: false }, ticks: { callback: (value) => size(Number(value)) } },
      },
      plugins: {
        legend: { display: Boolean(budget), position: 'top', align: 'end', labels: { filter: (item) => item.datasetIndex !== 0 && item.text !== JUMPS_LABEL, boxWidth: 22, boxHeight: 2, usePointStyle: false } },
        tooltip: {
          filter: (item) => item.datasetIndex === 0 || item.dataset.label === JUMPS_LABEL,
          backgroundColor: '#ffffff', titleColor: '#0f172a', bodyColor: '#334155', borderColor: '#e2e8f0', borderWidth: 1, padding: 10,
          callbacks: {
            title: (items) => (items[0] ? formatDateTime(new Date(items[0].parsed.x as number)) : ''),
            label: (item) => `Object-version size: ${size(Number(item.parsed.y))}`,
          },
        },
      },
    },
  };
};

const SEGMENT_COLORS = ['bg-emerald-700', 'bg-emerald-600', 'bg-emerald-400', 'bg-emerald-200'];

/** How the size splits: one segmented bar and the figures under it. The biggest four stay apart, the rest are summed into "others". */
const Composition = ({ title, values, total }: { title: string; values: Record<string, number>; total: number }) => {
  const entries = Object.entries(values).sort((a, b) => b[1] - a[1]);
  const share = (bytes: number) => (total > 0 ? (bytes / total) * 100 : 0);
  const major = entries.filter(([, bytes]) => share(bytes) >= 2).slice(0, SEGMENT_COLORS.length);
  const rest = entries.filter((entry) => !major.includes(entry));
  const segments = [
    ...major.map(([name, bytes], index) => ({ name, bytes, color: SEGMENT_COLORS[index], count: 0 })),
    ...(rest.length ? [{ name: 'others', bytes: rest.reduce((sum, [, bytes]) => sum + bytes, 0), color: 'bg-slate-300', count: rest.length }] : []),
  ];
  const barRef = useRef<HTMLDivElement>(null);
  useBarWipe(barRef, segments.map((segment) => segment.bytes).join(','));
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-slate-900">{title}</h3>
      <div ref={barRef} role="img" aria-label={`${title}: ${segments.map((segment) => `${segment.name} ${share(segment.bytes).toFixed(1)}%`).join(', ')}`} className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-slate-100">
        {segments.map((segment) => <span key={segment.name} className={segment.color} style={{ width: `${share(segment.bytes)}%` }} />)}
      </div>
      <ul className="mt-3 divide-y divide-slate-100 text-sm">
        {segments.map((segment) => (
          <li key={segment.name} className="flex items-center gap-2 py-1.5">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${segment.color}`} />
            <span className="min-w-0 flex-1 truncate text-slate-700">{segment.name}{segment.count > 0 && <span className="text-slate-500"> ({segment.count})</span>}</span>
            <span className="tabular-nums text-slate-900">{size(segment.bytes)}</span>
            <span className="w-12 text-right tabular-nums text-slate-500">{share(segment.bytes).toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

const PolicyFields = ({ policy, columns }: { policy: StoragePolicyController; columns: string }) => {
  const draft = policy.draft;
  if (!draft) return null;
  return (
    <div className={`grid grid-cols-1 gap-4 ${columns}`}>
      <FormField label={tr("Budget (GB)")} error={policy.errors.budget} hint={tr("A target chosen by the administrator, not the disk capacity.")}>
        <Input type="number" min="0" step="any" value={draft.budget} placeholder={tr("Not configured")} error={Boolean(policy.errors.budget)} onChange={(event) => policy.setDraft({ ...draft, budget: event.target.value })} />
      </FormField>
      <FormField label={tr("Warning threshold (%)")} error={policy.errors.threshold} hint={tr("Administrators are notified when a measurement reaches it.")}>
        <Input type="number" min="1" max="100" step="1" value={draft.threshold} error={Boolean(policy.errors.threshold)} onChange={(event) => policy.setDraft({ ...draft, threshold: event.target.value })} />
      </FormField>
    </div>
  );
};

const Block = ({ className }: { className: string }) => <div className={`animate-pulse rounded-xl bg-slate-100 ${className}`} />;


const SparkLine = ({ series }: { series: number[] }) => {
  const step = Math.max(1, Math.ceil(series.length / 30));
  const sampled = series.filter((_, i) => i % step === 0 || i === series.length - 1);
  const min = Math.min(...sampled);
  const max = Math.max(...sampled);
  const points = sampled.map((value, i) => `${(i / Math.max(sampled.length - 1, 1)) * 84},${18 - ((value - min) / (max - min || 1)) * 16}`).join(' ');
  return (
    <svg viewBox="0 0 84 20" className="h-5 w-[84px] text-emerald-600" aria-hidden="true">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
};

/** What grew in the period: the parts (storage domains or file types) that got bigger, biggest first, with how much and a small line of how it went. */
const GrowthPanel = ({ snapshots }: { snapshots: UsageSnapshot[] }) => {
  const [part, setPart] = useState<'byDomain' | 'byFileType'>('byDomain');
  const { rows, unchanged } = growthByPart(snapshots, part);
  const total = rows.reduce((sum, row) => sum + row.delta, 0);
  const oldest = snapshots[snapshots.length - 1];
  const newest = snapshots[0];
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 md:px-5">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{tr("What grew")}</h3>
          <p className="text-xs text-slate-500">{formatDate(oldest.measuredAt)} → {formatDate(newest.measuredAt)} · {signedSize(total)}</p>
        </div>
        <TabNav tabs={PARTS} activeTab={part} onChange={(id) => setPart(id as 'byDomain' | 'byFileType')} variant="pill" ariaLabel={__ariaTr("Group the growth by")} className="!w-auto" />
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-500 md:px-5">{tr("Nothing grew in this period.")}</p>
      ) : (
        <ul className="divide-y divide-slate-100 px-4 md:px-5">
          {rows.map((row) => (
            <li key={row.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 py-2.5 sm:grid-cols-[minmax(0,160px)_minmax(0,1fr)_96px_84px]">
              <span className="truncate text-sm text-slate-800">{row.name}</span>
              <div className="hidden h-1.5 overflow-hidden rounded-full bg-slate-100 sm:block"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${(row.delta / rows[0].delta) * 100}%` }} /></div>
              <span className="text-right text-sm font-semibold tabular-nums text-slate-900">{signedSize(row.delta)}</span>
              <span className="hidden sm:block"><SparkLine series={row.series} /></span>
            </li>
          ))}
        </ul>
      )}
      {unchanged > 0 && <p className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500 md:px-5">{trFormat("{count} with no growth in this period.", { count: unchanged })}</p>}
    </section>
  );
};

/** One row for each day: the size at the last measurement of the day and the change since the day before. */
const MeasurementsTable = ({ snapshots }: { snapshots: UsageSnapshot[] }) => {
  const days = dailySeries(snapshots);
  return (
    <div className="max-h-60 overflow-auto rounded-lg border border-slate-200">
      <TableMarkup.Root className="w-full text-left">
        <TableMarkup.Head className="sticky top-0 bg-slate-50">
          <TableMarkup.Row>
            <TableMarkup.HeaderCell scope="col" className="px-4 py-3 text-2xs font-semibold uppercase tracking-wide text-slate-500 md:text-xs">{tr("Measured")}</TableMarkup.HeaderCell>
            <TableMarkup.HeaderCell scope="col" className="px-4 py-3 text-right text-2xs font-semibold uppercase tracking-wide text-slate-500 md:text-xs">{tr("Size")}</TableMarkup.HeaderCell>
            <TableMarkup.HeaderCell scope="col" className="px-4 py-3 text-right text-2xs font-semibold uppercase tracking-wide text-slate-500 md:text-xs">{tr("Change")}</TableMarkup.HeaderCell>
          </TableMarkup.Row>
        </TableMarkup.Head>
        <TableMarkup.Body className="divide-y divide-slate-100">
          {days.map((snapshot, i) => (
            <TableMarkup.Row key={snapshot.measuredAt}>
              <TableMarkup.Cell className="px-4 py-3 text-sm text-slate-800">{formatDate(snapshot.measuredAt)}</TableMarkup.Cell>
              <TableMarkup.Cell className="px-4 py-3 text-right text-sm tabular-nums text-slate-900">{size(snapshot.totalBytes)}</TableMarkup.Cell>
              <TableMarkup.Cell className="px-4 py-3 text-right text-sm tabular-nums text-slate-500">{i + 1 < days.length ? signedSize(snapshot.totalBytes - days[i + 1].totalBytes) : '—'}</TableMarkup.Cell>
            </TableMarkup.Row>
          ))}
        </TableMarkup.Body>
      </TableMarkup.Root>
    </div>
  );
};

const downloadCsv = (snapshots: UsageSnapshot[]) => {
  const url = URL.createObjectURL(new Blob([measurementsToCsv(snapshots)], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'storage-usage-measurements.csv';
  link.click();
  URL.revokeObjectURL(url);
};

export function StorageUsagePanel({ policy }: { policy: StoragePolicyController }) {
  const [snapshots, setSnapshots] = useState<UsageSnapshot[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [range, setRange] = useState('90');
  const [view, setView] = useState('chart');
  useEffect(() => {
    let active = true;
    setFailed(false);
    api.get<UsageSnapshot[]>('/settings/storage-usage')
      .then((response) => { if (active) setSnapshots(response.data); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [attempt]);

  const status = policy.status;
  const budgetBytes = policy.effective?.budgetBytes ?? null;
  const warningPercent = policy.effective?.warningPercent ?? 80;
  // Everything on the screen that is worked out from the history (the growth, the estimate, the jumps, what grew) follows the period that is chosen.
  const period = useMemo(() => (snapshots ? withinDays(snapshots, Number(range)) : []), [snapshots, range]);
  const latest = snapshots?.[0];
  const usedPercent = latest && budgetBytes ? (latest.totalBytes / budgetBytes) * 100 : null;
  const overWarning = usedPercent !== null && usedPercent >= warningPercent;
  const growth = growthOf(period);
  const daysLeft = growth && budgetBytes && latest && growth.perDay > 0 && latest.totalBytes < budgetBytes ? Math.floor((budgetBytes - latest.totalBytes) / growth.perDay) : null;
  const forecast = forecastOf(latest, growth?.perDay ?? null, budgetBytes);
  const jumps = useMemo(() => jumpsOf(dailySeries(period)), [period]);
  // The chart follows the budget while it is typed, a moment after the last key, so it is not drawn again for every digit. When nothing is being typed (the first load, just
  // after a save) it follows at once, so it is not drawn first without the budget lines and then again with them.
  const deferredPolicy = useDeferredValue(policy.effective);
  const previewPolicy = policy.isDirty ? deferredPolicy : policy.effective;
  const previewForecast = forecastOf(latest, growth?.perDay ?? null, previewPolicy?.budgetBytes ?? null);
  const history = useMemo(
    () => (period.length > 1 ? historyConfiguration(period, previewPolicy, previewForecast, jumps) : null),
    // the forecast is a new object on every render: what it says is what matters
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [period, previewPolicy, previewForecast?.reachesAt, jumps],
  );

  if (failed || policy.failed) {
    return (
      <div className="grid place-items-center gap-3 py-16 text-center">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-red-50 text-red-600"><IconAlertCircle className="h-5 w-5" /></span>
        <div>
          <p role="alert" className="text-sm font-medium text-slate-900">{tr("Unable to load storage measurements.")}</p>
          <p className="mt-1 text-sm text-slate-500">{tr("Check the connection and try again.")}</p>
        </div>
        <Button type="button" size="sm" variant="outline-emerald" onClick={() => { setAttempt((value) => value + 1); policy.retry(); }}>{tr("Try again")}</Button>
      </div>
    );
  }
  if (!snapshots || !policy.draft) {
    return (
      <div className="space-y-4 md:space-y-6" aria-busy="true" aria-label={tr("Loading storage measurements")}>
        <div className="grid gap-4 md:gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"><Block className="h-80" /><Block className="h-64" /></div>
        <Block className="h-56" />
      </div>
    );
  }

  const notices = (
    <>
      {status?.scanState?.lastResult === 'FAILED' && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{tr("The latest scan failed. Values below are from the last successful scan and may be out of date.")}</p>}
      {status?.scanState?.stale && status.scanState.lastResult !== 'FAILED' && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{tr("No recent successful scan is available. Displayed values may be out of date.")}</p>}
      {status?.warning === true && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{tr("The last successful measurement reached the configured warning threshold. Check its timestamp below.")}</p>}
    </>
  );

  if (!latest) {
    return (
      <div className="space-y-4 md:space-y-6">
        {notices}
        <section className="rounded-xl border border-slate-200 bg-white p-4 md:p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">{tr("Storage policy")}</h3>
          <PolicyFields policy={policy} columns="md:grid-cols-2" />
        </section>
        <div className="grid place-items-center gap-2 rounded-xl border border-dashed border-slate-200 py-14 text-center">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-500"><IconDatabase className="h-5 w-5" /></span>
          <p className="text-sm font-medium text-slate-900">{tr("No successful measurement is available yet")}</p>
          <p className="max-w-sm text-sm text-slate-500">{tr("The first measurement of the MinIO buckets appears here once the scheduled scan has run.")}</p>
        </div>
      </div>
    );
  }

  const warningSentAt = status?.scanState?.warningSentAt ?? null;
  const warningRecipients = status?.scanState?.warningRecipients ?? null;

  return (
    <div className="space-y-4 md:space-y-6">
      {notices}
      <div className="grid gap-4 md:gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-end justify-between gap-3 px-4 pt-4 md:px-5 md:pt-5">
            <div>
              <p className="text-xs text-slate-500">{tr("Object-version size · MinIO buckets; local and NAS files are not included")}</p>
              <p className="mt-0.5 text-3xl font-semibold leading-none text-slate-900">{size(latest.totalBytes)}</p>
            </div>
            {growth && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                <IconTrendingUp className="h-3.5 w-3.5" />{trFormat("{size} in {days} days", { size: signedSize(growth.delta), days: Math.round(growth.days) })}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 px-4 pt-4 md:px-5">
            <TabNav tabs={RANGES} activeTab={range} onChange={setRange} variant="pill" ariaLabel={__ariaTr("Period")} className="!w-auto" />
            <TabNav tabs={VIEWS} activeTab={view} onChange={setView} variant="pill" ariaLabel={__ariaTr("View")} className="!w-auto" />
            <Button type="button" variant="outline-emerald" size="sm" className="gap-1.5" onClick={() => downloadCsv(period)}>
              <IconDownload className="h-4 w-4" />
              CSV
            </Button>
          </div>
          <div className="px-4 pt-3 md:px-5">
            {view === 'table' ? (
              <MeasurementsTable snapshots={period} />
            ) : history ? (
              <div className="h-60 w-full"><ChartCanvas config={history} ariaLabel={__ariaTr("Object-version size over the chosen period")} /></div>
            ) : (
              <p className="py-10 text-center text-sm text-slate-500">{tr("The history appears after a second measurement in this period.")}</p>
            )}
          </div>
          <div className="mt-3 grid grid-cols-1 divide-y divide-slate-100 border-t border-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div className="px-4 py-3 md:px-5"><p className="text-xs text-slate-500">{tr("Object versions")}</p><p className="font-semibold text-slate-900">{latest.objectVersions.toLocaleString()}</p></div>
            <div className="px-4 py-3 md:px-5"><p className="text-xs text-slate-500">{tr("Growth a day")}</p><p className="font-semibold text-slate-900">{growth ? signedSize(growth.perDay) : '—'}</p></div>
            <div className="px-4 py-3 md:px-5"><p className="text-xs text-slate-500">{tr("Last measurement")}</p><p className="font-semibold text-slate-900">{formatDateTime(latest.measuredAt)}</p></div>
          </div>
        </section>

        <section className="self-start rounded-xl border border-slate-200 bg-white p-4 md:p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">{tr("Storage policy")}</h3>
          <PolicyFields policy={policy} columns="md:grid-cols-1" />
          <div className="mt-4 border-t border-slate-100 pt-4">
            {usedPercent === null || !budgetBytes ? (
              <p className="text-sm text-slate-500">{tr("No budget set. Enter one to draw it on the chart and see the days left.")}</p>
            ) : (
              <>
                <div className="mb-3">
                  <Badge semantic={overWarning ? 'warning' : 'success'}>{overWarning ? 'Over the warning level' : 'Within budget'}</Badge>
                  <p className="mt-1.5 text-xs text-slate-500">
                    {warningSentAt
                      ? `Last warning sent ${formatDateTime(warningSentAt)}${warningRecipients != null ? ` to ${warningRecipients} ${warningRecipients === 1 ? 'administrator' : 'administrators'}` : ''}.`
                      : 'No warning is recorded.'}
                  </p>
                </div>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-slate-600">{trFormat("Used of the budget ({size})", { size: size(budgetBytes) })}</span>
                  <span className={`font-semibold ${overWarning ? 'text-amber-700' : 'text-slate-900'}`}>{usedPercent.toFixed(1)}%</span>
                </div>
                <div role="progressbar" aria-label={tr("Storage used of the budget")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(usedPercent))} className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                  <BarFill className={`h-full rounded-full ${overWarning ? 'bg-amber-500' : 'bg-emerald-500'}`} percent={Math.min(100, usedPercent)} />
                  <div className="absolute inset-y-0 w-0.5 bg-slate-500" style={{ left: `${warningPercent}%` }} title={`Warning at ${warningPercent}%`} />
                </div>
                {daysLeft !== null && <p className="mt-2 text-sm text-slate-700">{tr("About")} <strong>{daysLeft.toLocaleString()} {tr("days")}</strong> {tr("left at this rate")}{forecast ? trFormat(" (around {date}, an estimate)", { date: formatDate(new Date(forecast.reachesAt)) }) : ""}.</p>}
              </>
            )}
          </div>
        </section>
      </div>

      {period.length > 1 && <GrowthPanel snapshots={period} />}

      <section className="rounded-xl border border-slate-200 bg-white p-4 md:p-5">
        <div className="grid gap-6 md:grid-cols-2 md:gap-8">
          <Composition title={tr("By storage domain")} values={latest.byDomain} total={latest.totalBytes} />
          <Composition title={tr("By file type")} values={latest.byFileType} total={latest.totalBytes} />
        </div>
      </section>
    </div>
  );
}
