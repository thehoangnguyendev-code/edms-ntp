import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '@/services/api/client';
import { Button } from '@/components/ui/button/Button';
import { Checkbox } from '@/components/ui/checkbox/Checkbox';
import { Select } from '@/components/ui/select/Select';
import { DraggableReorderList } from '@/components/ui/draggable-reorder-list/DraggableReorderList';
import { useToast } from '@/components/ui/toast/Toast';

type Item = { id: string; label: string; visible: boolean; width: 'half' | 'full' };
type Role = { id: string; name: string };
type RoleLayout = { roleId: string; priority: number; layout: { widgets: Omit<Item, 'label'>[] } };
const WIDGETS: Array<[string, string, 'half' | 'full']> = [
  ['user-kpis', 'User overview', 'full'], ['admin-kpis', 'Admin overview', 'full'], ['document-activity', 'Document activity', 'half'],
  ['workflow-pipeline', 'Workflow pipeline', 'half'], ['my-documents', 'My documents', 'half'], ['effective-by-type', 'Effective documents by type', 'half'],
  ['audit-activity', 'Audit activity', 'half'], ['revision-pipeline', 'Revision pipeline', 'half'], ['documents-by-status', 'Documents by status', 'half'],
  ['system-monitoring', 'System monitoring', 'full'], ['pending-work', 'Pending work', 'full'],
];
const initial = (): Item[] => WIDGETS.map(([id, label, width]) => ({ id, label, width, visible: true }));

export function DashboardRoleDefaults() {
  const [roles, setRoles] = useState<Role[]>([]), [saved, setSaved] = useState<RoleLayout[]>([]);
  const [selected, setSelected] = useState(''), [priority, setPriority] = useState(100), [items, setItems] = useState<Item[]>(initial);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();
  const load = async () => {
    try {
      const [options, layouts] = await Promise.all([api.get<Role[]>('/dashboard/layout/roles/options'), api.get<RoleLayout[]>('/dashboard/layout/roles')]);
      setRoles(options.data); setSaved(layouts.data);
    } catch { showToast({ type: 'error', title: 'Unable to load dashboard defaults', message: 'Please try again.' }); }
  };
  useEffect(() => { void load(); }, []);
  const select = (id: string) => {
    setSelected(id);
    const record = saved.find(row => row.roleId === id), lookup = new Map(initial().map(item => [item.id, item]));
    const ordered: Item[] = [];
    for (const widget of record?.layout.widgets ?? []) { const item = lookup.get(widget.id); if (item) { ordered.push({ ...item, visible: widget.visible, width: widget.width }); lookup.delete(widget.id); } }
    setItems([...ordered, ...lookup.values()]); setPriority(record?.priority ?? 100);
  };
  // the same move as dragging, for the keyboard and for touch screens
  const move = (index: number, delta: number) => setItems(rows => {
    const next = [...rows], target = index + delta;
    if (target < 0 || target >= next.length) return rows;
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });
  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await api.put(`/dashboard/layout/roles/${selected}`, { priority, layout: { widgets: items.map(({ id, visible, width }) => ({ id, visible, width })) } });
      await load(); showToast({ type: 'success', title: 'Dashboard defaults saved', message: 'The access profile defaults have been updated.' });
    } catch { showToast({ type: 'error', title: 'Unable to save dashboard defaults', message: 'Please try again.' }); }
    finally { setSaving(false); }
  };
  return <section className="space-y-3 border-t border-slate-100 pt-4">
    <p className="text-xs font-semibold uppercase text-slate-500">Dashboard defaults by access profile</p>
    <p className="text-xs text-slate-500">Lower priority numbers take precedence. Users can customize their own layout; widget access still follows their permissions.</p>
    <div className="grid gap-3 sm:grid-cols-2"><Select label="Access profile" value={selected} options={roles.map(role => ({ label: role.name, value: role.id }))} onChange={select} placeholder="Select access profile" />
      <label className="text-sm text-slate-700">Priority<input type="number" min={1} max={100000} value={priority} onChange={e => setPriority(Math.max(1, Math.min(100000, Number(e.target.value) || 1)))} className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 px-3" /></label></div>
    {selected && <><DraggableReorderList items={items} onReorder={setItems} renderRow={item => <div className="flex items-center gap-2" onPointerDown={e => e.stopPropagation()}><Button size="icon-sm" variant="ghost" aria-label={`Move ${item.label} up`} disabled={items[0]?.id === item.id} onClick={() => move(items.findIndex(row => row.id === item.id), -1)}><ChevronUp className="h-4 w-4" /></Button><Button size="icon-sm" variant="ghost" aria-label={`Move ${item.label} down`} disabled={items.at(-1)?.id === item.id} onClick={() => move(items.findIndex(row => row.id === item.id), 1)}><ChevronDown className="h-4 w-4" /></Button><Checkbox label="Show" checked={item.visible} onChange={visible => setItems(rows => rows.map(row => row.id === item.id ? { ...row, visible } : row))} /><Button variant="outline" size="sm" onClick={() => setItems(rows => rows.map(row => row.id === item.id ? { ...row, width: row.width === 'half' ? 'full' : 'half' } : row))}>{item.width === 'half' ? 'Half' : 'Full'}</Button></div>} /><Button size="sm" loading={saving} onClick={() => void save()}>Save Dashboard Defaults</Button></>}
  </section>;
}
