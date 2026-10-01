import React, { useState } from 'react';
import { FormModal } from '@/components/ui/modal/FormModal';
import { FormField, Input, Textarea, FormGrid } from '@/components/ui/form/ResponsiveForm';
import { Checkbox } from '@/components/ui/checkbox';
import { DateTimePicker } from '@/components/ui/datetime-picker/DateTimePicker';
import { calendarApi, type CalendarEvent } from '@/services/api/calendar';
import { getApiErrorMessage } from '@/utils/apiError';
import { inclusiveEnd, localToPicker, pickerToLocal } from './calendarFormatting';

interface Props { event?: CalendarEvent; date: string; onClose: () => void; onSaved: () => void }
export const CalendarEventModal: React.FC<Props> = ({ event, date, onClose, onSaved }) => {
  const [title, setTitle] = useState(event?.title ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [allDay, setAllDay] = useState(event?.allDay ?? true);
  const [start, setStart] = useState(event?.start ?? `${date}T00:00:00`);
  const [end, setEnd] = useState(event ? inclusiveEnd(event.end, event.allDay) : `${date}T00:00:00`);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    if (saving) return;
    setSaving(true); setError('');
    try {
      const input = { title, description, start, end, allDay, ...(event ? { version: event.version! } : {}) };
      if (event) await calendarApi.update(event.id, input); else await calendarApi.create(input);
      onSaved();
    } catch (reason) { setError(getApiErrorMessage(reason, 'Unable to save event.')); }
    finally { setSaving(false); }
  };
  return <FormModal isOpen onClose={() => { if (!saving) onClose(); }} title={event ? 'Edit Personal Event' : 'New Personal Event'}
    description="Only you can view and manage this event." onConfirm={() => void save()} confirmText="Save Event"
    isLoading={saving} confirmDisabled={!title.trim() || !start || !end} size="xl">
    <form className="space-y-4" onSubmit={e => { e.preventDefault(); void save(); }}>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <FormField label="Title" required><Input value={title} onChange={e => setTitle(e.target.value)} maxLength={200} disabled={saving} /></FormField>
      <Checkbox label="All-day event" checked={allDay} onChange={setAllDay} disabled={saving} />
      <FormGrid columns={2}>
        <DateTimePicker label="Start" value={localToPicker(start, allDay)} onChange={v => setStart(pickerToLocal(v))} showTime={!allDay} disabled={saving} />
        <DateTimePicker label="End" value={localToPicker(end, allDay)} onChange={v => setEnd(pickerToLocal(v))} showTime={!allDay} disabled={saving} />
      </FormGrid>
      <FormField label="Description"><Textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={4000} rows={3} disabled={saving} /></FormField>
      <p className="text-xs text-slate-500">Personal event times use the calendar’s local time. All-day end dates are inclusive.</p>
    </form>
  </FormModal>;
};
