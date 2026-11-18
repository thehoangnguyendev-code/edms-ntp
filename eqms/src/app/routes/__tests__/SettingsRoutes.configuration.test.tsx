import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/middleware/ProtectedRoute', () => ({
  ProtectedRoute: ({ requiredPermissions, children }: { requiredPermissions: string[]; children: React.ReactNode }) => (
    <div data-testid="guard" data-permissions={requiredPermissions.join('|')}>{children}</div>
  ),
}));
vi.mock('@/features/settings/configuration/ConfigurationView', () => ({
  ConfigurationView: () => <p data-testid="configuration-view">{useLocation().pathname}</p>,
}));

import { settingsRoutes } from '../SettingsRoutes';
import { CONFIGURATION_PAGES } from '@/features/settings/configuration/configurationPages';

const at = async (path: string) => {
  cleanup();
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>{settingsRoutes(vi.fn())}</Routes>
    </MemoryRouter>,
  );
  return path;
};

afterEach(cleanup);

describe('the addresses of Configuration', () => {
  it.each(CONFIGURATION_PAGES.map((page) => [page.label, page.path, page.viewPermission]))('%s opens its own page at %s, behind its own view permission %s', async (_label, path, view) => {
    await at(path);
    expect((await screen.findByTestId('configuration-view')).textContent).toBe(path);
    const guards = screen.getAllByTestId('guard');
    expect(guards.at(-1)?.getAttribute('data-permissions')).toBe(view);
  });

  it('the bare address leads to the first page', async () => {
    await at('/settings/configuration');
    expect((await screen.findByTestId('configuration-view')).textContent).toBe('/settings/configuration/general');
  });

  it.each([
    ['general', 'general'], ['navigation', 'navigation-labels'], ['security', 'security'], ['notification', 'notifications'],
    ['integration', 'integrations'], ['preview', 'preview-file'], ['watermark', 'image-watermark'], ['features', 'features'],
  ])('an old ?tab=%s link leads to the page %s', async (tab, id) => {
    await at(`/settings/configuration?tab=${tab}`);
    expect((await screen.findByTestId('configuration-view')).textContent).toBe(`/settings/configuration/${id}`);
  });

  it('an old link with an unknown tab leads to the first page and an unknown page is not Configuration', async () => {
    await at('/settings/configuration?tab=unknown');
    expect((await screen.findByTestId('configuration-view')).textContent).toBe('/settings/configuration/general');
    await at('/settings/configuration/unknown');
    expect(screen.queryByTestId('configuration-view')).toBeNull();
  });
});
