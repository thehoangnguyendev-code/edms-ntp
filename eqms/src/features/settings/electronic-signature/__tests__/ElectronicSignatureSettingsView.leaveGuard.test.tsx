import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getSettings: vi.fn(), saveSettings: vi.fn(), toast: vi.fn() }));
vi.mock('@/services/api/electronicSignatureSettings', () => ({ electronicSignatureSettingsApi: { getSettings: mocks.getSettings, saveSettings: mocks.saveSettings } }));
vi.mock('@/features/security-authorization/shared/useSecurityESign', () => ({ useSecurityESign: () => ({ requestSignature: vi.fn(), signatureModal: null }) }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ hasPermissionAlias: () => true }) }));
vi.mock('@/components/ui/toast/Toast', () => ({ useToast: () => ({ showToast: mocks.toast }) }));
vi.mock('@/components/ui/page/PageHeader', () => ({
  PageHeader: ({ title, breadcrumbItems }: any) => (
    <header>
      <h1>{title}</h1>
      {breadcrumbItems.map((item: any) => (item.onClick ? <button key={item.label} onClick={item.onClick}>crumb {item.label}</button> : null))}
    </header>
  ),
}));
vi.mock('../SignatureMeaningsTable', () => ({
  SignatureMeaningsTable: ({ meanings, onRename }: any) => (
    <input aria-label="Meaning" value={meanings[0]?.displayName ?? ''} onChange={(e) => onRename(meanings[0].code, e.target.value)} />
  ),
}));
vi.mock('@/components/ui/modal/NavigationGuardModal', () => ({
  NavigationGuardModal: ({ isOpen, onClose, onConfirm }: any) =>
    isOpen ? <div role="dialog">Leave without saving?<button onClick={onClose}>Stay</button><button onClick={onConfirm}>Leave</button></div> : null,
}));

import { ElectronicSignatureSettingsView } from '../ElectronicSignatureSettingsView';
import { hasUnsavedScreen } from '@/hooks/useReportUnsavedChanges';

const Where = () => <p data-testid="where">{useLocation().pathname}</p>;
const mount = () => render(<MemoryRouter initialEntries={['/settings/electronic-signature']}><ElectronicSignatureSettingsView /><Where /></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSettings.mockResolvedValue({ signatureTimestampFormat: 'x', signatureTimezone: 'y', meanings: [{ code: 'APPROVED', displayName: 'Approved' }] });
});
afterEach(cleanup);

describe('E-Sign Config asks before it leaves with a meaning that was changed and not saved', () => {
  it('shows nothing to ask while the screen is as it was loaded', async () => {
    mount();
    await screen.findByLabelText('Meaning');
    expect(hasUnsavedScreen()).toBe(false);
  });

  it('a changed meaning is reported to the shell (the sidebar and a reload ask), and the breadcrumb asks first', async () => {
    mount();
    fireEvent.change(await screen.findByLabelText('Meaning'), { target: { value: 'Approved by QA' } });
    expect(hasUnsavedScreen()).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /^crumb / }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByTestId('where').textContent).toBe('/settings/electronic-signature');
    fireEvent.click(screen.getByRole('button', { name: 'Stay' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(hasUnsavedScreen()).toBe(true);
  });

  it('the breadcrumb goes at once when nothing was changed', async () => {
    mount();
    await screen.findByLabelText('Meaning');
    const crumb = screen.getAllByRole('button', { name: /^crumb / })[0];
    fireEvent.click(crumb);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('where').textContent).not.toBe('/settings/electronic-signature');
  });
});
