import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getTemplate: vi.fn(),
  createTemplate: vi.fn(),
  getAvailablePlaceholders: vi.fn(),
  getPlaceholderStyles: vi.fn(),
  listPlaceholderFields: vi.fn(),
  listReservedPlaceholderKeys: vi.fn(),
  toast: vi.fn(),
}));
vi.mock('@/services/api/publishingTemplates', () => ({
  publishingTemplatesApi: {
    getTemplate: mocks.getTemplate,
    createTemplate: mocks.createTemplate,
    getAvailablePlaceholders: mocks.getAvailablePlaceholders,
    getPlaceholderStyles: mocks.getPlaceholderStyles,
  },
}));
vi.mock('@/services/api', () => ({
  controlledCopyPolicyApi: { listPlaceholderFields: mocks.listPlaceholderFields, listReservedPlaceholderKeys: mocks.listReservedPlaceholderKeys },
}));
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ showToast: mocks.toast }) }));
vi.mock('@/hooks/useNavigateWithLoading', async () => {
  const { useNavigate } = await import('react-router-dom');
  return { useNavigateWithLoading: () => ({ navigateTo: useNavigate(), isNavigating: false }) };
});
vi.mock('@/features/documents/shared/components/DocumentPdfViewer', () => ({ DocumentPdfViewer: () => null }));
vi.mock('@/components/ui/page/PageHeader', () => ({
  PageHeader: ({ title, breadcrumbItems, actions }: any) => (
    <header>
      <h1>{title}</h1>
      {breadcrumbItems.map((item: any) => (item.onClick ? <button key={item.label} onClick={item.onClick}>crumb {item.label}</button> : null))}
      {actions}
    </header>
  ),
}));
vi.mock('@/components/ui/modal/NavigationGuardModal', () => ({
  NavigationGuardModal: ({ isOpen, onClose, onConfirm }: any) =>
    isOpen ? <div role="dialog">Leave without saving?<button onClick={onClose}>Stay</button><button onClick={onConfirm}>Leave</button></div> : null,
}));

import { PublishingTemplateEditorView } from '../PublishingTemplateEditorView';
import { hasUnsavedScreen } from '@/hooks/useReportUnsavedChanges';

const LIST = '/documents/administration/publishing-templates';
const Where = () => <p data-testid="where">{useLocation().pathname}</p>;
const mount = (initial: string) =>
  render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path={`${LIST}/new`} element={<PublishingTemplateEditorView />} />
        <Route path={`${LIST}/edit/:id`} element={<PublishingTemplateEditorView />} />
        <Route path="*" element={<p>elsewhere</p>} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn(),
  }));
  mocks.getAvailablePlaceholders.mockResolvedValue({ groups: [] });
  mocks.getPlaceholderStyles.mockResolvedValue([]);
  mocks.listPlaceholderFields.mockResolvedValue([]);
  mocks.listReservedPlaceholderKeys.mockResolvedValue([]);
  mocks.getTemplate.mockResolvedValue({ id: 't1', templateName: 'Existing', description: '', status: 'ACTIVE', publishingMode: 'COVER_ONLY', components: [] });
});
afterEach(cleanup);

describe('the Publishing Template editor asks before it leaves with a name, status or mode that was not saved', () => {
  it('a new template that was not touched goes back at once', async () => {
    mount(`${LIST}/new`);
    await screen.findByPlaceholderText('Enter template name');
    expect(hasUnsavedScreen()).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('where').textContent).not.toBe(`${LIST}/new`);
  });

  it('a typed name is reported to the shell, and Back and the breadcrumb ask first', async () => {
    mount(`${LIST}/new`);
    fireEvent.change(await screen.findByPlaceholderText('Enter template name'), { target: { value: 'My cover' } });
    expect(hasUnsavedScreen()).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByTestId('where').textContent).toBe(`${LIST}/new`);
    fireEvent.click(screen.getByRole('button', { name: 'Stay' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect((screen.getByPlaceholderText('Enter template name') as HTMLInputElement).value).toBe('My cover');

    fireEvent.click(screen.getByRole('button', { name: 'crumb Publishing Templates' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
    expect(screen.getByTestId('where').textContent).toBe(LIST);
  });

  it('an existing template as it was loaded is not a change; an edited name is', async () => {
    mount(`${LIST}/edit/t1`);
    const name = (await screen.findByPlaceholderText('Enter template name')) as HTMLInputElement;
    await waitFor(() => expect(name.value).toBe('Existing'));
    expect(hasUnsavedScreen()).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('typing the name back to what it was is not a change', async () => {
    mount(`${LIST}/edit/t1`);
    const name = (await screen.findByPlaceholderText('Enter template name')) as HTMLInputElement;
    await waitFor(() => expect(name.value).toBe('Existing'));
    fireEvent.change(name, { target: { value: 'Existing 2' } });
    expect(hasUnsavedScreen()).toBe(true);
    fireEvent.change(name, { target: { value: 'Existing' } });
    expect(hasUnsavedScreen()).toBe(false);
  });

  it('after a successful Save the screen is clean again', async () => {
    mocks.createTemplate.mockResolvedValue({ id: 't9', templateName: 'My cover', status: 'INACTIVE', publishingMode: 'COVER_ONLY', components: [] });
    mount(`${LIST}/new`);
    fireEvent.change(await screen.findByPlaceholderText('Enter template name'), { target: { value: 'My cover' } });
    expect(hasUnsavedScreen()).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mocks.createTemplate).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(hasUnsavedScreen()).toBe(false));
  });
});
