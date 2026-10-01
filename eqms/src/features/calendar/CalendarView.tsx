import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, RefreshCw, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { PageHeader } from '@/components/ui/page/PageHeader';
import { Card } from '@/components/ui/card/ResponsiveCard';
import { Button } from '@/components/ui/button';
import { Badge, type BadgeColor } from '@/components/ui/badge/Badge';
import { Select } from '@/components/ui/select';
import { FormModal } from '@/components/ui/modal/FormModal';
import { AlertModal } from '@/components/ui/modal/AlertModal';
import { SectionLoading } from '@/components/ui/loading/Loading';
import { useAuth } from '@/contexts/AuthContext';
import { calendarApi, type CalendarEvent, type CalendarMonth, type CalendarSource } from '@/services/api/calendar';
import { getApiErrorMessage } from '@/utils/apiError';
import { useEntityChanged } from '@/features/realtime/useEntityChanged';
import { subscribeNotificationRealtime } from '@/features/notifications/notificationRealtime';
import { CalendarEventModal } from './CalendarEventModal';
import { CalendarDayDrawer } from './CalendarDayDrawer';
import { dayLabel, inclusiveEnd, localToPicker } from './calendarFormatting';
import styles from './CalendarView.module.css';

const SOURCE_LABEL = { EQMS: 'EQMS', NOTIFICATION: 'Notifications', PERSONAL: 'Personal' };
const SOURCE_COLOR: Record<CalendarEvent['source'], BadgeColor> = { EQMS: 'blue', NOTIFICATION: 'amber', PERSONAL: 'emerald' };

