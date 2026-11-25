import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const access = vi.hoisted(() => ({ allowed: true }));
vi.mock('@/middleware/ProtectedRoute', () => ({
  ProtectedRoute: ({ requiredPermissions, children }: { requiredPermissions: string[]; children: React.ReactNode }) =>
    access.allowed ? <div data-testid="guard" data-permissions={requiredPermissions.join('|')}>{children}</div> : <p>Access denied</p>,
}));
vi.mock('@/features/settings', () => ({
  NotificationsView: () => <p>Notifications list</p>,
  EmailMessageEditView: () => <p>Email editor</p>,
  NotificationEventView: ({ channel }: { channel: string }) => <p>Event {channel}</p>,
  EmailDesignView: () => <p>Email design</p>,
  InAppDesignView: () => <p>In-app design</p>,
}));

import { settingsRoutes } from '../SettingsRoutes';
import { TRANSACTIONAL_PREFIXES } from '@/app/routes.constants';

function Location() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}
function open(path: string) {
  render(<MemoryRouter initialEntries={[path]}><Location /><Routes>
    {settingsRoutes(vi.fn())}
    <Route path="*" element={<p>Not found</p>} />
  </Routes></MemoryRouter>);
}
afterEach(() => { cleanup(); access.allowed = true; });

describe('Notifications Administration routes', () => {
  it.each([
    ['/settings/notifications', 'Notifications list', 'settings.notification_policy.view|settings.notification_policy.manage|settings.email_template.view|settings.email_template.manage'],
    ['/settings/notifications/emails/message-id', 'Email editor', 'settings.email_template.view|settings.email_template.manage'],
    ['/settings/notifications/events/document.review_request', 'Event IN_APP', 'settings.notification_policy.view|settings.notification_policy.manage'],
    ['/settings/notifications/events/document.review_request/email', 'Event EMAIL', 'settings.notification_policy.view|settings.notification_policy.manage'],
    ['/settings/notifications/email-design', 'Email design', 'settings.notification_policy.view|settings.notification_policy.manage|settings.email_template.view|settings.email_template.manage'],
    ['/settings/notifications/in-app-design', 'In-app design', 'settings.notification_policy.view|settings.notification_policy.manage'],
  ])('keeps %s and its existing permission guard', async (path, text, permissions) => {
    open(path);
    await screen.findByText(text);
    expect(screen.getAllByTestId('guard').at(-1)).toHaveAttribute('data-permissions', permissions);
    expect(screen.getByTestId('location')).toHaveTextContent(path);
  });

  it.each(['/settings/email-templates', '/settings/email-templates/new', '/settings/email-templates/edit/message-id', '/settings/notification-policy', '/settings/notification-policy/event-id'])(
    'retires the old UI address %s without redirecting to an editor', (path) => {
      open(path);
      expect(screen.getByText('Not found')).toBeInTheDocument();
      expect(screen.getByTestId('location')).toHaveTextContent(path);
    },
  );

  it('does not retain the old email form paths in the navigation classification', () => {
    expect(TRANSACTIONAL_PREFIXES.some(path => path.startsWith('/settings/email-templates'))).toBe(false);
  });

  it('keeps the editor behind the existing access guard', () => {
    access.allowed = false;
    open('/settings/notifications/emails/message-id');
    expect(screen.getByText('Access denied')).toBeInTheDocument();
    expect(screen.queryByText('Email editor')).not.toBeInTheDocument();
  });
});
