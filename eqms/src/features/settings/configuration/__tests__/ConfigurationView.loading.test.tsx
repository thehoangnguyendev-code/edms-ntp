import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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
vi.mock('@/components/ui/tabs/TabNav', () => ({
  TabNav: ({ tabs, onChange }: { tabs: Array<{ id: string; label: string }>; onChange: (id: string) => void }) =>
    <nav>{tabs.map(tab => <button key={tab.id} onClick={() => onChange(tab.id)}>{tab.label}</button>)}</nav>,
}));
vi.mock('../tabs/GeneralTab', () => {
  mocks.general();
  return { GeneralTab: () => <p>General settings loaded</p> };
});
vi.mock('../tabs/SecurityTab', () => {
  mocks.security();
  return { SecurityTab: () => <p>Security settings loaded</p> };
});

import { ConfigurationView } from '../ConfigurationView';

describe('Configuration navigation loading', () => {
  it('shows the page shell while the API is pending and loads only the selected tab', async () => {
    let resolve!: (value: unknown) => void;
    mocks.get.mockReturnValue(new Promise(value => { resolve = value; }));
    render(<MemoryRouter><ConfigurationView /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Configuration' })).toBeInTheDocument();
    expect(screen.getByText('Loading System Configuration...')).toBeInTheDocument();
    expect(mocks.security).not.toHaveBeenCalled();
    await act(async () => resolve({ general: {}, security: {}, documents: {}, notifications: {}, integrations: {}, features: [] }));
    expect(await screen.findByText('General settings loaded')).toBeInTheDocument();
    expect(mocks.general).toHaveBeenCalledOnce();
    expect(mocks.security).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /^Security$/ }));
    await waitFor(() => expect(screen.getByText('Security settings loaded')).toBeInTheDocument());
    expect(mocks.security).toHaveBeenCalledOnce();
    expect(mocks.get).toHaveBeenCalledOnce();
  });
});
