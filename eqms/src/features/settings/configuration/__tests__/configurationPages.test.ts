import { describe, expect, it } from 'vitest';
import { NAV_CONFIG, NAVIGATION_LABEL_OPTIONS } from '@/app/navigation';
import type { NavItem } from '@/types/app';
import { ROUTES } from '@/app/routes.constants';
import {
  CONFIGURATION_PAGES,
  DEFAULT_CONFIGURATION_PAGE,
  configurationPageForPath,
  configurationPathForLegacyTab,
} from '../configurationPages';

const find = (items: NavItem[], id: string): NavItem | undefined => {
  for (const item of items) {
    if (item.id === id) return item;
    const inChild = item.children ? find(item.children, id) : undefined;
    if (inChild) return inChild;
  }
  return undefined;
};

describe('the pages of Configuration', () => {
  it('are the eight tabs of the old screen, in the order the tabs had', () => {
    expect(CONFIGURATION_PAGES.map((page) => page.label)).toEqual([
      'General', 'Navigation Labels', 'Security', 'Notifications', 'Integrations', 'Preview File', 'Image Watermark', 'Features',
    ]);
    expect(DEFAULT_CONFIGURATION_PAGE.label).toBe('General');
  });

  it('each has its own address, menu id and old tab, and none is shared', () => {
    for (const key of ['id', 'label', 'path', 'navId', 'legacyTab'] as const) {
      expect(new Set(CONFIGURATION_PAGES.map((page) => page[key])).size).toBe(CONFIGURATION_PAGES.length);
    }
    CONFIGURATION_PAGES.forEach((page) => {
      expect(page.path).toBe(`${ROUTES.SETTINGS.CONFIGURATION}/${page.id}`);
      expect(page.navId).toBe(`config-${page.id}`);
    });
  });

  it('are found from their address, with a trailing slash, a query or a hash', () => {
    CONFIGURATION_PAGES.forEach((page) => {
      expect(configurationPageForPath(page.path)?.id).toBe(page.id);
      expect(configurationPageForPath(`${page.path}/`)?.id).toBe(page.id);
      expect(configurationPageForPath(`${page.path}?x=1#top`)?.id).toBe(page.id);
    });
    expect(configurationPageForPath('/settings/configuration')).toBeUndefined();
    expect(configurationPageForPath('/settings/configuration/unknown')).toBeUndefined();
    expect(configurationPageForPath('/')).toBeUndefined();
  });

  it('are reached from every old ?tab= link, and the first page takes a missing or unknown tab', () => {
    const expected: Record<string, string> = {
      general: 'general', navigation: 'navigation-labels', security: 'security', notification: 'notifications',
      integration: 'integrations', preview: 'preview-file', watermark: 'image-watermark', features: 'features',
    };
    Object.entries(expected).forEach(([tab, id]) => {
      expect(configurationPathForLegacyTab(tab)).toBe(`${ROUTES.SETTINGS.CONFIGURATION}/${id}`);
    });
    expect(configurationPathForLegacyTab(null)).toBe(ROUTES.SETTINGS.CONFIGURATION_GENERAL);
    expect(configurationPathForLegacyTab(undefined)).toBe(ROUTES.SETTINGS.CONFIGURATION_GENERAL);
    expect(configurationPathForLegacyTab('nope')).toBe(ROUTES.SETTINGS.CONFIGURATION_GENERAL);
  });

  it('are the children of the Configuration group of the menu, with the same ids, texts and addresses', () => {
    const group = find(NAV_CONFIG, 'config');
    expect(group?.label).toBe('Configuration');
    expect(group?.path).toBeUndefined();
    expect(group?.children?.map((child) => [child.id, child.label, child.path])).toEqual(
      CONFIGURATION_PAGES.map((page) => [page.navId, page.label, page.path]),
    );
    // each page is shown by the View permission of that page (V806), the same code as the page's own route guard
    CONFIGURATION_PAGES.forEach((page) => expect(group?.children?.find((child) => child.id === page.navId)?.allowedPermissions).toEqual([page.viewPermission]));
    expect(group?.allowedPermissions).toEqual(CONFIGURATION_PAGES.map((page) => page.viewPermission));
  });

  it('can have their menu text changed under Navigation Labels, as every menu entry can', () => {
    const options = NAVIGATION_LABEL_OPTIONS.filter((option) => option.hierarchy.includes('Configuration ›'));
    expect(options.map((option) => option.id)).toEqual(CONFIGURATION_PAGES.map((page) => page.navId));
    expect(options.every((option) => option.hierarchy.startsWith('System Administration › Configuration › '))).toBe(true);
  });
});
