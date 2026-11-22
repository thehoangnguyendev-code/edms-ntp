import type { NavItem } from '@/types';

/**
 * Replaces the presentation label of every navigation node, keeping its id, path, permissions and children untouched.
 * A node whose label has no translation keeps the label the server sent.
 */
export const localizeNavItems = (items: NavItem[], translate: (english: string) => string): NavItem[] =>
  items.map((item) => ({
    ...item,
    label: translate(item.label),
    ...(item.children ? { children: localizeNavItems(item.children, translate) } : {}),
  }));
