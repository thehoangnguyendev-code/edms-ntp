import api from './client';

export type CalendarSource = 'ALL' | 'EQMS' | 'NOTIFICATION' | 'PERSONAL';
export interface CalendarEvent {
  id: string; source: Exclude<CalendarSource, 'ALL'>; kind: string;
  title: string; description: string | null; start: string; end: string;
  allDay: boolean; editable: boolean; version: number | null; actionUrl: string | null;
  category?: 'TASK' | 'NOTIFICATION' | 'PERSONAL' | 'MILESTONE';
  taskStatus?: 'PENDING' | 'WAITING' | 'COMPLETED' | 'UNAVAILABLE' | null;
  actionLabel?: string | null;
}
export interface CalendarDay { date: string; number: number; inMonth: boolean; today: boolean; events: CalendarEvent[] }
export interface CalendarMonth {
  month: string; label: string; previousMonth: string; nextMonth: string;
  today: string; currentMonth: string; timeZone: string; weekdays: string[]; days: CalendarDay[];
}
export interface CalendarEventInput {
  title: string; description: string; start: string; end: string; allDay: boolean; version?: number;
}
export const calendarApi = {
  month: async (month?: string, source: CalendarSource = 'ALL', signal?: AbortSignal): Promise<CalendarMonth> =>
    (await api.get('/calendar', { params: { month, source }, signal })).data,
  create: async (event: CalendarEventInput): Promise<CalendarEvent> => (await api.post('/calendar/events', event)).data,
  update: async (id: string, event: CalendarEventInput): Promise<CalendarEvent> =>
    (await api.put(`/calendar/events/${encodeURIComponent(id)}`, event)).data,
  remove: async (id: string, version: number): Promise<void> => {
    await api.delete(`/calendar/events/${encodeURIComponent(id)}`, { params: { version } });
  },
};
