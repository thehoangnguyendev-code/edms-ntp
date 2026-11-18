import { ROUTES } from '@/app/routes.constants';

/**
 * The pages of Configuration. Each used to be a tab of one screen (?tab=...); now each is its own menu entry, address, title and breadcrumb, in the same order the tabs had.
 * The label is the menu text: the page title and the last breadcrumb show exactly it. navigation.ts and NavigationService.java list the same pages (a test keeps them equal).
 */
export type ConfigurationPageId =
  | 'general'
  | 'navigation-labels'
  | 'security'
  | 'notifications'
  | 'integrations'
  | 'preview-file'
  | 'image-watermark'
  | 'features';

export interface ConfigurationPage {
  id: ConfigurationPageId;
  /** The menu text, the page title and the last breadcrumb. */
  label: string;
  path: string;
  /** The id of the menu entry (navigation.ts and NavigationService.java). */
  navId: string;
  /** The value that the old address carried: /settings/configuration?tab=<legacyTab>. */
  legacyTab: string;
  /** The permission to open the page (V806: one View and one Manage permission for each page). */
  viewPermission: string;
  /** The permission to change the page. */
  managePermission: string;
}

/** settings.config_<page>.view / .manage, the same codes as ConfigurationAuditPage.java. */
const perms = (key: string) => ({ viewPermission: `settings.config_${key}.view`, managePermission: `settings.config_${key}.manage` });

export const CONFIGURATION_PAGES: readonly ConfigurationPage[] = [
  { id: 'general', label: 'General', path: ROUTES.SETTINGS.CONFIGURATION_GENERAL, navId: 'config-general', legacyTab: 'general', ...perms('general') },
  { id: 'navigation-labels', label: 'Navigation Labels', path: ROUTES.SETTINGS.CONFIGURATION_NAVIGATION_LABELS, navId: 'config-navigation-labels', legacyTab: 'navigation', ...perms('navigation_labels') },
  { id: 'security', label: 'Security', path: ROUTES.SETTINGS.CONFIGURATION_SECURITY, navId: 'config-security', legacyTab: 'security', ...perms('security') },
  { id: 'notifications', label: 'Notifications', path: ROUTES.SETTINGS.CONFIGURATION_NOTIFICATIONS, navId: 'config-notifications', legacyTab: 'notification', ...perms('notifications') },
  { id: 'integrations', label: 'Integrations', path: ROUTES.SETTINGS.CONFIGURATION_INTEGRATIONS, navId: 'config-integrations', legacyTab: 'integration', ...perms('integrations') },
  { id: 'preview-file', label: 'Preview File', path: ROUTES.SETTINGS.CONFIGURATION_PREVIEW_FILE, navId: 'config-preview-file', legacyTab: 'preview', ...perms('preview_file') },
  { id: 'image-watermark', label: 'Image Watermark', path: ROUTES.SETTINGS.CONFIGURATION_IMAGE_WATERMARK, navId: 'config-image-watermark', legacyTab: 'watermark', ...perms('image_watermark') },
  { id: 'features', label: 'Features', path: ROUTES.SETTINGS.CONFIGURATION_FEATURES, navId: 'config-features', legacyTab: 'features', ...perms('features') },
];

export const DEFAULT_CONFIGURATION_PAGE = CONFIGURATION_PAGES[0];

/** The page that an address belongs to (the last segment of the path), or undefined. */
export const configurationPageForPath = (pathname: string): ConfigurationPage | undefined => {
  const last = pathname.replace(/[?#].*$/, '').split('/').filter(Boolean).pop();
  return CONFIGURATION_PAGES.find((page) => page.id === last);
};

/** Where an old /settings/configuration?tab=<tab> link goes; the first page when the tab is missing or unknown. */
export const configurationPathForLegacyTab = (tab?: string | null): string =>
  CONFIGURATION_PAGES.find((page) => page.legacyTab === tab)?.path ?? DEFAULT_CONFIGURATION_PAGE.path;
