/**
 * The tabs of the Configuration pages that are split into tabs, in order. The id is what the address carries (?tab=...). Kept apart from the tab
 * components so a page can read the address without loading them. The last tab of every page is History.
 */
export const NOTIFICATION_TAB_IDS = ['channels-delivery', 'email', 'history'] as const;
export type NotificationTabId = (typeof NOTIFICATION_TAB_IDS)[number];

export const INTEGRATION_TAB_IDS = ['storage', 'storage-usage', 'onlyoffice', 'history'] as const;
export type IntegrationTabId = (typeof INTEGRATION_TAB_IDS)[number];

export const PREVIEW_TAB_IDS = ['onlyoffice-preview', 'pdf-preview', 'history'] as const;
export type PreviewTabId = (typeof PREVIEW_TAB_IDS)[number];

export const WATERMARK_TAB_IDS = ['controlled-copy', 'specimen-signature', 'history'] as const;
export type WatermarkTabId = (typeof WATERMARK_TAB_IDS)[number];

/** The tab named in the address, or the first one when there is none or it is not one of the tabs. */
export const pageTabFromParam = <T extends string>(ids: ReadonlyArray<T>, value: string | null | undefined): T =>
  (ids as ReadonlyArray<string>).includes(value ?? '') ? (value as T) : ids[0];

/** The one entity that every audit record of the configuration is written under; the entity type tells the page (see ConfigurationAuditPage on the server). */
export const CONFIGURATION_AUDIT_ENTITY_ID = '00000000-0000-0000-0000-000000000001';

export type ConfigurationHistoryPage = 'general' | 'security' | 'notifications' | 'integrations' | 'preview-file' | 'image-watermark';

/** The entity type of the audit records of each page. */
export const CONFIGURATION_HISTORY_TYPE: Record<ConfigurationHistoryPage, string> = {
  general: 'SYSTEM_CONFIGURATION_GENERAL',
  security: 'SYSTEM_CONFIGURATION_SECURITY',
  notifications: 'SYSTEM_CONFIGURATION_NOTIFICATIONS',
  integrations: 'SYSTEM_CONFIGURATION_INTEGRATIONS',
  'preview-file': 'SYSTEM_CONFIGURATION_PREVIEW_FILE',
  'image-watermark': 'SYSTEM_CONFIGURATION_IMAGE_WATERMARK',
};
