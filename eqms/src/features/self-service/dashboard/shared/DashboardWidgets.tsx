import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { SlidersHorizontal, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button/Button';
import { Checkbox } from '@/components/ui/checkbox/Checkbox';
import { Drawer } from '@/components/ui/drawer/Drawer';
import { DraggableReorderList } from '@/components/ui/draggable-reorder-list/DraggableReorderList';
import { useToast } from '@/components/ui/toast/Toast';
import { api } from '@/services/api/client';
import { DASHBOARD_LAYOUT_PREFERENCE, userUiPreferencesApi, type DashboardLayoutPreference } from '@/services/api/userUiPreferences';

type Widget = { id: string; label: string; width: 'half' | 'full'; content: ReactNode };
type Setting = { id: string; label: string; visible: boolean; width: 'half' | 'full' };

/** Only caller-provided, authorized widgets can be rendered; a stored ID cannot grant data access. */
export function DashboardWidgets({ widgets }: { widgets: Widget[] }) {
  const defaults = useMemo(() => widgets.map(({ id, label, width }) => ({ id, label, width, visible: true })), [widgets]);
  const [saved, setSaved] = useState<DashboardLayoutPreference['widgets']>();
  const [draft, setDraft] = useState<Setting[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();
  useEffect(() => {
    let active = true;
    userUiPreferencesApi.get<DashboardLayoutPreference>(DASHBOARD_LAYOUT_PREFERENCE).then(async value => {
      if (!Array.isArray(value.widgets)) {
        try { value = (await api.get<DashboardLayoutPreference>('/dashboard/layout/default')).data; }
        catch { /* The built-in layout remains available if role defaults are unavailable. */ }
      }
      if (active && Array.isArray(value.widgets)) setSaved(value.widgets);
    }).catch(() => { if (active) showToast({ type: 'error', title: 'Dashboard settings unavailable', message: 'The default layout is shown.' }); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const ordered = useMemo(() => {
    if (!saved) return defaults;
    const lookup = new Map(defaults.map(item => [item.id, item]));
    const result: Setting[] = [];
    for (const item of saved) {
      const original = lookup.get(item.id);
      if (original && typeof item.visible === 'boolean' && (item.width === 'half' || item.width === 'full')) {
        result.push({ ...original, visible: item.visible, width: item.width }); lookup.delete(item.id);
      }
    }
    return [...result, ...lookup.values()];
  }, [defaults, saved]);
  const update = (id: string, patch: Partial<Setting>) => setDraft(items => items.map(item => item.id === id ? { ...item, ...patch } : item));
  const move = (index: number, delta: number) => setDraft(items => {
    const next = [...items], target = index + delta;
    if (target < 0 || target >= next.length) return items;
    [next[index], next[target]] = [next[target], next[index]]; return next;
  });
  const save = async () => {
    setSaving(true);
    try {
      const unrelated = (saved ?? []).filter(item => !defaults.some(allowed => allowed.id === item.id));
      const next = [...draft.map(({ id, visible, width }) => ({ id, visible, width })), ...unrelated];
      await userUiPreferencesApi.save(DASHBOARD_LAYOUT_PREFERENCE, { widgets: next });
      setSaved(next); setOpen(false);
    } catch { showToast({ type: 'error', title: 'Unable to save dashboard', message: 'Please try again.' }); }
    finally { setSaving(false); }
  };
  const reset = async () => {
    setSaving(true);
    try {
      await api.delete(`/user-ui-preferences/${DASHBOARD_LAYOUT_PREFERENCE}`);
      const fallback = await api.get<DashboardLayoutPreference>('/dashboard/layout/default').catch(() => undefined);
      setSaved(Array.isArray(fallback?.data?.widgets) ? fallback.data.widgets : undefined); setOpen(false);
    }
    catch { showToast({ type: 'error', title: 'Unable to reset dashboard', message: 'Please try again.' }); }
    finally { setSaving(false); }
  };
  return <div className="space-y-4">
    <div className="flex justify-end"><Button variant="outline" size="sm" disabled={loading} className="gap-2" onClick={() => { setDraft(ordered.map(item => ({ ...item }))); setOpen(true); }}><SlidersHorizontal className="h-4 w-4" />Customize Dashboard</Button></div>
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{ordered.filter(item => item.visible).map(item => <div key={item.id} className={item.width === 'full' ? 'min-w-0 lg:col-span-2' : 'min-w-0'}>{widgets.find(widget => widget.id === item.id)?.content}</div>)}</div>
    {open && <Drawer title="Customize Dashboard" subtitle="Drag to reorder, choose visibility and width." subtitlePlacement="below" onClose={() => setOpen(false)} footer={<div className="flex flex-wrap justify-between gap-2"><Button variant="ghost" size="sm" disabled={saving} onClick={() => void reset()}>Reset</Button><div className="flex gap-2"><Button variant="outline" size="sm" disabled={saving} onClick={() => setOpen(false)}>Cancel</Button><Button size="sm" loading={saving} onClick={() => void save()}>Save</Button></div></div>}>
      <DraggableReorderList items={draft} onReorder={setDraft} renderRow={item => <div className="flex flex-wrap items-center gap-1" onPointerDown={event => event.stopPropagation()}>
        <Button size="icon-sm" variant="ghost" aria-label={`Move ${item.label} up`} disabled={draft[0]?.id === item.id} onClick={() => move(draft.findIndex(row => row.id === item.id), -1)}><ChevronUp className="h-4 w-4" /></Button>
        <Button size="icon-sm" variant="ghost" aria-label={`Move ${item.label} down`} disabled={draft.at(-1)?.id === item.id} onClick={() => move(draft.findIndex(row => row.id === item.id), 1)}><ChevronDown className="h-4 w-4" /></Button>
        <Checkbox label="Show" checked={item.visible} onChange={visible => update(item.id, { visible })} />
        <Button size="sm" variant="outline" aria-label={`Change width of ${item.label}`} onClick={() => update(item.id, { width: item.width === 'half' ? 'full' : 'half' })}>{item.width === 'half' ? 'Half' : 'Full'}</Button>
      </div>} />
    </Drawer>}
  </div>;
}
