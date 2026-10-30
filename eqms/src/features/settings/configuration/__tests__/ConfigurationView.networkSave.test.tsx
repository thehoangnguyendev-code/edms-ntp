import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn(), policyGet: vi.fn(), policyPut: vi.fn(), toast: vi.fn() }));
vi.mock('@/services/api/settings', () => ({ settingsApi: { getSystemConfiguration: mocks.get, updateSystemConfiguration: mocks.update } }));
vi.mock('@/services/api/client', () => ({ api: { get: mocks.policyGet, put: mocks.policyPut } }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ hasPermissionAlias: () => true }) }));
vi.mock('@/components/ui/toast/Toast', () => ({ useToast: () => ({ showToast: mocks.toast }) }));
vi.mock('@/components/ui/page/PageHeader', () => ({ PageHeader: ({ actions }: any) => <header>{actions}</header> }));
vi.mock('@/components/ui/modal/AlertModal', () => ({ AlertModal: ({ isOpen, onConfirm }: any) => isOpen ? <button onClick={onConfirm}>Confirm Save</button> : null }));
vi.mock('@/components/ui/modal/NavigationGuardModal', () => ({ NavigationGuardModal: ({ isOpen, onConfirm }: any) => isOpen ? <button onClick={onConfirm}>Confirm Reset</button> : null }));
vi.mock('@/components/ui/tabs/TabNav', () => ({ TabNav: ({ onChange }: any) => <nav><button onClick={() => onChange('security')}>Security</button><button onClick={() => onChange('navigation')}>Navigation</button></nav> }));
vi.mock('../tabs/SecurityTab', () => ({ SecurityTab: ({ config, onChange }: any) => <input aria-label="Minimum Password Length" value={config.passwordMinLength} onChange={event => onChange({ ...config, passwordMinLength: Number(event.target.value) })} /> }));
vi.mock('../tabs/NavigationLabelsTab', () => ({ NavigationLabelsTab: () => <p>Navigation settings</p> }));

import { ConfigurationView } from '../ConfigurationView';

const policy = { enabled: false, allowedNetworks: ['10.0.0.0/8'], trustedProxies: [], emergencyUserId: null };
const config = { general: { systemDisplayName: 'EQMS' }, security: { passwordMinLength: 12 } };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.get.mockResolvedValue(config);
  mocks.update.mockImplementation(delta => Promise.resolve({ ...config, ...delta }));
  mocks.policyGet.mockImplementation(url => Promise.resolve({ data: url.endsWith('/emergency-users') ? [] : policy }));
  mocks.policyPut.mockImplementation((_url, value) => Promise.resolve({ data: value }));
});
afterEach(cleanup);
const mount = () => render(<MemoryRouter initialEntries={['/?tab=security']}><ConfigurationView /></MemoryRouter>);
const save = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Save' }));
};

describe('Configuration shared network save', () => {
  it('does not rewrite the network policy when only another setting changes', async () => {
    mount();
    await screen.findByLabelText(/Allowed networks/);
    fireEvent.change(screen.getByLabelText('Minimum Password Length'), { target: { value: '14' } });
    save();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled());
    expect(mocks.update).toHaveBeenCalledWith({ security: { passwordMinLength: 14 } });
    expect(mocks.policyPut).not.toHaveBeenCalled();
  });

  it('saves only the network policy through the shared confirmation and normalizes CIDR lines', async () => {
    mount();
    fireEvent.change(await screen.findByLabelText(/Trusted proxies/), { target: { value: '172.18.0.0/16\n\n 127.0.0.1/32 ' } });
    save();
    await waitFor(() => expect(mocks.policyPut).toHaveBeenCalledWith('/settings/network-access', { ...policy, trustedProxies: ['172.18.0.0/16', '127.0.0.1/32'] }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled());
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('preserves the draft between tabs and discards it with the shared Reset', async () => {
    mount();
    fireEvent.change(await screen.findByLabelText(/Allowed networks/), { target: { value: '192.168.1.0/24' } });
    fireEvent.click(screen.getByRole('button', { name: 'Navigation' }));
    await screen.findByText('Navigation settings');
    fireEvent.click(screen.getByRole('button', { name: 'Security' }));
    expect(await screen.findByLabelText(/Allowed networks/)).toHaveValue('192.168.1.0/24');
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Reset' }));
    expect(screen.getByLabelText(/Allowed networks/)).toHaveValue('10.0.0.0/8');
    expect(mocks.policyPut).not.toHaveBeenCalled();
    expect(mocks.policyGet.mock.calls.filter(([url]) => url === '/settings/network-access')).toHaveLength(1);
  });

  it('keeps a rejected network draft and retries only that part after system settings succeeded', async () => {
    mocks.policyPut.mockRejectedValueOnce(new Error('Invalid CIDR'));
    mount();
    fireEvent.change(await screen.findByLabelText(/Allowed networks/), { target: { value: 'invalid' } });
    fireEvent.change(screen.getByLabelText('Minimum Password Length'), { target: { value: '14' } });
    save();
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error', message: expect.stringContaining('System configuration was saved, but the network policy was not saved') })));
    expect(screen.getByLabelText(/Allowed networks/)).toHaveValue('invalid');
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled();
    expect(mocks.update).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText(/Allowed networks/), { target: { value: '192.168.1.0/24' } });
    save();
    await waitFor(() => expect(mocks.policyPut).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled());
    expect(mocks.update).toHaveBeenCalledTimes(1);
  });

  it('does not apply the network policy if the system configuration save fails', async () => {
    mocks.update.mockRejectedValueOnce(new Error('Save refused'));
    mount();
    fireEvent.change(await screen.findByLabelText(/Allowed networks/), { target: { value: '192.168.1.0/24' } });
    fireEvent.change(screen.getByLabelText('Minimum Password Length'), { target: { value: '14' } });
    save();
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error', message: 'Save refused' })));
    expect(mocks.policyPut).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Allowed networks/)).toHaveValue('192.168.1.0/24');
  });
});
