import { formatDateTime } from '@/utils/format';
import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button/Button';
import { SearchInput } from '@/components/ui/form/SearchInput';
import { TabNav, type TabItem } from '@/components/ui/tabs/TabNav';
import { cn } from '@/components/ui/utils';
import {
  ChosenIcon,
  iconKey,
  parseIconKey,
  useIconLibraries,
  useIconSetStatus,
  type IconComponent,
  type IconLibrary,
} from '@/features/notifications/notificationIcons';
import { TablePagination } from '@/components/ui/table/TablePagination';
import { tr, trFormat } from "@/i18n";

const LIBRARIES: TabItem[] = [
  { id: 'lucide', label: 'Lucide' },
  { id: 'tabler', label: 'Tabler' },
];

const PER_PAGE_OPTIONS = [24, 48, 96];

/**
 * Chooses the icon of an in-app notification from the Lucide or the Tabler library (search by name). The choice is only made here; Publish saves it.
 * "Use default" goes back to the icon of the kind of notification. The colour of the icon is not chosen: it follows the priority of the notification.
 */
export const NotificationIconPicker: React.FC<{
  icon: string | null;
  /** The icon of the kind of notification, shown when none is chosen. */
  fallback: IconComponent;
  onChange: (icon: string | null) => void;
  disabled?: boolean;
}> = ({ icon, fallback, onChange, disabled }) => {
  const libraries = useIconLibraries();
  // the two sets are kept up to date while the picker is open
  const sets = useIconSetStatus(!disabled);
  const chosen = parseIconKey(icon);
  const [library, setLibrary] = useState<IconLibrary>(chosen?.library ?? 'lucide');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(48);

  const names = useMemo(() => {
    if (!libraries) return [];
    const needle = search.trim().toLowerCase();
    return Object.keys(libraries[library])
      .filter((name) => !needle || name.toLowerCase().includes(needle))
      .sort((a, b) => a.localeCompare(b));
  }, [libraries, library, search]);

  const totalPages = Math.max(1, Math.ceil(names.length / perPage));
  const current = Math.min(page, totalPages);

  return (
    <div className="space-y-4">
      {!disabled ? (
        <div className="space-y-3">
          {/* the search first, with the library; the icons under it */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1); }} ariaLabel={tr("Search icons")} placeholder={tr("Search an icon by name, for example bell, shield, clock…")} />
            </div>
            <div className="sm:w-56 sm:shrink-0">
              <TabNav tabs={LIBRARIES} activeTab={library} onChange={(id) => { setLibrary(id as IconLibrary); setPage(1); }} variant="pill" ariaLabel={tr("Icon library")} layoutId="notification-icon-library" />
            </div>
          </div>
          <p className="-mt-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-500" role="status" aria-label={tr("State of the icon sets")}>
            {sets.state === 'unavailable' ? (
              <span className="text-amber-700">{tr("The newest icons could not be loaded: the icons built into the application are shown.")}</span>
            ) : sets.state === 'current' ? (
              <span>
                {tr("Up to date with the newest Lucide and Tabler")}{sets.checkedAt ? trFormat(" (checked {date})", { date: formatDateTime(sets.checkedAt.toISOString()) }) : ''}
                {sets.added.lucide + sets.added.tabler > 0 ? trFormat(": {count} icons newer than the application", { count: sets.added.lucide + sets.added.tabler }) : ''}.
              </span>
            ) : (
              <span>{tr("Checking for the newest icons…")}</span>
            )}
            <button type="button" className="font-medium text-emerald-700 hover:underline disabled:opacity-50" disabled={sets.state === 'checking'} onClick={sets.refresh}>
              {tr("Check now")}
            </button>
          </p>
          {!libraries ? (
            <p className="py-6 text-sm text-slate-500">{tr("Loading the icons…")}</p>
          ) : names.length === 0 ? (
              <p className="py-6 text-sm text-slate-500">{trFormat("No icon matches “{query}”.", { query: search.trim() })}</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="grid grid-cols-5 gap-2 p-3 sm:grid-cols-8 md:grid-cols-10 xl:grid-cols-12" role="listbox" aria-label={tr("Icons")}>
                {names.slice((current - 1) * perPage, current * perPage).map((name) => {
                  const key = iconKey(library, name);
                  const selected = icon === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      aria-label={name}
                      title={name}
                      onClick={() => onChange(key)}
                      className={cn('flex h-11 items-center justify-center rounded-lg border text-slate-600 transition', selected ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50')}
                    >
                      <ChosenIcon icon={key} fallback={fallback} className="h-5 w-5" />
                    </button>
                  );
                })}
              </div>
              <TablePagination
                currentPage={current}
                totalPages={totalPages}
                totalItems={names.length}
                itemsPerPage={perPage}
                onPageChange={setPage}
                onItemsPerPageChange={setPerPage}
                itemsPerPageOptions={PER_PAGE_OPTIONS}
              />
            </div>
          )}
        </div>
      ) : null}

      {/* the way back to the default; the icon chosen is the one marked in the grid and drawn in the preview */}
      <Button size="sm" variant="outline-emerald" className="h-9" disabled={disabled || !icon} onClick={() => onChange(null)}>
        {tr("Use default")}
      </Button>
    </div>
  );
};
