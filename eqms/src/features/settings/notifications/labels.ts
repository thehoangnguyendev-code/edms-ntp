import type { BadgeColor } from '@/components/ui/badge/Badge';

/** A module is written "DOCUMENT_CONTROL" by most events and "Document Control" by a few; both read the same. */
export const moduleKey = (module: string) => module.trim().toUpperCase().replace(/ /g, '_');

const MODULE_LABEL: Record<string, string> = {
  DOCUMENT_CONTROL: 'Document Control',
  CONTROLLED_COPIES: 'Controlled Copies',
  TRAINING: 'Training Management',
  REPORTS: 'Reports',
  AUDIT_TRAIL: 'Audit Trail',
  BACKUP_RESTORE: 'Backup & Restore',
  SECURITY: 'Security',
  ACCESS_REVIEW: 'Access Review',
  KNOWLEDGE: 'Knowledge Base',
  SYSTEM: 'System',
};

export const moduleLabel = (module: string) => MODULE_LABEL[moduleKey(module)] ?? module;

export const MODULE_OPTIONS = [
  { label: 'All', value: 'All' },
  ...Object.entries(MODULE_LABEL).map(([value, label]) => ({ label, value })),
];

export const PRIORITY_COLOR: Record<string, BadgeColor> = {
  LOW: 'slate',
  MEDIUM: 'blue',
  HIGH: 'amber',
  CRITICAL: 'red',
};

export const priorityLabel = (priority: string) => priority.charAt(0) + priority.slice(1).toLowerCase();

/** "IN_APP,EMAIL" as a list. */
export const channelList = (csv: string | null | undefined) =>
  (csv ?? '')
    .split(',')
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
