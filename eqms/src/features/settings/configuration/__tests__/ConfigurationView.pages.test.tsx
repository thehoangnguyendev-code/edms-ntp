import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn(), toast: vi.fn(), manage: { value: true } }));
vi.mock('@/services/api/settings', () => ({ settingsApi: { getSystemConfiguration: mocks.get, updateSystemConfiguration: mocks.update } }));
vi.mock('@/services/api/client', () => ({ api: { get: vi.fn().mockResolvedValue({ data: { enabled: false, allowedNetworks: [], trustedProxies: [], emergencyUserId: null } }), put: vi.fn() } }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ hasPermissionAlias: () => mocks.manage.value }) }));
vi.mock('@/components/ui/toast/Toast', () => ({ useToast: () => ({ showToast: mocks.toast }) }));
vi.mock('@/components/ui/page/PageHeader', () => ({
  PageHeader: ({ title, breadcrumbItems, actions }: any) => (
    <header>
      <h1>{title}</h1>
      <ol aria-label="breadcrumb">
        {breadcrumbItems.map((item: any) => <li key={item.label} data-active={String(Boolean(item.isActive))} data-clickable={String(Boolean(item.onClick))}>{item.label}</li>)}
      </ol>
      {actions}
    </header>
  ),
}));
vi.mock('@/components/ui/modal/AlertModal', () => ({ AlertModal: ({ isOpen, onConfirm }: any) => isOpen ? <button onClick={onConfirm}>Confirm Save</button> : null }));
vi.mock('@/components/ui/modal/NavigationGuardModal', () => ({ NavigationGuardModal: ({ isOpen, onConfirm }: any) => isOpen ? <button onClick={onConfirm}>Confirm Reset</button> : null }));

const stub = (name: string) => () => <p>{name} content</p>;
vi.mock('../tabs/GeneralTab', () => ({ GeneralTab: ({ config, onChange, activeTab, extra }: any) => activeTab === 'module-display' ? <>{extra}</> : <input aria-label="System name" value={config.systemDisplayName} onChange={e => onChange({ ...config, systemDisplayName: e.target.value })} /> }));
vi.mock('../tabs/DashboardRoleDefaults', () => ({ DashboardRoleDefaults: stub('Dashboard role defaults') }));
vi.mock('../tabs/NavigationLabelsTab', () => ({ NavigationLabelsTab: stub('Navigation labels') }));
vi.mock('../tabs/SecurityTab', () => ({ SecurityTab: ({ networkPanel }: any) => <><p>Security content</p>{networkPanel}</> }));
vi.mock('../tabs/NetworkAccessPanel', () => ({ NetworkAccessPanel: stub('Network access') }));
vi.mock('../tabs/NotificationTab', () => ({ NotificationTab: ({ config, onChange }: any) => <input aria-label="Retention days" value={config.retentionDays} onChange={e => onChange({ ...config, retentionDays: Number(e.target.value) })} /> }));
vi.mock('../tabs/IntegrationTab', () => ({ IntegrationTab: stub('Integrations') }));
vi.mock('../tabs/StorageUsagePanel', () => ({ StorageUsagePanel: stub('Storage usage') }));
vi.mock('../tabs/OnlyOfficeTab', () => ({ OnlyOfficeTab: stub('OnlyOffice') }));
vi.mock('../tabs/PreviewFileTab', () => ({ PreviewFileTab: stub('Preview file') }));
vi.mock('../tabs/ImageWatermarkTab', () => ({ ImageWatermarkTab: stub('Image watermark') }));
vi.mock('../tabs/FeaturesTab', () => ({ FeaturesTab: stub('Features') }));

import { ConfigurationView } from '../ConfigurationView';
import { CONFIGURATION_PAGES } from '../configurationPages';
import { hasUnsavedScreen } from '@/hooks/useReportUnsavedChanges';

const config = {
  general: { systemDisplayName: 'EQMS', backupSettings: { onlyOffice: {} } },
  security: { passwordMinLength: 12 },
  notifications: { retentionDays: 30 },
  integrations: {},
  documents: {},
  features: [],
};

const Go = ({ to }: { to: string }) => {
  const navigate = useNavigate();
  return <button onClick={() => navigate(to)}>go {to}</button>;
};
const mount = (path: string) => render(<MemoryRouter initialEntries={[path]}><ConfigurationView /><Go to="/settings/configuration/features" /></MemoryRouter>);
const save = () => {
  fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]);
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Save' }));
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.manage.value = true;
  mocks.get.mockResolvedValue(JSON.parse(JSON.stringify(config)));
  mocks.update.mockImplementation(delta => Promise.resolve({ ...config, ...delta }));
});
afterEach(cleanup);

