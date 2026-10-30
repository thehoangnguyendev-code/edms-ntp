import React, { useState } from "react";
import { Lock, Pin, PinOff, SlidersHorizontal } from "lucide-react";
import { Drawer } from "@/components/ui/drawer/Drawer";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button/Button";
import { FilterSearchInput } from "@/components/ui/filter/FilterSearchInput";
import { DraggableReorderList } from "@/components/ui/draggable-reorder-list/DraggableReorderList";
import { cn } from "@/components/ui/utils";
import { MAX_PINNED_COLUMNS, normalizeColumnOrder, type CustomizableColumn } from "./useTableColumnPreferences";
import { IconLock, IconPin, IconPinnedOff } from "@tabler/icons-react";

interface CustomColumnDrawerProps {
  columns: CustomizableColumn[];
  onApply: (columns: CustomizableColumn[]) => void | Promise<void>;
  onReset: () => void | Promise<void>;
  disabled?: boolean;
  /** Columns the table always shows in a fixed position (for example Action). Listed locked, without a switch. */
  fixedColumns?: { id: string; label: string }[];
  /** Pinning needs a horizontally scrolling desktop table. Off on mobile, where the table scrolls natively. */
  allowPin?: boolean;
}

/** Pinned columns must stay a continuous block at the start of the movable list. */
function pinnedBlockIsContiguous(list: CustomizableColumn[]): boolean {
  const firstUnpinned = list.findIndex((column) => !(column.pinned && column.visible));
  if (firstUnpinned < 0) return true;
  return list.slice(firstUnpinned).every((column) => !(column.pinned && column.visible));
}

/**
 * Shared "Custom Column" control for every data table. Changes are made on a draft inside a drawer
 * and only saved for the signed-in user when Apply is pressed.
 *
 * Rules (enforced here and in normalizeColumnOrder):
 * - Locked columns (No.) and fixed columns (Action) cannot be hidden, pinned or dragged.
 * - Only a continuous run from the left can be pinned, right after the locked columns. A drag that
 *   would break that run is ignored.
 * - At most MAX_PINNED_COLUMNS columns can be pinned.
 * - A hidden column is never pinned.
 * - The last pinned column carries a divider line in the table.
 */
