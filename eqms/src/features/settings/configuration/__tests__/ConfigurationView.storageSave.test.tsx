import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn(), apiGet: vi.fn(), apiPut: vi.fn(), toast: vi.fn() }));
vi.mock('@/services/api/settings', () => ({ settingsApi: { getSystemConfiguration: mocks.get, updateSystemConfiguration: mocks.update } }));
vi.mock('@/services/api/client', () => ({ api: { get: mocks.apiGet, put: mocks.apiPut } }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ hasPermissionAlias: () => true }) }));
vi.mock('@/components/ui/toast/Toast', () => ({ useToast: () => ({ showToast: mocks.toast }) }));
vi.mock('@/components/ui/page/PageHeader', () => ({ PageHeader: ({ actions }: any) => <header>{actions}</header> }));
vi.mock('@/components/ui/modal/AlertModal', () => ({ AlertModal: ({ isOpen, onConfirm }: any) => isOpen ? <button onClick={onConfirm}>Confirm Save</button> : null }));
vi.mock('@/components/ui/modal/NavigationGuardModal', () => ({ NavigationGuardModal: ({ isOpen, onConfirm }: any) => isOpen ? <button onClick={onConfirm}>Confirm Reset</button> : null }));
vi.mock('../tabs/IntegrationsTabs', () => ({
  IntegrationsTabs: ({ integrations, onIntegrationsChange, storagePolicy }: any) => (
    <>
      <input aria-label="Storage provider" value={integrations.provider ?? ''} onChange={event => onIntegrationsChange({ ...integrations, provider: event.target.value })} />
      <input aria-label="Budget" value={storagePolicy.draft?.budget ?? ''} onChange={event => storagePolicy.setDraft({ ...storagePolicy.draft, budget: event.target.value })} />
    </>
  ),
}));

import { ConfigurationView } from '../ConfigurationView';

const GIB = 1024 ** 3;
const config = { general: { systemDisplayName: 'EQMS', backupSettings: { onlyOffice: {} } }, integrations: { provider: 'minio' } };
const status = (budgetBytes: number | null) => ({ data: { policy: { budgetBytes, warningPercent: 80 }, warning: false, scanState: null } });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.get.mockResolvedValue(config);
  mocks.update.mockImplementation(delta => Promise.resolve({ ...config, ...delta }));
  mocks.apiGet.mockResolvedValue(status(null));
  mocks.apiPut.mockResolvedValue({ data: {} });
});
afterEach(cleanup);
const mount = () => render(<MemoryRouter initialEntries={['/settings/configuration/integrations']}><ConfigurationView /></MemoryRouter>);
const saveButton = () => screen.getAllByRole('button', { name: 'Save' })[0];
const save = () => {
  fireEvent.click(saveButton());
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Save' }));
};

describe('Configuration shared storage policy save', () => {
  it('turns Save on for a budget change and writes only the storage policy, in bytes', async () => {
    mount();
    expect(saveButton()).toBeDisabled();
    fireEvent.change(await screen.findByLabelText('Budget'), { target: { value: '2' } });
    expect(saveButton()).toBeEnabled();

    save();

    await waitFor(() => expect(mocks.apiPut).toHaveBeenCalledWith('/settings/storage-usage/policy', { budgetBytes: 2 * GIB, warningPercent: 80 }));
    expect(mocks.update).not.toHaveBeenCalled();
    await waitFor(() => expect(saveButton()).toBeDisabled());
  });

  it('keeps Save off while the budget is not valid', async () => {
    mount();
    fireEvent.change(await screen.findByLabelText('Budget'), { target: { value: '-4' } });
    expect(saveButton()).toBeDisabled();
    expect(mocks.apiPut).not.toHaveBeenCalled();
  });

  it('does not rewrite the policy when only another setting changes', async () => {
    mount();
    fireEvent.change(await screen.findByLabelText('Storage provider'), { target: { value: 's3' } });
    save();
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith({ integrations: { provider: 's3' } }));
    expect(mocks.apiPut).not.toHaveBeenCalled();
  });

  it('discards the budget with the shared Reset and writes nothing', async () => {
    mount();
    fireEvent.change(await screen.findByLabelText('Budget'), { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Reset' }));
    expect(screen.getByLabelText('Budget')).toHaveValue('');
    expect(mocks.apiPut).not.toHaveBeenCalled();
  });

  it('keeps a rejected budget and says that the system settings were saved', async () => {
    mocks.apiPut.mockRejectedValueOnce(new Error('Policy refused'));
    mount();
    fireEvent.change(await screen.findByLabelText('Storage provider'), { target: { value: 's3' } });
    fireEvent.change(screen.getByLabelText('Budget'), { target: { value: '3' } });
    save();
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error', message: expect.stringContaining('System configuration was saved, but the storage policy was not saved.') })));
    expect(screen.getByLabelText('Budget')).toHaveValue('3');
    expect(saveButton()).toBeEnabled();
    expect(mocks.update).toHaveBeenCalledTimes(1);
  });
});
