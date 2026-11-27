import type { BadgeColor } from '@/components/ui/badge/Badge';
import { NAV_CONFIG } from '@/app/navigation';
import { canonicalModuleKey, moduleDisplayName } from '@/utils/moduleDisplay';
import { priorityColor } from "@/components/ui/badge/statusColors";

export const moduleLabel = (module: string) => moduleDisplayName(module);

/** Every level-1 menu of the sidebar, in its order and by its name; the value is the one key the server finds all the spellings and sub-menus of that module by. */
export const MODULE_OPTIONS = [
  { label: 'All', value: 'All' },
  ...NAV_CONFIG.map((item) => ({ label: item.label, value: canonicalModuleKey(item.label) })),
];

export const PRIORITY_COLOR = Object.fromEntries((["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const).map((code) => [code, priorityColor(code)])) as Record<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL", BadgeColor> as Record<string, BadgeColor>;

export const priorityLabel = (priority: string) => priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase();

/** The priorities an administrator can give a notification. Critical is only ever the default of an event the catalog marks critical. */
export const PRIORITY_CHOICES = ['LOW', 'MEDIUM', 'HIGH'] as const;

/** "IN_APP,EMAIL" as a list. */
export const channelList = (csv: string | null | undefined) =>
  (csv ?? '')
    .split(',')
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
