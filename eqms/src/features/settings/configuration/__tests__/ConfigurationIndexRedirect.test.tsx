import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

let held: string[] = [];
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ hasPermissionAlias: (code: string) => held.includes(code) }) }));

import { ConfigurationIndexRedirect } from '../ConfigurationIndexRedirect';
import { CONFIGURATION_PAGES } from '../configurationPages';

const Where = () => <p data-testid="where">{useLocation().pathname}</p>;
const open = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/settings/configuration" element={<ConfigurationIndexRedirect />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );

afterEach(cleanup);

describe('the bare address of Configuration (V806: each page has its own View permission)', () => {
  it('every page has a View and a Manage permission named after it', () => {
    CONFIGURATION_PAGES.forEach((page) => {
      const key = page.id.replace(/-/g, '_');
      expect(page.viewPermission).toBe(`settings.config_${key}.view`);
      expect(page.managePermission).toBe(`settings.config_${key}.manage`);
    });
    expect(new Set(CONFIGURATION_PAGES.map((page) => page.viewPermission)).size).toBe(CONFIGURATION_PAGES.length);
  });

  it('goes to the first page when the person may open it', () => {
    held = CONFIGURATION_PAGES.map((page) => page.viewPermission);
    open('/settings/configuration');
    expect(screen.getByTestId('where').textContent).toBe('/settings/configuration/general');
  });

  it('goes to the page of an old ?tab= link when the person may open it', () => {
    held = CONFIGURATION_PAGES.map((page) => page.viewPermission);
    open('/settings/configuration?tab=security');
    expect(screen.getByTestId('where').textContent).toBe('/settings/configuration/security');
  });

  it('goes to the first page the person may open when they may not open the one the link meant', () => {
    held = ['settings.config_features.view', 'settings.config_integrations.view'];
    open('/settings/configuration?tab=security');
    expect(screen.getByTestId('where').textContent).toBe('/settings/configuration/integrations');
  });
});
