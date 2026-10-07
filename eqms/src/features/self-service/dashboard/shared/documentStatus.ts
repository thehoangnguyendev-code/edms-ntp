/**
 * Lifecycle statuses of a Document Master as the dashboard shows them. Codes are the machine values
 * stored by the backend (see DocumentService); only the labels are display text.
 */
export const DOCUMENT_STATUS_ORDER = ['ACTIVE', 'DRAFT', 'OBSOLETED', 'CLOSED_CANCELLED'];

export const DOCUMENT_STATUS: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Effective', color: '#10b981' },
  DRAFT: { label: 'Draft', color: '#94a3b8' },
  OBSOLETED: { label: 'Obsolete', color: '#f59e0b' },
  CLOSED_CANCELLED: { label: 'Cancelled', color: '#ef4444' },
  OTHER: { label: 'Other', color: '#cbd5e1' },
};