export const CustomColumnDrawer: React.FC<CustomColumnDrawerProps> = ({
  columns,
  onApply,
  onReset,
  disabled = false,
  fixedColumns = [],
  allowPin = true,
}) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CustomizableColumn[]>([]);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const openDrawer = () => {
    setDraft(normalizeColumnOrder(columns));
    setQuery("");
    setOpen(true);
  };

  const ordered = normalizeColumnOrder(draft);
  const movable = ordered.filter((column) => !column.locked);
  // The "Expand" toggle column of a table is part of its structure, not something a person arranges: it is never listed here (it stays in the table).
  const lockedColumns = ordered.filter((column) => column.locked && column.id !== "expand");
  const pinnedCount = movable.filter((column) => column.pinned && column.visible).length;
  const searching = query.trim().length > 0;
  const needle = query.trim().toLowerCase();
  const matches = (label: string) => label.toLowerCase().includes(needle);

  const update = (id: string, patch: Partial<CustomizableColumn>) =>
    setDraft((previous) =>
      previous.map((column) => {
        if (column.id !== id) return column;
        const next = { ...column, ...patch };
        if (next.visible === false) next.pinned = false;
        return next;
      }),
    );

  const togglePin = (column: CustomizableColumn) => {
    if (!column.pinned && pinnedCount >= MAX_PINNED_COLUMNS) return;
    update(column.id, { pinned: !column.pinned });
  };

  // Accepts the reordered movable list only if the pinned columns still form a block at its start.
  const reorder = (next: CustomizableColumn[]) => {
    if (searching || !pinnedBlockIsContiguous(next)) return;
    setDraft((previous) => {
      const lockedFirst = normalizeColumnOrder(previous).filter((column) => column.locked);
      const merged = [...lockedFirst, ...next].map((column, index) => ({ ...column, order: index }));
      return merged;
    });
  };

  const apply = async () => {
    // The drawer closes at once and the table changes under it, so the motion of the columns does not wait for the server to answer and is not played behind the drawer.
    // If the server refuses, the table returns to what it was and the screen says so.
    setOpen(false);
    setSaving(true);
    try {
      await onApply(normalizeColumnOrder(draft));
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setOpen(false);
    setSaving(true);
    try {
      await onReset();
    } finally {
      setSaving(false);
    }
  };

  const visibleMovable = movable.filter((column) => matches(column.label));
  const visibleLocked = lockedColumns.filter((column) => matches(column.label));
  const visibleFixed = fixedColumns.filter((column) => matches(column.label));
  const nothingMatches = visibleMovable.length === 0 && visibleLocked.length === 0 && visibleFixed.length === 0;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-haspopup="dialog"
        disabled={disabled || saving}
        onClick={openDrawer}
        className="gap-2 whitespace-nowrap"
      >
        <SlidersHorizontal className="h-4 w-4" />
        Custom Column
      </Button>

      {open && (
        <Drawer
          title="Custom Column"
          subtitlePlacement="below"
          subtitle={`Show, hide, pin and reorder columns. Pin up to ${MAX_PINNED_COLUMNS}, starting from the left.`}
          onClose={() => setOpen(false)}
          footer={
            <div className="flex items-center justify-between gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={reset} disabled={saving}>
                Reset to Default
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button type="button" size="sm" onClick={apply} disabled={saving}>
                  Apply
                </Button>
              </div>
            </div>
          }
        >
          <div className="mb-3">
            <FilterSearchInput
              aria-label="Search columns"
              placeholder="Search columns..."
              value={query}
              onChange={setQuery}
              debounceMs={0}
            />
          </div>

          <DraggableReorderList
            items={visibleMovable}
            onReorder={reorder}
            header={visibleLocked.map((column) => (
              <LockedRow key={column.id} label={column.label} />
            ))}
            footer={visibleFixed.map((column) => (
              <LockedRow key={column.id} label={column.label} />
            ))}
            renderRow={(column) => (
              <div className="flex items-center gap-2">
                {allowPin && <button
                  type="button"
                  aria-label={column.pinned ? `Unpin ${column.label}` : `Pin ${column.label}`}
                  aria-pressed={Boolean(column.pinned)}
                  disabled={!column.pinned && (!column.visible || pinnedCount >= MAX_PINNED_COLUMNS)}
                  title={
                    !column.pinned && pinnedCount >= MAX_PINNED_COLUMNS
                      ? `You can pin at most ${MAX_PINNED_COLUMNS} columns`
                      : !column.pinned && !column.visible
                        ? "Show the column before pinning it"
                        : undefined
                  }
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => togglePin(column)}
                  className={cn(
                    "rounded-md p-1 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40",
                    column.pinned ? "text-emerald-600" : "text-slate-400",
                  )}
                >
                  {column.pinned ? <IconPin className="h-4 w-4" /> : <IconPinnedOff className="h-4 w-4" />}
                </button>}
                <span onPointerDown={(event) => event.stopPropagation()}>
                  <Switch checked={column.visible} onChange={(checked) => update(column.id, { visible: checked })} />
                </span>
              </div>
            )}
            className={cn(searching && "opacity-90")}
          />

          {nothingMatches && (
            <p className="py-6 text-center text-sm text-slate-500">No columns match "{query.trim()}".</p>
          )}
        </Drawer>
      )}
    </>
  );
};

/** A row the user cannot change: it shows a lock and no switch. */
const LockedRow: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
    <IconLock aria-label="Fixed column" className="h-4 w-4 shrink-0 text-slate-400" />
    <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{label}</span>
  </div>
);
