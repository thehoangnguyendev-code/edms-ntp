import type { ComponentType } from "react";
import { NAV_CONFIG } from "@/app/navigation";
import type { NavItem } from "@/types";

export type ModuleIcon = ComponentType<{ className?: string }>;

const find = (items: NavItem[], name: string, inherited?: ModuleIcon): ModuleIcon | undefined => {
  for (const item of items) {
    const icon = (item.icon as ModuleIcon | undefined) ?? inherited;
    if (item.label === name) return icon;
    const below = item.children ? find(item.children, name, icon) : undefined;
    if (below) return below;
  }
  return undefined;
};

/** The icon the menu shows for a module, by its menu name (a menu entry with no icon of its own takes the icon of the module above it). Undefined for a name the menu does not have. */
export const moduleMenuIcon = (menuName: string): ModuleIcon | undefined => find(NAV_CONFIG, menuName);
