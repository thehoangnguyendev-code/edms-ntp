import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ globalSearch: vi.fn(), navigate: vi.fn() }));
vi.mock('@/services/api/search', () => ({ searchApi: api }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
const quick = vi.hoisted(() => ({ value: { attention: [] as unknown[], goTo: [] as unknown[] } }));
vi.mock('../useQuickPlaces', () => ({ useQuickPlaces: () => quick.value }));
vi.mock('react-router-dom', async (original) => ({ ...(await original<typeof import('react-router-dom')>()), useNavigate: () => api.navigate }));

import { GlobalSearchButton } from '../GlobalSearchButton';

const answer = (groups: unknown[]) => ({ query: 'sop', groups });
const documents = {
  key: 'documents', label: 'Documents', total: 1, unavailable: false,
  items: [{ id: 'd1', title: 'SOP.QA.0127', subtitle: 'Management of deviations', badge: 'Effective' }],
};
const users = { key: 'users', label: 'Users', total: 1, unavailable: false, items: [{ id: 'u9', title: 'Vũ Thị Giang', subtitle: 'E-009 · Quality Assurance', badge: 'Active' }] };

const openBox = () => {
  render(<MemoryRouter><GlobalSearchButton /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Search' }));
  return screen.getByRole('combobox', { name: 'Search' }) as HTMLInputElement;
};

beforeEach(() => {
  window.localStorage.clear();
  api.globalSearch.mockReset();
  api.navigate.mockReset();
  quick.value = { attention: [], goTo: [] };
  api.globalSearch.mockResolvedValue(answer([documents, users]));
});
afterEach(cleanup);

describe('The search box of the top bar', () => {
  it('opens from the magnifier and from Ctrl+K, and does not ask the server for less than two characters', async () => {
    render(<MemoryRouter><GlobalSearchButton /></MemoryRouter>);
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => { fireEvent.keyDown(document, { key: 'k', ctrlKey: true }); });
    expect(await screen.findByRole('dialog', { name: 'Search' })).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: 'Search' }), { target: { value: 's' } });
    await new Promise((resolve) => setTimeout(resolve, 450));
    expect(api.globalSearch).not.toHaveBeenCalled();
  });

  it('waits for a pause in the typing, asks the server once, and shows the results under the heading of their kind', async () => {
    const input = openBox();
    fireEvent.change(input, { target: { value: 'so' } });
    fireEvent.change(input, { target: { value: 'sop' } });
    expect(api.globalSearch).not.toHaveBeenCalled();

    expect(await screen.findByText('SOP.QA.0127')).toBeInTheDocument();
    expect(api.globalSearch).toHaveBeenCalledTimes(1);
    expect(api.globalSearch).toHaveBeenCalledWith('sop', expect.any(AbortSignal));
    expect(screen.getByRole('group', { name: 'Documents' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Users' })).toBeInTheDocument();
    expect(screen.getByText('Vũ Thị Giang')).toBeInTheDocument();
  });

  it('moves with the arrow keys and opens the chosen result with Enter, remembering it for the next time', async () => {
    const input = openBox();
    fireEvent.change(input, { target: { value: 'sop' } });
    await screen.findByText('SOP.QA.0127');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(api.navigate).toHaveBeenCalledWith('/settings/users/profile/u9');
    expect(JSON.parse(window.localStorage.getItem('eqms:global-search:recent:u1') || '[]')[0].item.id).toBe('u9');
  });

  it('offers the results opened last when nothing is typed', async () => {
    window.localStorage.setItem('eqms:global-search:recent:u1', JSON.stringify([{ groupKey: 'documents', groupLabel: 'Documents', item: { id: 'd1', title: 'SOP.QA.0127', subtitle: 'Management of deviations' } }]));
    openBox();
    expect(await screen.findByText('SOP.QA.0127')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Recent' })).toBeInTheDocument();
    expect(api.globalSearch).not.toHaveBeenCalled();
  });

  it('says so when nothing was found, and when a kind could not be searched', async () => {
    api.globalSearch.mockResolvedValue(answer([]));
    const input = openBox();
    fireEvent.change(input, { target: { value: 'zzz' } });
    expect(await screen.findByText(/No results for/)).toBeInTheDocument();

    api.globalSearch.mockResolvedValue(answer([{ key: 'users', label: 'Users', total: 0, unavailable: true, items: [] }, documents]));
    fireEvent.change(input, { target: { value: 'sop' } });
    expect(await screen.findByText(/Users could not be searched/)).toBeInTheDocument();
    expect(screen.getByText('SOP.QA.0127')).toBeInTheDocument();
  });

  it('closes with Escape', async () => {
    const input = openBox();
    fireEvent.keyDown(input, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('is centred by its own row, not by a translate that the motion would replace', async () => {
    openBox();
    const dialog = screen.getByRole('dialog', { name: 'Search' });
    expect(dialog.className).not.toMatch(/translate-x/);
    expect(dialog.parentElement?.className).toMatch(/justify-center/);
  });

  it('offers what needs attention and a few pages when nothing is typed, and opens them directly', async () => {
    quick.value = {
      attention: [{ id: 'pending-review', title: 'Pending my review', path: '/documents/revisions/pending-review', count: 3 }],
      goTo: [{ id: 'doc-all', title: 'All Documents', path: '/documents/all' }],
    };
    const input = openBox();
    expect(screen.getByRole('group', { name: 'Needs attention' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Go to' })).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(api.navigate).toHaveBeenCalledWith('/documents/all');
    // a quick place is not a search result: it is not added to the recent list
    expect(window.localStorage.getItem('eqms:global-search:recent:u1')).toBeNull();
  });

  it('opens a notification by its own link, but never a link that leaves the application', async () => {
    api.globalSearch.mockResolvedValue(answer([{ key: 'notifications', label: 'Notifications', total: 1, unavailable: false, items: [
      { id: 'n1', title: 'Review requested', subtitle: 'SOP.QA.0127', path: '/documents/revisions/review/r1' },
    ] }]));
    const input = openBox();
    fireEvent.change(input, { target: { value: 'review' } });
    await screen.findByText('Review requested');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(api.navigate).toHaveBeenCalledWith('/documents/revisions/review/r1');
  });

  it('sends a notification whose link leaves the application to the notification list instead', async () => {
    api.globalSearch.mockResolvedValue(answer([{ key: 'notifications', label: 'Notifications', total: 1, unavailable: false, items: [
      { id: 'n2', title: 'Odd link', subtitle: 'x', path: 'https://elsewhere.example/phish' },
    ] }]));
    const input = openBox();
    fireEvent.change(input, { target: { value: 'odd' } });
    await screen.findByText('Odd link');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(api.navigate).toHaveBeenCalledWith('/notifications');
  });

  it('shows the code of a record first, apart from its name', async () => {
    api.globalSearch.mockResolvedValue(answer([{ key: 'training', label: 'Training Activities', total: 1, unavailable: false, items: [
      { id: 't1', code: 'TRN/QA/26-371', title: 'E2E-TEST start by Next', subtitle: 'Quality Assurance', badge: 'In progress' },
    ] }]));
    const input = openBox();
    fireEvent.change(input, { target: { value: 'trn/qa' } });
    const code = await screen.findByText('TRN/QA/26-371');
    expect(code.tagName).toBe('CODE');
    expect(screen.getByText('E2E-TEST start by Next')).toBeInTheDocument();
  });

  it('opens the list screen for a kind that has no screen per record', async () => {
    api.globalSearch.mockResolvedValue(answer([{ key: 'departments', label: 'Departments', total: 1, unavailable: false, items: [
      { id: 'd1', code: 'QA', title: 'Quality Assurance', path: '/settings/dictionaries/departments' },
    ] }]));
    const input = openBox();
    fireEvent.change(input, { target: { value: 'qa' } });
    await screen.findByText('Quality Assurance');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(api.navigate).toHaveBeenCalledWith('/settings/dictionaries/departments');
  });

  it('never shows a machine status: the label of the screen where there is one, otherwise the same words made readable', async () => {
    api.globalSearch.mockResolvedValue(answer([
      { key: 'training', label: 'Training Activities', total: 1, unavailable: false, items: [{ id: 't1', code: 'TRN/QA/26-366', title: 'E2E-TEST SOP', badge: 'PENDING_QA_CONFIRMATION' }] },
      { key: 'backups', label: 'Backups', total: 1, unavailable: false, items: [{ id: 'b1', code: 'B-1', title: 'Backup', badge: 'DONE' }] },
      documents,
    ]));
    const input = openBox();
    fireEvent.change(input, { target: { value: 'sop' } });
    expect(await screen.findByText('Pending QA Confirmation')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getByText('Effective')).toBeInTheDocument();
    expect(screen.queryByText('PENDING_QA_CONFIRMATION')).toBeNull();
    expect(screen.queryByText('DONE')).toBeNull();
  });
});
