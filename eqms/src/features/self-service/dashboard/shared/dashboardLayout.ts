import { move } from '@dnd-kit/helpers';
import type { DragEndEvent } from '@dnd-kit/react';

export type DashboardWidgetSetting = { id: string; label: string; visible: boolean; width: 'half' | 'full' };

/** Reorders only known widgets. Hidden items retain their preferences. */
export function moveDashboardWidget<T extends { id: string }>(items: T[], id: string, targetId: string): T[] {
  const from = items.findIndex(item => item.id === id), to = items.findIndex(item => item.id === targetId);
  if (from < 0 || to < 0 || from === to) return items;
  const next = [...items];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}

/** Commit the library's optimistic order once on drop; never render hidden/unavailable IDs. */
export function applyDashboardDrop<T extends { id: string; visible: boolean }>(items: T[], event: DragEndEvent): T[] {
  if (event.canceled || !event.operation.source || !event.operation.target) return items;
  const visible = items.filter(item => item.visible);
  if (!visible.some(item => item.id === event.operation.source!.id)) return items;
  const reordered = move(visible, event);
  if (reordered.every((item, index) => item === visible[index])) return items;
  let index = 0;
  return items.map(item => item.visible ? reordered[index++] : item);
}
