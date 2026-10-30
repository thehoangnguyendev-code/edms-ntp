import React, { useCallback, useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { DataTable, useCustomColumnLayout, type DataTableColumn } from '@/components/ui/table/DataTable';
import { TableEmptyState } from '@/components/ui/table/TableEmptyState';
import { TablePagination } from '@/components/ui/table/TablePagination';
import { SectionLoading } from '@/components/ui/loading/Loading';
import { Badge } from '@/components/ui/badge/Badge';
import { Button } from '@/components/ui/button/Button';
import { useToast } from '@/components/ui/toast/Toast';
import { useServerTable } from '@/features/settings/shared/hooks/useServerTable';
import { ReportListToolbar, pickerDateToIso, type ReportSelectFilter } from '@/features/report/shared/ReportListToolbar';
import { usePersistedState } from '@/hooks/usePersistedState';
import { displayDateTime } from '@/utils/format';
import { notificationApi, type NotificationDeliveryFailure } from '@/services/api/notifications';

const MAX_ATTEMPTS = 5;
const STATUS_OPTIONS = [{ label: 'Failed', value: 'FAILED' }, { label: 'Resolved', value: 'RESOLVED' }];
const CHANNEL_OPTIONS = [{ label: 'Email', value: 'EMAIL' }, { label: 'In-App', value: 'IN_APP' }];

/**
 * Failed notification deliveries (email and in-app) as a table that is searched, filtered by status, channel, event domain and the date of the last attempt, sorted and paged by the server.
 * A retry reuses the saved, redacted event payload and the active template.
 */
export const DeliveryFailuresTable: React.FC = () => {
  const { showToast } = useToast();
  const [status, setStatus] = usePersistedState('notification.failures.status', '');
  const [channel, setChannel] = usePersistedState('notification.failures.channel', '');
  const [eventDomain, setEventDomain] = usePersistedState('notification.failures.domain', '');
  const [from, setFrom] = usePersistedState('notification.failures.from', '');
  const [to, setTo] = usePersistedState('notification.failures.to', '');
  const [domains, setDomains] = useState<string[]>([]);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const fetcher = useCallback(
    (params: Record<string, string | number | boolean | undefined>) => {
      void notificationApi.getDeliveryFailureEventDomains().then(setDomains).catch(() => undefined);
      return notificationApi.getDeliveryFailures(params);
    },
    [],
  );
  const extraParams = useMemo(
    () => ({ status: status || undefined, channel: channel || undefined, eventDomain: eventDomain || undefined, lastAttemptFrom: pickerDateToIso(from) || undefined, lastAttemptTo: pickerDateToIso(to) || undefined }),
    [status, channel, eventDomain, from, to],
  );
  const table = useServerTable<NotificationDeliveryFailure>({ persistKey: 'notification.failures', fetcher, defaultSortBy: 'lastAttemptAt', defaultSortDirection: 'desc', extraParams, initialItemsPerPage: 10, syncToUrl: false });
  const sorted = (key: string) => ({ direction: table.sortConfig.key === key ? table.sortConfig.direction : undefined, onSort: () => table.handleSort(key) });

  const retry = async (failure: NotificationDeliveryFailure) => {
    setRetryingId(failure.id);
    try {
      await notificationApi.retryDeliveryFailure(failure.id);
      showToast({ type: 'success', title: 'Delivery Retry Queued', message: `Retry requested for ${failure.recipient}.` });
      table.reload();
    } catch (error: any) {
      showToast({ type: 'error', title: 'Delivery Retry Failed', message: error?.response?.data?.message || 'The notification could not be retried.' });
    } finally {
      setRetryingId(null);
    }
  };

  const columns: DataTableColumn<NotificationDeliveryFailure>[] = [
    { id: 'rowNo', header: 'No.', locked: true, cell: (_r, i) => (table.currentPage - 1) * table.itemsPerPage + i + 1 },
    { id: 'recipient', header: 'Recipient', sort: sorted('recipient'), cell: (r) => <span className="block max-w-56 truncate" title={r.recipient}>{r.recipient}</span> },
    { id: 'notificationType', header: 'Type', sort: sorted('notificationType'), cell: (r) => r.notificationType },
    { id: 'eventDomain', header: 'Event Domain', sort: sorted('eventDomain'), cell: (r) => r.eventDomain || '—' },
    { id: 'channel', header: 'Channel', sort: sorted('channel'), cell: (r) => (r.channel === 'IN_APP' ? 'In-App' : 'Email') },
    { id: 'status', header: 'Status', sort: sorted('status'), cell: (r) => <Badge semantic={r.status === 'RESOLVED' ? 'success' : 'danger'}>{r.status === 'RESOLVED' ? 'Resolved' : 'Failed'}</Badge> },
    { id: 'attempts', header: 'Attempts', sort: sorted('attempts'), cell: (r) => `${r.attempts}/${MAX_ATTEMPTS}` },
    { id: 'errorMessage', header: 'Error', cell: (r) => <span className="block max-w-72 truncate" title={r.errorMessage ?? ''}>{r.errorMessage || '—'}</span> },
    { id: 'createdAt', header: 'First Failed On', sort: sorted('createdAt'), cell: (r) => displayDateTime(r.createdAt) },
    { id: 'lastAttemptAt', header: 'Last Attempt On', sort: sorted('lastAttemptAt'), cell: (r) => displayDateTime(r.lastAttemptAt) },
    {
      id: 'action',
      header: 'Action',
      cell: (r) => (
        <Button size="sm" variant="ghost" onClick={() => void retry(r)} disabled={retryingId === r.id || r.status === 'RESOLVED' || r.attempts >= MAX_ATTEMPTS} className="gap-1 text-emerald-700">
          <RotateCcw className="h-3.5 w-3.5" />Retry
        </Button>
      ),
    },
  ];
  const { layout, control } = useCustomColumnLayout('notification.failures', columns);

  const reset = (apply: (v: string) => void) => (v: string) => { apply(v); table.setCurrentPage(1); };
  const filters: ReportSelectFilter[] = [
    { id: 'status', label: 'Status', value: status, options: [{ label: 'All statuses', value: '' }, ...STATUS_OPTIONS], onChange: reset(setStatus) },
    { id: 'channel', label: 'Channel', value: channel, options: [{ label: 'All channels', value: '' }, ...CHANNEL_OPTIONS], onChange: reset(setChannel) },
    { id: 'eventDomain', label: 'Event Domain', value: eventDomain, options: [{ label: 'All event domains', value: '' }, ...domains.map((d) => ({ label: d, value: d }))], onChange: reset(setEventDomain) },
  ];

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-600 sm:text-sm">Failed deliveries are stored by the server. Retry reuses the saved, redacted event payload and the active template; a delivery is tried at most {MAX_ATTEMPTS} times.</p>
      <ReportListToolbar
        searchPlaceholder="Search by recipient, type or error…"
        search={table.searchQuery}
        onSearch={(v) => { table.setSearchQuery(v); table.setCurrentPage(1); }}
        filters={filters}
        dates={[{ id: 'lastAttempt', label: 'Last Attempt Date Range', from, to, onChange: (a, b) => { setFrom(a); setTo(b); table.setCurrentPage(1); } }]}
        hasActiveFilters={Boolean(status || channel || eventDomain || from || to || table.searchQuery)}
        onClear={() => { setStatus(''); setChannel(''); setEventDomain(''); setFrom(''); setTo(''); table.setSearchQuery(''); table.setCurrentPage(1); }}
        customControl={control}
        framed={false}
        flush
      >
        <DataTable
          rows={table.items}
          getRowKey={(r) => r.id}
          isLoading={table.isLoading}
          loadingContent={<SectionLoading text="Loading…" />}
          columns={columns}
          columnLayout={layout}
          emptyState={<TableEmptyState title="No Delivery Failures" description="No failed notification delivery matches the search or the filters." />}
          pagination={table.totalItems > 0 ? (
            <TablePagination currentPage={table.currentPage} totalPages={table.totalPages} totalItems={table.totalItems} itemsPerPage={table.itemsPerPage} onPageChange={table.setCurrentPage} onItemsPerPageChange={table.setItemsPerPage} />
          ) : undefined}
        />
      </ReportListToolbar>
    </div>
  );
};
