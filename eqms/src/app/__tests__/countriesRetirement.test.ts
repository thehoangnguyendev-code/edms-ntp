import { describe, expect, it } from 'vitest';
import { getAllPaths, NAV_CONFIG, NAVIGATION_LABEL_OPTIONS } from '../navigation';
import { ROUTES } from '../routes.constants';
import * as settingsBreadcrumbs from '@/components/ui/breadcrumb/breadcrumbs/settings';

describe('Countries retirement', () => {
  it('removes the retired route, menu and configurable navigation label', () => {
    expect(getAllPaths(NAV_CONFIG)).not.toContain('/settings/countries');
    expect(ROUTES.SETTINGS).not.toHaveProperty('COUNTRIES');
    expect(NAVIGATION_LABEL_OPTIONS.some(item => item.id === 'countries')).toBe(false);
    expect(settingsBreadcrumbs).not.toHaveProperty('countries');
  });

  it('keeps the independent Schools route available', () => {
    expect(getAllPaths(NAV_CONFIG)).toContain(ROUTES.SETTINGS.EDUCATION_SCHOOLS);
  });
});
