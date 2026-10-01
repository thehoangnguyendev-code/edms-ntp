import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { CalendarView } from '../CalendarView';

const state = vi.hoisted(() => ({
  user: { id: 'owner-a' }, month: vi.fn(), remove: vi.fn(),
  listener: undefined as undefined | ((event: { type: string; data: string }) => void),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock('@/services/api/calendar', () => ({ calendarApi: { month: state.month, remove: state.remove } }));
vi.mock('@/features/realtime/useEntityChanged', () => ({ useEntityChanged: vi.fn() }));
vi.mock('@/features/notifications/notificationRealtime', () => ({ subscribeNotificationRealtime: (listener: typeof state.listener) => {
  state.listener = listener; return () => { state.listener = undefined; };
} }));
vi.mock('@/components/ui/page/PageHeader', () => ({ PageHeader: ({ title, actions }: any) => <header><h1>{title}</h1>{actions}</header> }));
vi.mock('@/components/ui/select', () => ({ Select: ({ value, onChange, options }: any) => <select aria-label="Source" value={value} onChange={e => onChange(e.target.value)}>{options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}</select> }));
vi.mock('../CalendarEventModal', () => ({ CalendarEventModal: () => <div>Event editor</div> }));
const event = { id: 'private-a', source: 'PERSONAL', kind: 'PERSONAL', title: 'Private appointment A', description: null,
  start: '2026-10-01T09:00:00', end: '2026-10-01T10:00:00', allDay: false, editable: true, version: 2, actionUrl: null };
const month = { month: '2026-10', label: 'October 2026', previousMonth: '2026-09', nextMonth: '2026-11',
  today: '2026-10-01', currentMonth: '2026-10', timeZone: 'UTC+07:00', weekdays: ['Thursday'],
  days: [{ date: '2026-10-01', number: 1, inMonth: true, today: true, events: [event] }] };
const view = () => <MemoryRouter><CalendarView /></MemoryRouter>;
beforeEach(() => { state.user = { id: 'owner-a' }; state.month.mockReset().mockResolvedValue(month); state.remove.mockReset(); });
afterEach(cleanup);
describe('Personal calendar server-driven UI', () => {
  it('opens a day drawer by clicking the day cell and has no bottom agenda', async () => {
    render(view()); await screen.findByText('October 2026');
    expect(screen.queryByLabelText('Selected day events')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Thursday, October 1, 2026' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Events (1)' }));
    expect(screen.getByText('Private appointment A')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
  it('renders server days and asks server for the next month and selected source', async () => {
    render(view()); await screen.findByText('October 2026');
    expect(state.month).toHaveBeenCalledWith(undefined, 'ALL', expect.any(AbortSignal));
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    await waitFor(() => expect(state.month).toHaveBeenLastCalledWith('2026-11', 'ALL', expect.any(AbortSignal)));
    fireEvent.change(screen.getByLabelText('Source'), { target: { value: 'PERSONAL' } });
    await waitFor(() => expect(state.month).toHaveBeenLastCalledWith('2026-11', 'PERSONAL', expect.any(AbortSignal)));
  });
  it('ignores connection heartbeats instead of repeatedly reloading', async () => {
    render(view()); await screen.findByText('October 2026');
    act(() => { state.listener?.({ type: 'ping', data: '' }); state.listener?.({ type: 'connected', data: '' }); });
    await new Promise(resolve => setTimeout(resolve, 550));
    expect(state.month).toHaveBeenCalledTimes(1);
  });
  it('keeps rendered calendar during refresh and clears private data on account switch', async () => {
    const { rerender } = render(view()); await screen.findByText('October 2026');
    const oldSignal = state.month.mock.calls[0][2] as AbortSignal;
    state.month.mockReturnValue(new Promise(() => {}));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh calendar' }));
    expect(screen.getByText('October 2026')).toBeInTheDocument();
    expect(oldSignal.aborted).toBe(true);
    state.user = { id: 'owner-b' }; rerender(view());
    expect(screen.queryByText('October 2026')).not.toBeInTheDocument();
    expect(screen.queryByText('Private appointment A')).not.toBeInTheDocument();
  });
  it('shows API failure and retries without inventing calendar records', async () => {
    state.month.mockRejectedValueOnce(new Error('offline'));
    render(view()); await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByText('October 2026'); expect(state.month).toHaveBeenCalledTimes(2);
  });
});
