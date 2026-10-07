import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const documents = vi.hoisted(() => ({ getDocumentsPage: vi.fn() }));
vi.mock('@/services/api/documents', () => ({ documentApi: documents }));

import { loadMyDocumentsByStatus, MyDocumentsPanel } from '../MyDocumentsPanel';

const page = (total: number) => ({ data: [], pagination: { page: 1, limit: 1, total, totalPages: total } });

/** Totals the document list would report for the author's own documents. */
const totals: Record<string, number> = { all: 10, ACTIVE: 4, DRAFT: 3, OBSOLETED: 0, CLOSED_CANCELLED: 1 };

beforeEach(() => {
  documents.getDocumentsPage.mockReset();
  documents.getDocumentsPage.mockImplementation(async (query: { status?: string }) => page(totals[query.status ?? 'all']));
});

describe('loadMyDocumentsByStatus', () => {
  it('asks the document list for the user’s own documents, once overall and once per status', async () => {
    await loadMyDocumentsByStatus();
    const queries = documents.getDocumentsPage.mock.calls.map(([query]) => query);
    expect(queries).toHaveLength(5);
    expect(queries.every((query) => query.scope === 'owned-by-me' && query.limit === 1)).toBe(true);
    expect(queries.map((query) => query.status).sort()).toEqual(['ACTIVE', 'CLOSED_CANCELLED', 'DRAFT', 'OBSOLETED', undefined]);
  });

  it('drops empty statuses and reports what the listed statuses do not cover as Other', async () => {
    const rows = await loadMyDocumentsByStatus();
    // 4 + 3 + 0 + 1 = 8 of 10 -> 2 in a status the dashboard does not list
    expect(rows.map((row) => [row.name, row.value])).toEqual([['Effective', 4], ['Draft', 3], ['Cancelled', 1], ['Other', 2]]);
    expect(rows.reduce((sum, row) => sum + row.value, 0)).toBe(10);
  });
});

describe('MyDocumentsPanel', () => {
  it('shows the real total and keeps each status colour, then switches to the donut', async () => {
    render(<MyDocumentsPanel />);
    expect(await screen.findByText('10 documents authored by you')).toBeInTheDocument();

    const legend = screen.getAllByRole('listitem');
    expect(legend.map((item) => item.textContent)).toEqual(['Effective440%', 'Draft330%', 'Other220%', 'Cancelled110%']);
    const effective = legend[0].querySelector('span[style]') as HTMLElement;
    expect(effective.style.backgroundColor).toBe('rgb(16, 185, 129)'); // same green as Effective on the admin dashboard

    fireEvent.click(screen.getByRole('tab', { name: /Donut/ }));
    const panel = screen.getByRole('tabpanel');
    expect(await within(panel).findByText('Mine')).toBeInTheDocument();
    expect(within(panel).getByText('10')).toBeInTheDocument();
  });

  it('says so when the user has authored nothing, and offers a retry when loading fails', async () => {
    documents.getDocumentsPage.mockImplementation(async () => page(0));
    const { unmount } = render(<MyDocumentsPanel />);
    expect(await screen.findByText('You have not authored any document yet')).toBeInTheDocument();
    unmount();

    documents.getDocumentsPage.mockRejectedValue(new Error('boom'));
    render(<MyDocumentsPanel />);
    expect(await screen.findByText('Your documents could not be loaded.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Try again/ })).toBeInTheDocument();
  });
});
