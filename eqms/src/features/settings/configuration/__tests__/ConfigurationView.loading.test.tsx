import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  general: vi.fn(),
  security: vi.fn(),
}));
vi.mock('@/services/api/settings', () => ({ settingsApi: { getSystemConfiguration: mocks.get } }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ hasPermissionAlias: () => false }) }));
vi.mock('@/components/ui/toast/Toast', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('@/components/ui/page/PageHeader', () => ({ PageHeader: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock('@/components/ui/modal/AlertModal', () => ({ AlertModal: () => null }));
vi.mock('@/components/ui/modal/NavigationGuardModal', () => ({ NavigationGuardModal: () => null }));
vi.mock('../tabs/GeneralTab', () => {
  mocks.general();
  return { GeneralTab: () => <p>General settings loaded</p> };
});
vi.mock('../tabs/SecurityTab', () => {
  mocks.security();
  return { SecurityTab: () => <p>Security settings loaded</p> };
});

import { ConfigurationView } from '../ConfigurationView';

const Go = ({ to }: { to: string }) => {
  const navigate = useNavigate();
  return <button onClick={() => navigate(to)}>go {to}</button>;
};

describe('Configuration page loading', () => {
  it('shows the page shell while the API is pending and loads only the page that the address names', async () => {
    let resolve!: (value: unknown) => void;
    mocks.get.mockReturnValue(new Promise(value => { resolve = value; }));
    render(<MemoryRouter initialEntries={['/settings/configuration/general']}><ConfigurationView /><Go to="/settings/configuration/security" /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'General' })).toBeInTheDocument();
    expect(screen.getByText('Loading System Configuration...')).toBeInTheDocument();
    expect(mocks.security).not.toHaveBeenCalled();
    await act(async () => resolve({ general: {}, security: {}, documents: {}, notifications: {}, integrations: {}, features: [] }));
    expect(await screen.findByText('General settings loaded')).toBeInTheDocument();
    expect(mocks.general).toHaveBeenCalledOnce();
    expect(mocks.security).not.toHaveBeenCalled();
    expect(mocks.get).toHaveBeenCalledOnce();

    // another menu entry is another page: its own title, its own load of the saved configuration
    fireEvent.click(screen.getByRole('button', { name: 'go /settings/configuration/security' }));
    await waitFor(() => expect(screen.getByText('Security settings loaded')).toBeInTheDocument());
    expect(screen.getByRole('heading', { name: 'Security' })).toBeInTheDocument();
    expect(screen.queryByText('General settings loaded')).toBeNull();
    expect(mocks.security).toHaveBeenCalledOnce();
    expect(mocks.get).toHaveBeenCalledTimes(2);
  });
});
