import { describe, expect, it } from 'vitest';
import { isDashboardPath } from '../routes.constants';

describe('isDashboardPath', () => {
  it('is true for the Dashboard, with or without a trailing slash', () => {
    expect(isDashboardPath('/dashboard')).toBe(true);
    expect(isDashboardPath('/dashboard/')).toBe(true);
  });

  it('is false for every other page, including ones that only start with the same letters', () => {
    for (const path of ['/', '/documents/all', '/dashboard/anything', '/dashboards', '/settings/dashboard', '/notifications']) {
      expect(isDashboardPath(path), path).toBe(false);
    }
  });
});