export const CalendarView: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [month, setMonth] = useState<string>();
  const [source, setSource] = useState<CalendarSource>('ALL');
  const [data, setData] = useState<CalendarMonth>();
  const [dataOwner, setDataOwner] = useState<string>();
  const [selected, setSelected] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [editor, setEditor] = useState<{ date: string; event?: CalendarEvent }>();
  const [detail, setDetail] = useState<CalendarEvent>();
  const [pendingDetail, setPendingDetail] = useState<CalendarEvent>();
  const [deleting, setDeleting] = useState<CalendarEvent>();
  const [busy, setBusy] = useState(false);
  const reload = useCallback(() => setRefresh(value => value + 1), []);
  const owner = useRef(user?.id);
  useEffect(() => {
    if (owner.current !== user?.id) {
      owner.current = user?.id; setData(undefined); setSelected(''); setMonth(undefined);
      setDetail(undefined); setEditor(undefined); setDeleting(undefined);
      setDrawerOpen(false);
      setPendingDetail(undefined);
    }
  }, [user?.id]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    calendarApi.month(month, source, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      setData(result);
      setDataOwner(user?.id);
      setSelected(value => result.days.some(day => day.date === value) ? value :
        result.days.find(day => day.today && day.inMonth)?.date ?? result.days.find(day => day.inMonth)!.date);
    }).catch(reason => { if (!controller.signal.aborted) setError(getApiErrorMessage(reason, 'Unable to load calendar.')); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [month, source, refresh, user?.id]);
  useEntityChanged(['DOCUMENT', 'REVISION'], reload);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeNotificationRealtime(event => {
      if (!['notification-updated', 'branding-updated'].includes(event.type)) return;
      clearTimeout(timer); timer = setTimeout(reload, 500);
    });
    return () => { unsubscribe(); clearTimeout(timer); };
  }, [reload]);
  const visibleData = dataOwner === user?.id ? data : undefined;
  const sameOwner = owner.current === user?.id;
  const day = visibleData?.days.find(item => item.date === selected);
  const remove = async () => {
    if (!deleting || busy) return;
    setBusy(true);
    try {
      await calendarApi.remove(deleting.id, deleting.version!);
      setDeleting(undefined); setDetail(undefined); reload();
    } catch (reason) { setError(getApiErrorMessage(reason, 'Unable to delete event.')); setDeleting(undefined); }
    finally { setBusy(false); }
  };
  return <div className="flex w-full min-w-0 flex-1 flex-col space-y-4 md:space-y-6">
    <PageHeader title="Calendar" breadcrumbItems={[{ label: 'Calendar', isActive: true }]}
      actions={<Button size="sm" className="gap-2 bg-emerald-700 hover:bg-emerald-800" onClick={() => { if (visibleData) setEditor({ date: selected || visibleData.today }); }} disabled={!visibleData || loading}>
        <Plus className="h-4 w-4" />New Event</Button>} />
    <Card padding="none" className={styles.container}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4 md:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-2 text-base font-semibold text-slate-900">{visibleData?.label ?? 'Calendar'}</h2>
          <Button variant="outline" size="sm" className="hover:bg-slate-100" disabled={loading} onClick={() => { setMonth(visibleData?.currentMonth); setSelected(visibleData?.today ?? ''); reload(); }}>Today</Button>
          <Button variant="ghost" size="icon-sm" aria-label="Previous month" disabled={!data || loading} onClick={() => setMonth(data!.previousMonth)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon-sm" aria-label="Next month" disabled={!data || loading} onClick={() => setMonth(data!.nextMonth)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <div className="flex items-center gap-2">
          <Select value={source} onChange={value => setSource(value as CalendarSource)} enableSearch={false} className="w-40"
            options={[{ label: 'All sources', value: 'ALL' }, { label: 'EQMS', value: 'EQMS' }, { label: 'Notifications', value: 'NOTIFICATION' }, { label: 'Personal', value: 'PERSONAL' }]} />
          <Button variant="ghost" size="icon-sm" aria-label="Refresh calendar" disabled={loading} onClick={reload}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>
      {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 bg-red-50 p-4 text-sm text-red-700">
        <span>{error}</span><Button variant="outline" size="sm" onClick={reload}>Retry</Button></div>}
      {loading && !visibleData && <SectionLoading text="Loading your calendar..." />}
      {visibleData && <>
        <div className={styles.body} aria-busy={loading}>
          <div className={styles.month}>
            <div className={styles.weekdays}>{visibleData.weekdays.map(label => <div key={label}><abbr title={label}>{label.slice(0, 3)}</abbr></div>)}</div>
            <div className={styles.grid}>
              {visibleData.days.map(current => {
                const tasks = current.events.filter(event => event.category === 'TASK');
                const completed = tasks.filter(event => event.taskStatus === 'COMPLETED').length;
                const notices = current.events.filter(event => event.source === 'NOTIFICATION').length;
                return <Button key={current.date} variant="ghost" aria-label={dayLabel(current.date)} aria-pressed={selected === current.date}
                  className={`${styles.day} ${!current.inMonth ? styles.outside : ''} ${selected === current.date ? styles.selected : ''}`}
                  onClick={() => { setSelected(current.date); setDrawerOpen(true); }}>
                  <span className={`${styles.dayButton} ${current.today ? styles.today : ''}`}>{current.number}</span>
                  {tasks.length > 0 && <span className={`${styles.taskCount} ${completed === tasks.length ? styles.completed : ''}`}>
                    {completed === tasks.length ? '✓' : '●'} <span className={styles.countLabel}>{tasks.length} task{tasks.length === 1 ? '' : 's'}</span>
                    <span className={styles.mobileCount}>{tasks.length}</span>
                  </span>}
                  {notices > 0 && <span className={styles.noticeCount}><span className={styles.countLabel}>{notices} notice{notices === 1 ? '' : 's'}</span><span className={styles.mobileCount}>• {notices}</span></span>}
                  {current.events.length > tasks.length + notices && <span className={styles.eventCount}>{current.events.length - tasks.length - notices} <span className={styles.countLabel}>events</span></span>}
                </Button>;
              })}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
          <span>Only your personal events and permitted source records are shown.</span><span>Time zone: {visibleData.timeZone}</span>
        </div>
      </>}
    </Card>
    <CalendarDayDrawer key={selected + user?.id} day={day} open={sameOwner && drawerOpen && !editor && !detail && !deleting}
      onExited={() => { if (sameOwner && pendingDetail) { setDetail(pendingDetail); setPendingDetail(undefined); } }}
      onClose={() => setDrawerOpen(false)} onOpen={event => {
        setDrawerOpen(false);
        if (event.source === 'PERSONAL') setPendingDetail(event);
        else if (event.actionUrl) navigate(event.actionUrl, { state: { from: '/calendar', returnTo: '/calendar' } });
      }} />
    {sameOwner && editor && <CalendarEventModal event={editor.event} date={editor.date} onClose={() => setEditor(undefined)} onSaved={() => { setEditor(undefined); setDetail(undefined); reload(); }} />}
    {sameOwner && detail && !editor && !deleting && <FormModal isOpen onClose={() => setDetail(undefined)} title={detail.title} size="md" showFooter={false}>
      <div className="space-y-4">
        <Badge color={SOURCE_COLOR[detail.source]}>{SOURCE_LABEL[detail.source]}</Badge>
        <p className="text-sm text-slate-600">{localToPicker(detail.start, detail.allDay)} — {localToPicker(inclusiveEnd(detail.end, detail.allDay), detail.allDay)}</p>
        {detail.description && <p className="whitespace-pre-wrap break-words text-sm text-slate-700">{detail.description}</p>}
        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          {detail.source === 'PERSONAL' && detail.editable && <>
            <Button variant="outline-emerald" size="sm" className="gap-2" onClick={() => setEditor({ date: detail.start.slice(0, 10), event: detail })}><Pencil className="h-4 w-4" />Edit</Button>
            <Button variant="outline" size="sm" className="gap-2 text-red-600" onClick={() => setDeleting(detail)}><Trash2 className="h-4 w-4" />Delete</Button>
          </>}
          {detail.actionUrl && <Button variant="outline-emerald" size="sm" className="gap-2" onClick={() => navigate(detail.actionUrl!, { state: { from: '/calendar', returnTo: '/calendar' } })}>
            <ExternalLink className="h-4 w-4" />Open {detail.source === 'NOTIFICATION' ? 'Notifications' : 'Record'}</Button>}
        </div>
      </div>
    </FormModal>}
    <AlertModal isOpen={sameOwner && Boolean(deleting)} onClose={() => { if (!busy) setDeleting(undefined); }} onConfirm={() => void remove()}
      type="confirm" title="Delete Personal Event" description="Remove this event from your calendar? Source EQMS records and notifications will not be changed."
      confirmText="Delete" showCancel isLoading={busy} />
  </div>;
};
