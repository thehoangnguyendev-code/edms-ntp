/** DateTimePicker display-format conversion only; range validation stays on the server. */
export const pickerToLocal = (value: string): string => {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?$/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}T${match[4] ?? '00'}:${match[5] ?? '00'}:00`;
  return value.length === 10 ? `${value}T00:00:00` : value;
};
export const localToPicker = (value: string, allDay: boolean): string => {
  const [date, time] = value.split('T');
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}${!allDay ? ` ${time?.slice(0, 5) ?? '00:00'}` : ''}`;
};
export const inclusiveEnd = (end: string, allDay: boolean): string => {
  if (!allDay) return end;
  const date = new Date(`${end.slice(0, 10)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return `${date.toISOString().slice(0, 10)}T00:00:00`;
};
export const dayLabel = (date: string): string => new Intl.DateTimeFormat('en', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
}).format(new Date(`${date}T00:00:00Z`));
