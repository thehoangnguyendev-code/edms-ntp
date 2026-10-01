import React, { useState } from 'react';
import { CalendarDays, CheckCircle2, ExternalLink } from 'lucide-react';
import { Drawer, type DrawerHandle } from '@/components/ui/drawer/Drawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge/Badge';
import type { CalendarDay, CalendarEvent } from '@/services/api/calendar';
import { dayLabel } from './calendarFormatting';

interface Props { day?: CalendarDay; open: boolean; onClose: () => void; onExited?: () => void; onOpen: (event: CalendarEvent) => void }
const LABELS = { TASK: 'Tasks', NOTIFICATION: 'Notifications', EVENT: 'Events' };
const STATUS = { PENDING: 'To do', WAITING: 'Waiting / not available', COMPLETED: 'Completed', UNAVAILABLE: 'No longer actionable' };
export const CalendarDayDrawer: React.FC<Props> = ({ day, open, onClose, onExited, onOpen }) => {
  const drawer = React.useRef<DrawerHandle>(null);
  const [tab, setTab] = useState<keyof typeof LABELS>('TASK');
  const category = (e: CalendarEvent) => e.category === 'TASK' ? 'TASK' : e.source === 'NOTIFICATION' ? 'NOTIFICATION' : 'EVENT';
  const entries = day?.events.filter(event => category(event) === tab) ?? [];
  return <Drawer
    ref={drawer}
    open={open && Boolean(day)}
    onClose={onClose}
    onExited={onExited}
    title={day ? dayLabel(day.date) : 'Day details'}
    subtitle="Calendar"
    icon={<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-100 bg-emerald-50"><CalendarDays className="h-4 w-4 text-emerald-600" /></span>}
    footerClassName="justify-between"
    footer={<><span className="text-xs text-slate-500">{entries.length} {LABELS[tab].toLowerCase()}</span><Button variant="outline" size="sm" className="hover:bg-slate-100" onClick={() => drawer.current?.close()}>Close</Button></>}
  >
    <div className="mb-5 grid grid-cols-3 gap-1 rounded-lg border border-slate-200 bg-white p-1" aria-label="Day categories">
      {(Object.keys(LABELS) as Array<keyof typeof LABELS>).map(key => <Button key={key} variant={tab === key ? 'secondary' : 'ghost'}
        size="sm" className={`h-auto min-h-11 min-w-0 flex-col gap-1 px-1 py-2 ${tab === key ? 'text-emerald-700' : 'text-slate-600'}`}
        aria-label={`${LABELS[key]} (${day?.events.filter(event => category(event) === key).length ?? 0})`} aria-pressed={tab === key} onClick={() => setTab(key)}>
        <span>{LABELS[key]}</span><span className="text-xs font-normal">{day?.events.filter(event => category(event) === key).length ?? 0}</span></Button>)}
    </div>
    {!entries.length && <p className="py-8 text-sm text-slate-500">No {LABELS[tab].toLowerCase()} for this day.</p>}
    <ul className="space-y-4">{entries.map(event => {
      const completed = event.taskStatus === 'COMPLETED';
      return <li key={event.id} className={`rounded-xl border p-4 ${completed ? 'border-slate-100 bg-slate-50' : 'border-slate-200 bg-white'}`}>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {event.category === 'TASK' && <Badge color={completed ? 'emerald' : event.taskStatus === 'PENDING' ? 'blue' : 'gray'}>
            <span className="inline-flex items-center gap-1">{completed && <CheckCircle2 className="h-3.5 w-3.5" />} {STATUS[event.taskStatus ?? 'WAITING']}</span>
          </Badge>}
          <span className="text-xs text-slate-500">{event.allDay ? 'All day' : event.start.slice(11, 16)}</span>
        </div>
        <h3 className={`break-words text-sm font-medium ${completed ? 'text-slate-500' : 'text-slate-900'}`}>{event.title}</h3>
        {event.description && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-500">{event.description}</p>}
        {(event.actionUrl || event.editable) && <Button variant="outline-emerald" size="sm" className="mt-4 gap-2 text-emerald-700" onClick={() => onOpen(event)}>
          <ExternalLink className="h-4 w-4" />{event.category === 'TASK' ? event.actionLabel : event.source === 'PERSONAL' ? 'View event' : event.source === 'NOTIFICATION' ? 'Open notifications' : 'View record'}
        </Button>}
      </li>;
    })}</ul>
  </Drawer>;
};
