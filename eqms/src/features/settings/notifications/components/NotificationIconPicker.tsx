import { formatDateTime } from '@/utils/format';
import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button/Button';
import { ColorPickerInput } from '@/components/ui/color-picker/ColorPickerInput';
import { SearchInput } from '@/components/ui/form/SearchInput';
import { TabNav, type TabItem } from '@/components/ui/tabs/TabNav';
import { cn } from '@/components/ui/utils';
import {
  ChosenIcon,
  NOTIFICATION_TONES,
  findNotificationTone,
  iconKey,
  parseIconKey,
  useIconLibraries,
  useIconSetStatus,
  type IconComponent,
  type IconLibrary,
} from '@/features/notifications/notificationIcons';
import { TablePagination } from '@/components/ui/table/TablePagination';

const LIBRARIES: TabItem[] = [
  { id: 'lucide', label: 'Lucide' },
  { id: 'tabler', label: 'Tabler' },
];

const PER_PAGE_OPTIONS = [24, 48, 96];

/**
 * Chooses the icon of an in-app notification from the Lucide or the Tabler library (search by name) and the tone of its colour. The choice is only
 * made here; Publish saves it. "Default" goes back to the icon of the kind of notification.
 */
export const NotificationIconPicker: React.FC<{
  icon: string | null;
  tone: string | null;
  /** The icon of the kind of notification, shown when none is chosen. */
  fallback: IconComponent;
  /** The colours of the kind of notification, shown when no tone is chosen. */
  fallbackStyles: { bg: string; text: string };
  onChange: (icon: string | null, tone: string | null) => void;
  disabled?: boolean;
}> = ({ icon, tone, fallback, fallbackStyles, onChange, disabled }) => {
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

  // the colour as a six-digit colour for the colour picker: the one chosen, the one of a name of the first version, or the one of the kind of notification
  const HEX = /^#[0-9a-f]{6}$/i;
  const toneHex = tone && HEX.test(tone) ? tone : (findNotificationTone(tone) ?? NOTIFICATION_TONES.find((t) => t.text === fallbackStyles.text))?.hex ?? '#475569';
  const toneClasses = tone && HEX.test(tone) ? { bg: '', text: '' } : (findNotificationTone(tone) ?? fallbackStyles);
  const toneStyles = tone && HEX.test(tone) ? { tile: { backgroundColor: `${tone}1A` }, icon: { color: tone } } : { tile: undefined, icon: undefined };

  return (
    <div className="space-y-4">
      {!disabled ? (
        <div className="space-y-3">
          {/* the search first, with the library; the icons under it */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1); }} ariaLabel="Search icons" placeholder="Search an icon by name, for example bell, shield, clock…" />
            </div>
            <div className="sm:w-56 sm:shrink-0">
              <TabNav tabs={LIBRARIES} activeTab={library} onChange={(id) => { setLibrary(id as IconLibrary); setPage(1); }} variant="pill" ariaLabel="Icon library" layoutId="notification-icon-library" />
            </div>
          </div>
          <p className="-mt-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-500" role="status" aria-label="State of the icon sets">
            {sets.state === 'unavailable' ? (
              <span className="text-amber-700">The newest icons could not be loaded: the icons built into the application are shown.</span>
            ) : sets.state === 'current' ? (
              <span>
                Up to date with the newest Lucide and Tabler{sets.checkedAt ? ` (checked ${formatDateTime(sets.checkedAt.toISOString())})` : ''}
                {sets.added.lucide + sets.added.tabler > 0 ? `: ${sets.added.lucide + sets.added.tabler} icons newer than the application` : ''}.
              </span>
            ) : (
              <span>Checking for the newest icons…</span>
            )}
            <button type="button" className="font-medium text-emerald-700 hover:underline disabled:opacity-50" disabled={sets.state === 'checking'} onClick={sets.refresh}>
              Check now
            </button>
          </p>
          {!libraries ? (
            <p className="py-6 text-sm text-slate-500">Loading the icons…</p>
          ) : names.length === 0 ? (
            <p className="py-6 text-sm text-slate-500">No icon matches “{search.trim()}”.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="grid grid-cols-5 gap-2 p-3 sm:grid-cols-8 md:grid-cols-10 xl:grid-cols-12" role="listbox" aria-label="Icons">
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
                      onClick={() => onChange(key, tone)}
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

      {/* the colour (the colour picker) and the way back to the default; the icon chosen is the one marked in the grid and drawn in the preview */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-64 [&>div:first-child]:gap-1.5">
          <ColorPickerInput label="Colour" value={toneHex} disabled={disabled} onChange={(color) => onChange(icon, color)} />
        </div>
        <Button size="sm" variant="outline-emerald" className="h-9" disabled={disabled || !(icon || tone)} onClick={() => onChange(null, null)}>
          Use default
        </Button>
      </div>
    </div>
  );
};
