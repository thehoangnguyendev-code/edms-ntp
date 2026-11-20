import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn(), apiGet: vi.fn(), apiPut: vi.fn(), toast: vi.fn() }));
vi.mock('@/services/api/settings', () => ({ settingsApi: { getSystemConfiguration: mocks.get, updateSystemConfiguration: mocks.update, getIntegrationChecks: vi.fn().mockResolvedValue({}) } }));
vi.mock('@/services/api/client', () => ({ api: { get: mocks.apiGet, put: mocks.apiPut } }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ hasPermissionAlias: () => true }) }));
vi.mock('@/components/ui/toast/Toast', () => ({ useToast: () => ({ showToast: mocks.toast }) }));
vi.mock('@/components/ui/page/PageHeader', () => ({ PageHeader: ({ actions }: any) => <header>{actions}</header> }));
vi.mock('@/components/ui/modal/NavigationGuardModal', () => ({ NavigationGuardModal: () => null }));
// the real AlertModal: the point of these tests is that its confirm button stays off until the retention change is acknowledged
vi.mock('../tabs/IntegrationsTabs', () => ({
  IntegrationsTabs: ({ integrations, onIntegrationsChange }: any) => (
    <>
      <input aria-label="Retention years" value={integrations.storage.minioRetentionYears ?? 100} onChange={(e) => onIntegrationsChange({ ...integrations, storage: { ...integrations.storage, minioRetentionYears: Number(e.target.value) } })} />
      <input aria-label="Bucket" value={integrations.storage.minioBucket} onChange={(e) => onIntegrationsChange({ ...integrations, storage: { ...integrations.storage, minioBucket: e.target.value } })} />
      <button onClick={() => onIntegrationsChange({ ...integrations, storage: { ...integrations.storage, provider: 'nas', minioRetentionYears: 7 } })}>Switch to NAS keeping years</button>
    </>
  ),
}));

import { ConfigurationView } from '../ConfigurationView';

const config = { general: { systemDisplayName: 'EQMS', backupSettings: { onlyOffice: {} } }, integrations: { storage: { provider: 'minio', minioBucket: 'b' } } };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.get.mockResolvedValue(config);
  mocks.update.mockImplementation(delta => Promise.resolve({ ...config, ...delta }));
  mocks.apiGet.mockResolvedValue({ data: { policy: { budgetBytes: null, warningPercent: 80 }, warning: null, scanState: null } });
});
afterEach(cleanup);
const mount = () => render(<MemoryRouter initialEntries={['/settings/configuration/integrations']}><ConfigurationView /></MemoryRouter>);
const openSave = () => fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]);
const confirm = () => screen.getAllByRole('button', { name: 'Save' }).at(-1) as HTMLButtonElement;

describe('Saving a change of the retention of stored records', () => {
  it('asks to acknowledge that it cannot be undone, and does not save until it is acknowledged', async () => {
    mount();
    fireEvent.change(await screen.findByLabelText('Retention years'), { target: { value: '7' } });
    openSave();

    expect(await screen.findByText(/Retention of stored records: Permanent → 7 years/)).toBeTruthy();
    expect(screen.getByText(/Nobody, administrators included, can shorten or delete/)).toBeTruthy();
    expect(confirm()).toBeDisabled();
    fireEvent.click(confirm());
    expect(mocks.update).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('I understand this cannot be undone.'));
    expect(confirm()).toBeEnabled();
    fireEvent.click(confirm());
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith({ integrations: { storage: { provider: 'minio', minioBucket: 'b', minioRetentionYears: 7 } } }));
  });

  it('asks again the next time Save is pressed: the acknowledgement is not remembered', async () => {
    mount();
    fireEvent.change(await screen.findByLabelText('Retention years'), { target: { value: '7' } });
    openSave();
    fireEvent.click(await screen.findByLabelText('I understand this cannot be undone.'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    openSave();

    expect(screen.getByLabelText('I understand this cannot be undone.')).not.toBeChecked();
    expect(confirm()).toBeDisabled();
  });

  it('does not ask anything extra for a change that is not the retention', async () => {
    mount();
    fireEvent.change(await screen.findByLabelText('Bucket'), { target: { value: 'other' } });
    openSave();

    expect(await screen.findByText('Save System Configuration?')).toBeTruthy();
    expect(screen.queryByText(/Retention of stored records/)).toBeNull();
    expect(confirm()).toBeEnabled();
  });

  it('does not count a retention left over from a provider that is not MinIO as a change', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Switch to NAS keeping years' }));
    openSave();

    expect(await screen.findByText('Save System Configuration?')).toBeTruthy();
    expect(screen.queryByText(/Retention of stored records/)).toBeNull();
    expect(confirm()).toBeEnabled();
  });
});
