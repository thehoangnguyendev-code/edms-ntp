import { useEffect, useState } from 'react';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { FormSection } from '@/components/ui/form/FormSection';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { api } from '@/services/api/client';
import { Button } from '@/components/ui/button/Button';
import { useToast } from '@/components/ui/toast/Toast';

type Snapshot = {
  measuredAt: string;
  totalBytes: number;
  objectVersions: number;
  byDomain: Record<string, number>;
  byFileType: Record<string, number>;
};
type Status = { policy: { budgetBytes: number | null; warningPercent: number }; warning: boolean | null; scanState: { lastResult: string | null; lastAttemptAt: string | null; lastSuccessAt: string | null; stale: boolean } | null };

const GIB = 1024 ** 3;
const size = (bytes: number) => {
  const unit = bytes >= GIB ? 'GiB' : bytes >= 1024 ** 2 ? 'MiB' : bytes >= 1024 ? 'KiB' : 'B';
  const divisor = unit === 'GiB' ? GIB : unit === 'MiB' ? 1024 ** 2 : unit === 'KiB' ? 1024 : 1;
  return `${(bytes / divisor).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${unit}`;
};
const signedSize = (bytes: number) => `${bytes < 0 ? '−' : '+'}${size(Math.abs(bytes))}`;

/** The growth between the oldest and the newest measurement of the history (newest first), from real measurements only; nothing is estimated without at least a day between two of them. */
export const growthOf = (snapshots: Snapshot[]) => {
  if (snapshots.length < 2) return null;
  const newest = snapshots[0], oldest = snapshots[snapshots.length - 1];
  const days = (new Date(newest.measuredAt).getTime() - new Date(oldest.measuredAt).getTime()) / 86400000;
  if (!(days >= 1)) return null;
  const delta = newest.totalBytes - oldest.totalBytes;
  return { days, delta, perDay: delta / days };
};

