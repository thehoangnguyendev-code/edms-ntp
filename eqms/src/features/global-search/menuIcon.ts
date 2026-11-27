import type { ComponentType } from 'react';
import { NAV_CONFIG } from '@/app/navigation';
import type { NavItem } from '@/types';

type IconType = ComponentType<{ className?: string }>;

const collect = (items: NavItem[], into: Map<string, IconType>, inherited?: IconType): Map<string, IconType> => {
  for (const item of items) {
    const icon = (item.icon as IconType | undefined) ?? inherited;
    if (icon) into.set(item.id, icon);
    if (item.children) collect(item.children, into, icon);
  }
  return into;
};

let icons: Map<string, IconType> | undefined;

/** The icon the sidebar shows for a menu entry; an entry with none of its own takes the one of the nearest entry above it. Undefined for an id the menu does not have. */
export const menuIconById = (id: string): IconType | undefined => (icons ??= collect(NAV_CONFIG, new Map())).get(id);
