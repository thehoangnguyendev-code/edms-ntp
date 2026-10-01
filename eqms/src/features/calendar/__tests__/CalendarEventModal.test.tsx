import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CalendarEventModal } from '../CalendarEventModal';
import type { CalendarEvent } from '@/services/api/calendar';
const api = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn() }));
vi.mock('@/services/api/calendar', () => ({ calendarApi: api }));
beforeEach(() => { api.create.mockReset().mockResolvedValue({}); api.update.mockReset().mockResolvedValue({}); });
afterEach(cleanup);
describe('Personal event editor', () => {
  it('saves through API with inclusive all-day dates and no client owner', async () => {
    const saved = vi.fn();
    render(<CalendarEventModal date="2026-10-01" onClose={vi.fn()} onSaved={saved} />);
    expect(screen.getByRole('button', { name: 'Save Event' })).toBeDisabled();
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'Appointment' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Event' }));
    await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
    expect(api.create).toHaveBeenCalledWith({ title: 'Appointment', description: '',
      start: '2026-10-01T00:00:00', end: '2026-10-01T00:00:00', allDay: true });
  });
  it('preserves optimistic version and converts exclusive end before editing', async () => {
    const event: CalendarEvent = { id: 'private-event', source: 'PERSONAL', kind: 'PERSONAL', title: 'Existing', description: '',
      start: '2026-10-01T00:00:00', end: '2026-10-02T00:00:00', allDay: true, editable: true, version: 3, actionUrl: null };
    render(<CalendarEventModal date="2026-10-01" event={event} onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save Event' }));
    await waitFor(() => expect(api.update).toHaveBeenCalledWith('private-event', expect.objectContaining({ version: 3, end: '2026-10-01T00:00:00' })));
    expect(api.create).not.toHaveBeenCalled();
  });
  it('retains the entered data after server rejection', async () => {
    api.create.mockRejectedValue(new Error('End must be after start.'));
    const saved = vi.fn();
    render(<CalendarEventModal date="2026-10-01" onClose={vi.fn()} onSaved={saved} />);
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'Retry later' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Event' }));
    await screen.findByRole('alert');
    expect(screen.getAllByRole('textbox')[0]).toHaveValue('Retry later');
    expect(saved).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Save Event' })).toBeEnabled();
  });
});
