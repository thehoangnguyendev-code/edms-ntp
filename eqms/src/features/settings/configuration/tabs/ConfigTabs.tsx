import React from 'react';
import { IconHistory } from '@tabler/icons-react';
import { Button } from '@/components/ui/button/Button';
import { TabNav, type TabItem } from '@/components/ui/tabs';

/** The last tab of every page that is split into tabs: the Audit Trail of that page of Configuration. */
export const HISTORY_TAB = { id: 'history', label: 'History', icon: IconHistory } as const;

interface ConfigTabsProps<T extends string> {
  tabs: ReadonlyArray<TabItem & { id: T }>;
  activeTab: T;
  onChange: (tab: T) => void;
  /** Tabs that hold a change that is not saved yet; they get a dot. */
  changed?: ReadonlySet<T>;
  /** Tabs with something wrong that blocks saving; they get a red dot. */
  invalid?: ReadonlySet<T>;
  /** Puts the open tab back to what was last saved, without touching the other tabs. When given, a tab with a change offers it. */
  onReset?: (tab: T) => void;
  ariaLabel: string;
  /** Makes the ids of the tabs and panels unique when two pages are ever open together. */
  idPrefix: string;
  children: React.ReactNode;
}

/**
 * The tab bar of a Configuration page and the panel under it. The page keeps one draft and one Save button; the tabs only choose which part of
 * the draft is on the screen, so changing tab never loses an edit.
 */
export function ConfigTabs<T extends string>({ tabs, activeTab, onChange, changed, invalid, onReset, ariaLabel, idPrefix, children }: ConfigTabsProps<T>) {
  const items = React.useMemo(
    () =>
      tabs.map((tab) =>
        invalid?.has(tab.id)
          ? { ...tab, dot: true, dotLabel: 'Needs correction', dotTone: 'danger' as const }
          : changed?.has(tab.id)
            ? { ...tab, dot: true, dotLabel: 'Not saved yet' }
            : tab,
      ),
    [tabs, changed, invalid],
  );
  const canReset = Boolean(onReset && changed?.has(activeTab));
  return (
    <div>
      <TabNav
        tabs={items}
        activeTab={activeTab}
        onChange={(id) => onChange(id as T)}
        ariaLabel={ariaLabel}
        tabIdPrefix={`${idPrefix}-tab`}
        panelIdPrefix={`${idPrefix}-panel`}
      />
      <div role="tabpanel" id={`${idPrefix}-panel-${activeTab}`} aria-labelledby={`${idPrefix}-tab-${activeTab}`} className="p-4 md:p-5">
        {canReset && (
          <div role="status" className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 sm:text-sm">
            <span>This tab has changes that are not saved yet.</span>
            <Button type="button" size="sm" variant="ghost" onClick={() => onReset?.(activeTab)} className="text-amber-900 hover:bg-amber-100">
              Discard changes in this tab
            </Button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/** The tab named in the address, or the first tab when there is none or it is not one of the tabs. */
export function tabFromParam<T extends string>(ids: ReadonlyArray<T>, value: string | null | undefined): T {
  return (ids as ReadonlyArray<string>).includes(value ?? '') ? (value as T) : ids[0];
}

/** The tabs that hold a change that is not saved yet, found by comparing the draft with what was last saved, field by field. */
export function changedTabs<T extends string>(
  draft: object | undefined | null,
  saved: object | undefined | null,
  fields: Record<T, ReadonlyArray<string>>,
): Set<T> {
  const changed = new Set<T>();
  if (!draft || !saved) return changed;
  const d = draft as Record<string, unknown>;
  const s = saved as Record<string, unknown>;
  const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  (Object.keys(fields) as T[]).forEach((id) => {
    if (fields[id].some((key) => !same(d[key], s[key]))) changed.add(id);
  });
  return changed;
}

/** The draft with the named fields put back to their saved values (a field the saved copy does not have is removed). */
export function revertFields<C extends object>(draft: C, saved: C | null | undefined, fields: ReadonlyArray<string>): C {
  if (!saved) return draft;
  const next = { ...(draft as Record<string, unknown>) };
  const source = saved as Record<string, unknown>;
  fields.forEach((key) => {
    if (key in source) next[key] = JSON.parse(JSON.stringify(source[key]));
    else delete next[key];
  });
  return next as C;
}