const Bars = ({ title, values, total }: { title: string; values: Record<string, number>; total: number }) => (
  <div>
    <h4 className="mb-2 text-sm font-semibold text-slate-700">{title}</h4>
    <ul className="space-y-2">
      {Object.entries(values).sort((a, b) => b[1] - a[1]).map(([name, bytes]) => {
        const share = total > 0 ? (bytes / total) * 100 : 0;
        return (
          <li key={name}>
            <div className="flex justify-between gap-3 text-sm"><span className="break-all text-slate-600">{name}</span><span className="shrink-0 text-slate-900">{size(bytes)} <span className="text-slate-400">({share.toFixed(1)}%)</span></span></div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, share)}%` }} /></div>
          </li>
        );
      })}
    </ul>
  </div>
);

export function StorageUsagePanel() {
  const [snapshots, setSnapshots] = useState<Snapshot[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [budget, setBudget] = useState('');
  const [threshold, setThreshold] = useState('80');
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();
  useEffect(() => {
    let active = true;
    Promise.all([api.get<Snapshot[]>('/settings/storage-usage'), api.get<Status>('/settings/storage-usage/status')])
      .then(([response, current]) => { if (active) {
        setSnapshots(response.data); setStatus(current.data);
        setBudget(current.data.policy.budgetBytes == null ? '' : String(Number((current.data.policy.budgetBytes / GIB).toFixed(4))));
        setThreshold(String(current.data.policy.warningPercent));
      } })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);
  const save = async () => {
    const gib = budget.trim() === '' ? null : Number(budget);
    const bytes = gib === null ? null : Math.round(gib * GIB);
    const percent = Number(threshold);
    if ((bytes !== null && (!Number.isFinite(gib) || !Number.isSafeInteger(bytes) || bytes <= 0)) || !Number.isInteger(percent) || percent < 1 || percent > 100) {
      showToast({ type: 'error', title: 'Invalid Storage Budget', message: 'Enter a budget in GiB greater than 0 (or leave it empty) and a threshold from 1 to 100.' });
      return;
    }
    setSaving(true);
    try {
      await api.put('/settings/storage-usage/policy', { budgetBytes: bytes, warningPercent: percent });
      const response = await api.get<Status>('/settings/storage-usage/status');
      setStatus(response.data);
      showToast({ type: 'success', title: 'Storage Policy Saved', message: 'The storage warning threshold was updated.' });
    } catch { showToast({ type: 'error', title: 'Unable to Save Storage Policy', message: 'Please try again.' }); }
    finally { setSaving(false); }
  };
  const latest = snapshots?.[0];
  const budgetBytes = status?.policy.budgetBytes ?? null;
  const usedPercent = latest && budgetBytes ? (latest.totalBytes / budgetBytes) * 100 : null;
  const growth = snapshots ? growthOf(snapshots) : null;
  const daysLeft = growth && budgetBytes && latest && growth.perDay > 0 && latest.totalBytes < budgetBytes ? Math.floor((budgetBytes - latest.totalBytes) / growth.perDay) : null;
  return <FormSection title="MinIO Storage Usage" description="Object versions in the configured buckets; local and NAS files are not included.">
    {failed ? <p role="alert" className="text-sm text-red-600">Unable to load storage measurements.</p>
      : !snapshots ? <p className="text-sm text-slate-500">Loading storage measurements…</p>
      : <div className="space-y-5">
        <p className="text-sm text-slate-500">Set an optional budget for these buckets. It is a target chosen by the administrator, not the physical capacity of the server's disk. When a measurement reaches the threshold, the administrators receive a notification in the application.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-slate-700">Budget (GiB)<input type="number" min="0" step="any" value={budget} onChange={e => setBudget(e.target.value)} placeholder="Not configured" className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3" /></label>
          <label className="text-sm text-slate-700">Warning threshold (%)<input type="number" min="1" max="100" step="1" value={threshold} onChange={e => setThreshold(e.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3" /></label>
        </div>
        <Button size="sm" loading={saving} onClick={() => void save()}>Save Storage Policy</Button>
        {status?.scanState?.lastResult === 'FAILED' && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">The latest scan failed. Values below are from the last successful scan and may be out of date.</p>}
        {status?.scanState?.stale && status.scanState.lastResult !== 'FAILED' && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">No recent successful scan is available. Displayed values may be out of date.</p>}
        {status?.warning === true && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">The last successful measurement reached the configured warning threshold. Check its timestamp below.</p>}
        {!latest ? <p className="text-sm text-slate-500">No successful measurement is available yet.</p> : <>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><p className="text-sm text-slate-500">Object-version size</p><p className="font-semibold text-slate-900">{size(latest.totalBytes)}</p></div>
          <div><p className="text-sm text-slate-500">Object versions</p><p className="font-semibold text-slate-900">{latest.objectVersions.toLocaleString()}</p></div>
          <div><p className="text-sm text-slate-500">Last successful measurement</p><p className="font-semibold text-slate-900">{new Date(latest.measuredAt).toLocaleString()}</p></div>
        </div>
        {usedPercent !== null && budgetBytes && (
          <div>
            <div className="flex justify-between text-sm"><span className="text-slate-600">Used of the budget ({size(budgetBytes)})</span><span className="font-semibold text-slate-900">{usedPercent.toFixed(1)}%</span></div>
            <div role="progressbar" aria-label="Storage used of the budget" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(usedPercent))} className="relative mt-1 h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full ${status?.warning ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, usedPercent)}%` }} />
              <div className="absolute inset-y-0 w-0.5 bg-slate-500" style={{ left: `${status?.policy.warningPercent ?? 80}%` }} title={`Warning at ${status?.policy.warningPercent}%`} />
            </div>
          </div>
        )}
        {growth && (
          <p className="text-sm text-slate-700">
            Growth over the last {Math.round(growth.days)} days: <strong>{signedSize(growth.delta)}</strong> ({signedSize(growth.perDay)} a day on average).
            {daysLeft !== null && <> At this rate the budget is reached in about <strong>{daysLeft.toLocaleString()} days</strong>.</>}
          </p>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <Bars title="By storage domain" values={latest.byDomain} total={latest.totalBytes} />
          <Bars title="By file type" values={latest.byFileType} total={latest.totalBytes} />
        </div>
        {snapshots.length > 1 && <div><h4 className="mb-2 text-sm font-semibold text-slate-700">Last 90 days</h4>
          <ChartContainer config={{ totalBytes: { label: 'Object-version size', color: '#059669' } }} className="h-52 w-full">
            <LineChart data={[...snapshots].reverse()}><CartesianGrid vertical={false} /><XAxis dataKey="measuredAt" tickFormatter={v => new Date(v).toLocaleDateString()} minTickGap={40} /><YAxis tickFormatter={size} width={70} /><ChartTooltip content={<ChartTooltipContent />} /><Line type="monotone" dataKey="totalBytes" stroke="var(--color-totalBytes)" dot={false} /></LineChart>
          </ChartContainer>
        </div>}</>}
      </div>}
  </FormSection>;
}
