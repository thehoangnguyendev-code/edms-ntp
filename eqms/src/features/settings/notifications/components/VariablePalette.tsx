import React, { useMemo } from 'react';
import { Braces, Copy, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge/Badge';
import { useToast } from '@/components/ui/toast/Toast';
import { FormSection } from '@/components/ui/form/FormSection';
import { LocalListTable, type LocalColumn } from '@/features/backup-restore/components/LocalListTable';
import type { NotificationVariable } from '@/services/api/notificationPolicy';
import { moduleDisplayName } from '@/utils/moduleDisplay';

interface VariablePaletteProps {
  /** The placeholders this notification offers: the ones its wording may use. */
  variables: NotificationVariable[];
  /** Puts the token in the field the person is writing in. */
  onInsert: (token: string) => void;
  /** Where a click on a placeholder goes now, for example "Email message". */
  target?: string;
  loading?: boolean;
  /** Every other placeholder of the system: shown to be copied, not offered by this notification, so they cannot be put in its wording. */
  others?: NotificationVariable[];
  /** Without the card and its heading: the palette is the panel of a tab. */
  bare?: boolean;
}

const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // an older browser or a page without the right to the clipboard: the text is selected in a hidden box and copied the old way
    const box = document.createElement('textarea');
    box.value = text;
    box.style.position = 'fixed';
    box.style.opacity = '0';
    document.body.appendChild(box);
    box.select();
    const ok = document.execCommand?.('copy') ?? false;
    document.body.removeChild(box);
    return ok;
  }
};

interface Row {
  variable: NotificationVariable;
  offered: boolean;
}

/**
 * Every placeholder in one searchable, sortable, paged table: what it stands for, an example, the module it belongs to and whether this notification offers it.
 * The ones the notification offers come first and can be put in its wording (Insert) or copied; the rest of the system's placeholders follow, to be copied only,
 * because the sender of this notification has no value for them.
 */
export const VariablePalette: React.FC<VariablePaletteProps> = ({ variables, onInsert, target, loading, others = [], bare }) => {
  const { showToast } = useToast();

  const rows = useMemo<Row[]>(() => [...variables.map((variable) => ({ variable, offered: true })), ...[...others].sort((a, b) => (a.module || 'Other').localeCompare(b.module || 'Other') || a.name.localeCompare(b.name)).map((variable) => ({ variable, offered: false }))], [variables, others]);

  const copy = async (token: string) => {
    const ok = await copyText(token);
    showToast({ type: ok ? 'success' : 'error', title: ok ? 'Copied' : 'Not copied', message: ok ? `${token} is on the clipboard.` : 'Select the placeholder and copy it by hand.' });
  };

  const columns: LocalColumn<Row>[] = [
    {
      id: 'token',
      header: 'Placeholder',
      sortValue: (r) => r.variable.name,
      cell: (r) => <code className={`rounded px-1.5 py-0.5 font-mono text-xs ${r.offered ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{r.variable.token}</code>,
    },
    { id: 'label', header: 'Meaning', sortValue: (r) => r.variable.label, cell: (r) => r.variable.label },
    {
      id: 'sample',
      header: 'Example',
      sortValue: (r) => r.variable.sample,
      cell: (r) => (
        <span className="block max-w-56 truncate" title={r.variable.sample}>
          {r.variable.sample}
        </span>
      ),
    },
    { id: 'module', header: 'Module', sortValue: (r) => r.variable.module || 'Other', cell: (r) => (r.variable.module ? moduleDisplayName(r.variable.module) : 'Other') },
    {
      id: 'offered',
      header: 'This Notification',
      sortValue: (r) => (r.offered ? 0 : 1),
      cell: (r) => (
        <Badge semantic={r.offered ? 'success' : undefined} color={r.offered ? undefined : 'slate'}>
          {r.offered ? 'Offered' : 'Not offered'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: 'Action',
      cell: (r) => (
        <div className="flex items-center gap-1">
          {r.offered ? (
            <button type="button" aria-label={`Insert ${r.variable.token}`} title="Insert" onMouseDown={(e) => e.preventDefault()} onClick={() => onInsert(r.variable.token)} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-emerald-50 hover:text-emerald-700">
              <Plus className="h-4 w-4" />
            </button>
          ) : null}
          <button type="button" aria-label={`Copy ${r.variable.token}`} title="Copy" onClick={() => void copy(r.variable.token)} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700">
            <Copy className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  const content = (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Click + to put a placeholder{' '}
        {target ? (
          <>
            in <b>{target}</b>
          </>
        ) : (
          'where the cursor is'
        )}
        , or copy it. A placeholder this notification does not offer cannot be used in its wording: its sender has no value for it.
      </p>
      {loading ? (
        <p className="py-4 text-sm text-slate-500">Loading placeholders…</p>
      ) : (
        <>
          {variables.length === 0 ? <p className="text-sm text-slate-500">This notification offers no placeholders.</p> : null}
          <LocalListTable
            rows={rows}
            getRowKey={(r) => `${r.offered ? 'o' : 'x'}:${r.variable.name}`}
            columns={columns}
            searchText={(r) => [r.variable.name, r.variable.token, r.variable.label, r.variable.sample, r.variable.module ?? '', r.offered ? 'offered' : 'not offered'].join(' ')}
            searchLabel="Search placeholders"
            searchPlaceholder="Search a placeholder by its name, meaning, example or module…"
            emptyTitle="No Placeholders"
            emptyDescription="There is no placeholder to show."
          />
        </>
      )}
    </div>
  );

  if (bare) return content;
  return (
    <FormSection title="Placeholders" icon={<Braces className="h-4 w-4" />} description="Each one is replaced by real information when the message is sent.">
      {content}
    </FormSection>
  );
};
