import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CalendarDayDrawer } from '../CalendarDayDrawer';
import type { CalendarDay, CalendarEvent } from '@/services/api/calendar';
vi.mock('@/components/ui/drawer/Drawer', () => ({ Drawer: ({ open, title, children }: any) => open ? <div role="dialog" aria-label={title}>{children}</div> : null }));
afterEach(cleanup);
const item: CalendarEvent = { id: 'review-a', source: 'EQMS', category: 'TASK', taskStatus: 'PENDING', kind: 'REVIEW',
  title: 'Review SOP.001', description: 'Assigned to you', start: '2026-10-01T09:00:00', end: '2026-10-01T09:00:01',
  allDay: false, editable: false, version: null, actionUrl: '/documents/revisions/review/uuid', actionLabel: 'Review document' };
const day: CalendarDay = { date: '2026-10-01', number: 1, inMonth: true, today: true, events: [item,
  { ...item, id: 'done', title: 'Completed review', taskStatus: 'COMPLETED', actionLabel: 'View record' },
  { ...item, id: 'notice', category: 'NOTIFICATION', source: 'NOTIFICATION', taskStatus: null, title: 'Information only' }] };
describe('Calendar day work and notification separation', () => {
  it('shows actual tasks by default and notifications only in their own category', () => {
    render(<CalendarDayDrawer day={day} open onClose={vi.fn()} onOpen={vi.fn()} />);
    expect(screen.getByText('Review SOP.001')).toBeInTheDocument();
    expect(screen.queryByText('Information only')).not.toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Completed review')).toHaveClass('text-slate-500');
    fireEvent.click(screen.getByRole('button', { name: 'Notifications (1)' }));
    expect(screen.getByText('Information only')).toBeInTheDocument(); expect(screen.queryByText('Review SOP.001')).not.toBeInTheDocument();
  });
  it('passes the server-provided work destination to navigation', () => {
    const onOpen = vi.fn(); render(<CalendarDayDrawer day={day} open onClose={vi.fn()} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: 'Review document' })); expect(onOpen).toHaveBeenCalledWith(item);
  });
  it('has an honest empty state and no manual completion control', () => {
    render(<CalendarDayDrawer day={{ ...day, events: [] }} open onClose={vi.fn()} onOpen={vi.fn()} />);
    expect(screen.getByText('No tasks for this day.')).toBeInTheDocument(); expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});
