"use client";

/*
 * Source: Lightswind UI "Draggable Reorder List" (registry item `draggable-reorder-list`, by
 * codewithmuhilan). Copied into the project and adapted:
 * - Controlled: the order is owned by the parent (`items`), so it stays in step with the parent's draft.
 * - `renderRow` lets each row carry its own controls (switch, pin). The grip is the only drag handle.
 * - `header` / `footer` hold rows that must never move (for example "No." and "Action").
 * - `removable` defaults to false; the original remove (X) button is not part of the column customizer.
 * - Colours use the EQMS slate palette instead of the shadcn theme tokens.
 * - Imports point at this project's `@/components/ui/utils`.
 */

import React from "react";
import { motion, AnimatePresence, Reorder, useDragControls } from "framer-motion";
import { GripVertical, X } from "lucide-react";
import { cn } from "@/components/ui/utils";

export interface ReorderItem {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

interface DraggableReorderListProps<T extends ReorderItem> {
  /** Draggable rows in their current order, owned by the parent. */
  items: T[];
  /** Called with the new order after a drag. The parent decides whether to accept it. */
  onReorder: (items: T[]) => void;
  /** Extra content on the right of each row (switches, buttons). */
  renderRow?: (item: T) => React.ReactNode;
  /** Rows above the list that never move, for example "No.". */
  header?: React.ReactNode;
  /** Rows below the list that never move, for example "Action". */
  footer?: React.ReactNode;
  /** Shows a remove button on each row. Off by default. */
  removable?: boolean;
  onRemove?: (id: string) => void;
  className?: string;
}

function Row<T extends ReorderItem>({
  item,
  renderRow,
  removable,
  onRemove,
}: {
  item: T;
  renderRow?: (item: T) => React.ReactNode;
  removable: boolean;
  onRemove?: (id: string) => void;
}) {
  const dragControls = useDragControls();

  return (
    // as="div": the default list item would show a bullet inside the drawer.
    <Reorder.Item as="div" value={item} id={item.id} dragListener={false} dragControls={dragControls} className="relative">
      <motion.div
        layout
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
        whileDrag={{ scale: 1.02, boxShadow: "0 16px 40px rgba(15,23,42,0.18)", zIndex: 50 }}
        transition={{ type: "spring", stiffness: 350, damping: 30 }}
        className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm transition-shadow hover:shadow-md"
      >
        <motion.div
          onPointerDown={(event) => dragControls.start(event)}
          className="flex-shrink-0 cursor-grab touch-none text-slate-400 transition-colors hover:text-slate-600 active:cursor-grabbing"
          whileHover={{ scale: 1.1 }}
          aria-label={`Drag ${item.label}`}
        >
          <GripVertical className="h-4 w-4" />
        </motion.div>

        {item.icon && (
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
            {item.icon}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-800">{item.label}</p>
          {item.description && <p className="mt-0.5 truncate text-xs text-slate-500">{item.description}</p>}
        </div>

        {renderRow?.(item)}

        {removable && (
          <button
            type="button"
            onClick={() => onRemove?.(item.id)}
            aria-label={`Remove ${item.label}`}
            className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </motion.div>
    </Reorder.Item>
  );
}

/** Vertical list reordered by dragging each row's grip. Header and footer rows stay where they are. */
export function DraggableReorderList<T extends ReorderItem>({
  items,
  onReorder,
  renderRow,
  header,
  footer,
  removable = false,
  onRemove,
  className,
}: DraggableReorderListProps<T>) {
  return (
    <div className={cn("flex w-full select-none flex-col gap-2", className)}>
      {header}
      <Reorder.Group axis="y" values={items} onReorder={onReorder} className="flex flex-col gap-2" as="div">
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <Row key={item.id} item={item} renderRow={renderRow} removable={removable} onRemove={onRemove} />
          ))}
        </AnimatePresence>
      </Reorder.Group>
      {footer}
    </div>
  );
}
