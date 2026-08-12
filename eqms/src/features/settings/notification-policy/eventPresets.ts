// Guided presets so creating a notification event is pick-from-a-list rather than free typing.
// Mirrors the data objects / variables the backend's seeded catalog already uses
// (NotificationEventCatalogBootstrap.java) so ad-hoc events stay consistent with it.

export interface EventPreset {
  /** Slug appended after the module prefix to form the event code, e.g. "assigned" -> "capa.assigned" */
  actionSlug: string;
  actionLabel: string;
  dataObject: string;
  /** Variables always available in addition to the standard set below. */
  extraVariables: string[];
  actionUrlTemplate: string;
  nameTemplate: string;
}

export const STANDARD_VARIABLES = ['recipientName', 'actionUrl', 'systemName'];

export const MODULE_PRESETS: Record<string, EventPreset[]> = {
  DOCUMENT_CONTROL: [
    {
      actionSlug: 'submitted_for_review',
      actionLabel: 'Submitted for review',
      dataObject: 'DOCUMENT_REVISION',
      extraVariables: ['documentNumber', 'documentTitle', 'revisionNumber'],
      actionUrlTemplate: '/documents/{{documentNumber}}',
      nameTemplate: 'Document Submitted for Review',
    },
    {
      actionSlug: 'approved',
      actionLabel: 'Approved',
      dataObject: 'DOCUMENT_REVISION',
      extraVariables: ['documentNumber', 'documentTitle', 'revisionNumber'],
      actionUrlTemplate: '/documents/{{documentNumber}}',
      nameTemplate: 'Document Approved',
    },
    {
      actionSlug: 'periodic_review_due',
      actionLabel: 'Periodic review due',
      dataObject: 'DOCUMENT',
      extraVariables: ['documentNumber', 'documentTitle'],
      actionUrlTemplate: '/documents/{{documentNumber}}',
      nameTemplate: 'Document Periodic Review Due',
    },
  ],
  CONTROLLED_COPIES: [
    {
      actionSlug: 'distributed',
      actionLabel: 'Distributed',
      dataObject: 'CONTROLLED_COPY',
      extraVariables: ['controlledCopyNumber', 'documentTitle', 'expiryDateDisplay'],
      actionUrlTemplate: '/controlled-copies/{{controlledCopyNumber}}',
      nameTemplate: 'Controlled Copy Distributed',
    },
    {
      actionSlug: 'expiring_soon',
      actionLabel: 'Expiring soon',
      dataObject: 'CONTROLLED_COPY',
      extraVariables: ['controlledCopyNumber', 'documentTitle', 'expiryDateDisplay'],
      actionUrlTemplate: '/controlled-copies/{{controlledCopyNumber}}',
      nameTemplate: 'Controlled Copy Expiring Soon',
    },
  ],
  AUDIT_TRAIL: [
    {
      actionSlug: 'review_campaign_assigned',
      actionLabel: 'Review campaign assigned',
      dataObject: 'AUDIT_TRAIL_REVIEW_CAMPAIGN',
      extraVariables: ['campaignName'],
      actionUrlTemplate: '/audit-trail/campaigns',
      nameTemplate: 'Audit Trail Review Campaign Assigned',
    },
    {
      actionSlug: 'export_completed',
      actionLabel: 'Export completed',
      dataObject: 'AUDIT_LOG',
      extraVariables: [],
      actionUrlTemplate: '/audit-trail/exports',
      nameTemplate: 'Audit Trail Export Completed',
    },
  ],
  SECURITY: [
    {
      actionSlug: 'account_locked',
      actionLabel: 'Account locked',
      dataObject: 'USER_ACCOUNT',
      extraVariables: [],
      actionUrlTemplate: '/profile',
      nameTemplate: 'Account Locked',
    },
  ],
  SYSTEM: [
    {
      actionSlug: 'maintenance_scheduled',
      actionLabel: 'Maintenance scheduled',
      dataObject: 'SYSTEM',
      extraVariables: [],
      actionUrlTemplate: '',
      nameTemplate: 'System Maintenance Scheduled',
    },
  ],
};

export const moduleSlug = (module: string) => module.toLowerCase();

export const buildEventCode = (module: string, actionSlug: string) => `${moduleSlug(module)}.${actionSlug}`;

export const buildVariables = (preset: EventPreset | null) =>
  Array.from(new Set([...STANDARD_VARIABLES, ...(preset?.extraVariables ?? [])]));
