import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn(), create: vi.fn(), update: vi.fn(), filterOptions: vi.fn(), toast: vi.fn() }));
vi.mock('@/services/api', () => ({ educationApi: { schools: { get: mocks.get, create: mocks.create, update: mocks.update, filterOptions: mocks.filterOptions } } }));
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ showToast: mocks.toast }) }));
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
  NavigationGuardModal: ({ isOpen, onClose, onConfirm, currentPageTitle }: any) =>
    isOpen ? <div role="dialog">Leave {currentPageTitle}?<button onClick={onClose}>Stay</button><button onClick={onConfirm}>Leave</button></div> : null,
}));

import { EducationSchoolEditorView } from '../EducationSchoolEditorView';
import { hasUnsavedScreen } from '@/hooks/useReportUnsavedChanges';

const Where = () => <p data-testid="where">{useLocation().pathname}</p>;
const mount = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/settings/education/schools/new" element={<EducationSchoolEditorView />} />
        <Route path="/settings/education/schools/:id/edit" element={<EducationSchoolEditorView />} />
        <Route path="/settings/education/schools" element={<p>the list</p>} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mocks.filterOptions.mockResolvedValue({ governingBodies: [] });
  mocks.get.mockResolvedValue({ id: 's1', name: 'Hanoi University', abbreviation: 'HU', type: 'UNIVERSITY', ownership: null, isActive: true, governingBody: null, countryOfOriginName: null });
  mocks.create.mockResolvedValue({ name: 'New School' });
  mocks.update.mockResolvedValue({ name: 'Hanoi University' });
});
afterEach(cleanup);

describe('the school form asks before it leaves with a change that was not saved', () => {
  it('a new form that was not touched goes back at once', async () => {
    mount('/settings/education/schools/new');
    fireEvent.click(await screen.findByRole('button', { name: 'Back' }));
    expect(screen.getByTestId('where').textContent).toBe('/settings/education/schools');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('a typed name makes Back ask, "Stay" keeps the typing, "Leave" goes', async () => {
    mount('/settings/education/schools/new');
    fireEvent.change(await screen.findByPlaceholderText(/Hanoi University of Science/), { target: { value: 'Typed School' } });
    expect(hasUnsavedScreen()).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('dialog').textContent).toContain('Leave New School?');
    expect(screen.getByTestId('where').textContent).toBe('/settings/education/schools/new');
    fireEvent.click(screen.getByRole('button', { name: 'Stay' }));
    expect(screen.getByDisplayValue('Typed School')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
    expect(screen.getByTestId('where').textContent).toBe('/settings/education/schools');
  });

  it('the breadcrumb asks as well', async () => {
    mount('/settings/education/schools/new');
    fireEvent.change(await screen.findByPlaceholderText(/Hanoi University of Science/), { target: { value: 'Typed School' } });
    fireEvent.click(screen.getByRole('button', { name: 'crumb Schools' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('an edit that was only loaded from the server is not a change, so Back goes at once', async () => {
    mount('/settings/education/schools/s1/edit');
    await screen.findByDisplayValue('Hanoi University');
    expect(hasUnsavedScreen()).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByTestId('where').textContent).toBe('/settings/education/schools');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('an edit that was changed asks, and a change that is undone does not', async () => {
    mount('/settings/education/schools/s1/edit');
    const field = await screen.findByDisplayValue('Hanoi University');
    fireEvent.change(field, { target: { value: 'Hanoi University X' } });
    expect(hasUnsavedScreen()).toBe(true);
    fireEvent.change(field, { target: { value: 'Hanoi University' } });
    expect(hasUnsavedScreen()).toBe(false);
  });

  it('after a successful Save it goes to the list without asking', async () => {
    mount('/settings/education/schools/new');
    fireEvent.change(await screen.findByPlaceholderText(/Hanoi University of Science/), { target: { value: 'New School' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/settings/education/schools'));
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