describe('each page of Configuration has its own title and breadcrumb', () => {
  it.each(CONFIGURATION_PAGES.map((page) => [page.label, page.path, page.label]))('%s at %s', (label, path) => {
    mount(path);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(label);
    const crumbs = Array.from(screen.getByLabelText('breadcrumb').querySelectorAll('li')).map((li) => [li.textContent, li.getAttribute('data-active'), li.getAttribute('data-clickable')]);
    expect(crumbs.slice(-2)).toEqual([['Configuration', 'false', 'false'], [label, 'true', 'false']]);
    expect(crumbs.some(([text]) => text === 'System Administration')).toBe(true);
  });

  it('an address that is no page of Configuration shows the first page', async () => {
    mount('/settings/configuration/unknown');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('General');
  });
});

describe('each page shows only its own settings', () => {
  const cases: Array<[string, string[], string[]]> = [
    ['/settings/configuration/general', ['System name'], ['Security content', 'Features content', 'Dashboard role defaults content']],
    ['/settings/configuration/general?tab=module-display', ['Dashboard role defaults content'], ['System name', 'Security content']],
    ['/settings/configuration/general?tab=unknown', ['System name'], ['Dashboard role defaults content']],
    ['/settings/configuration/navigation-labels', ['Navigation labels content'], ['System name', 'Security content']],
    ['/settings/configuration/security', ['Security content', 'Network access content'], ['System name', 'Integrations content']],
    ['/settings/configuration/notifications', ['Retention days'], ['Security content', 'Features content']],
    ['/settings/configuration/integrations', ['Integrations content', 'OnlyOffice content'], ['Storage usage content', 'Preview file content', 'Security content']],
    ['/settings/configuration/integrations?tab=storage-usage', ['Storage usage content'], ['Integrations content', 'Preview file content']],
    ['/settings/configuration/preview-file', ['Preview file content'], ['Integrations content', 'OnlyOffice content']],
    ['/settings/configuration/image-watermark', ['Image watermark content'], ['Preview file content', 'System name']],
    ['/settings/configuration/features', ['Features content'], ['Security content', 'Image watermark content']],
  ];
  it.each(cases)('%s', async (path, shown, hidden) => {
    mount(path);
    for (const text of shown) {
      await waitFor(() => expect(screen.queryByText(text) ?? screen.queryByLabelText(text)).not.toBeNull());
    }
    for (const text of hidden) {
      expect(screen.queryByText(text) ?? screen.queryByLabelText(text)).toBeNull();
    }
  });

  it('the panels that need the manage permission are left out for someone who can only view', async () => {
    mocks.manage.value = false;
    mount('/settings/configuration/integrations?tab=storage-usage');
    await screen.findByText('Integrations content');
    expect(screen.queryByText('Storage usage content')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reset' })).toBeNull();
  });
});

describe('a page saves and resets its own settings', () => {
  it('sends only the section that the page changed and clears the unsaved flag', async () => {
    mount('/settings/configuration/notifications');
    fireEvent.change(await screen.findByLabelText('Retention days'), { target: { value: '45' } });
    expect(hasUnsavedScreen()).toBe(true);
    expect(screen.getAllByRole('button', { name: 'Save' })[0]).toBeEnabled();
    save();
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith({ notifications: { retentionDays: 45 } }));
    expect(mocks.update).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(hasUnsavedScreen()).toBe(false));
    expect(screen.getAllByRole('button', { name: 'Save' })[0]).toBeDisabled();
  });

  it('keeps Save disabled until something changes, and Reset goes back to the saved values and clears the flag', async () => {
    mount('/settings/configuration/general');
    const field = await screen.findByLabelText('System name');
    expect(screen.getAllByRole('button', { name: 'Save' })[0]).toBeDisabled();
    fireEvent.change(field, { target: { value: 'New name' } });
    expect(hasUnsavedScreen()).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Reset' }));
    expect(screen.getByLabelText('System name')).toHaveValue('EQMS');
    expect(hasUnsavedScreen()).toBe(false);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('an edit that was not saved does not follow the person to another page, and its flag is gone with the page', async () => {
    mount('/settings/configuration/notifications');
    fireEvent.change(await screen.findByLabelText('Retention days'), { target: { value: '99' } });
    expect(hasUnsavedScreen()).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'go /settings/configuration/features' }));
    await screen.findByText('Features content');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Features');
    expect(hasUnsavedScreen()).toBe(false);
    expect(screen.getAllByRole('button', { name: 'Save' })[0]).toBeDisabled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('a failed save keeps the edit and the flag', async () => {
    mocks.update.mockRejectedValueOnce(new Error('Save refused'));
    mount('/settings/configuration/notifications');
    fireEvent.change(await screen.findByLabelText('Retention days'), { target: { value: '45' } });
    save();
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error', message: 'Save refused' })));
    expect(screen.getByLabelText('Retention days')).toHaveValue('45');
    expect(hasUnsavedScreen()).toBe(true);
  });
});
