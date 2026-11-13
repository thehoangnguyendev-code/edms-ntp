import React, { useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox/Checkbox';
import { FormModal } from '@/components/ui/modal/FormModal';
import { DataTable, TableEmptyState, type DataTableColumn } from '@/components/ui/table';
import { useDebounce } from '@/hooks';
import type { RecipientRule } from '@/services/api/notificationPolicy';
import { notificationAdministrationApi, type RecipientPreview, type RecipientRuleKind, type RecipientRuleView } from '@/services/api/notificationAdministration';
import { RecipientPicker } from './RecipientPicker';

const CHANNEL_NAME: Record<string, string> = { IN_APP: 'In-app', EMAIL: 'Email' };

/** How many names are shown before "Show all". */
const NAMES_SHOWN = 3;

/** The channels a recipient is reached on: the ones it names (none at all while the person is still choosing), or every channel of the event when it names none. */
export const channelsOfRule = (rule: RecipientRule, supported: string[]) => (rule.channels ? rule.channels.filter((c) => supported.includes(c)) : supported);

interface Props {
  kinds: RecipientRuleKind[];
  value: RecipientRule[];
  onChange: (rules: RecipientRule[]) => void;
  /** The channels this event can be sent on (a column each). */
  supportedChannels: string[];
  /** The channels that are switched on for the event: the column of a channel that is off says so. */
  channelsOn: string[];
  disabled?: boolean;
}

interface Row {
  rule: RecipientRule;
  index: number;
}

/**
 * Who one recipient is today: how many people and the first names. The others are in a window that opens on request, so that a row never grows and the screen does
 * not move under the hands of the person. The people the module names are described in words.
 */
const Who: React.FC<{ named: boolean; description: string; view?: RecipientRuleView; onShowAll: () => void }> = ({ named, description, view, onShowAll }) => {
  if (named) return <p className="text-xs text-slate-500">{description}</p>;
  if (!view) return null;
  if (view.people === 0) return <p className="text-xs text-slate-500">Nobody holds this today.</p>;
  const noun = view.people === 1 ? 'person' : 'people';
  const hidden = view.people - NAMES_SHOWN;
  return (
    <p className="text-xs text-slate-500 [overflow-wrap:anywhere]">
      {view.people} {noun} today: {view.names.slice(0, NAMES_SHOWN).join(', ')}
      {hidden > 0 ? (
        <>
          {' '}and {hidden} more{' '}
          <button type="button" className="font-medium text-emerald-700 hover:underline" onClick={onShowAll}>
            Show all
          </button>
        </>
      ) : null}
    </p>
  );
};

/**
 * "Who gets this notification, and on which channel": a table with a row for each kind of recipient, who that is today, and a tick for each channel. The cells
 * of the name and of the people wrap, so a long name of a group or a long list of names never makes the table wider than its place.
 */
export const RecipientsMatrix: React.FC<Props> = ({ kinds, value, onChange, supportedChannels, channelsOn, disabled }) => {
  const [preview, setPreview] = useState<RecipientPreview | null>(null);
  // the recipient whose people are listed in the window
  const [listed, setListed] = useState<number | null>(null);
  const key = useDebounce(JSON.stringify(value), 400);

  useEffect(() => {
    let live = true;
    const rules = JSON.parse(key) as RecipientRule[];
    if (rules.length === 0) {
      setPreview(null);
      return;
    }
    notificationAdministrationApi
      .recipientPreview(rules)
      .then((result) => live && setPreview(result))
      .catch(() => live && setPreview(null));
    return () => {
      live = false;
    };
  }, [key]);

  const kindOf = (rule: RecipientRule) => kinds.find((k) => k.type === rule.type);
  const nameOf = (rule: RecipientRule, index: number) => {
    const label = kindOf(rule)?.label ?? rule.type;
    const valueLabel = preview?.rules[index]?.valueLabel || rule.value;
    return valueLabel ? `${label}: ${valueLabel}` : label;
  };
  const rows = useMemo<Row[]>(() => value.map((rule, index) => ({ rule, index })), [value]);

  const toggle = (index: number, channel: string, on: boolean) => {
    onChange(
      value.map((rule, i) => {
        if (i !== index) return rule;
        const current = channelsOfRule(rule, supportedChannels);
        const next = supportedChannels.filter((c) => (c === channel ? on : current.includes(c)));
        // every channel of the event is the default: the rule then names none, so a channel added to the event later reaches this recipient too
        if (next.length === supportedChannels.length) {
          const { channels: _unused, ...plain } = rule;
          return plain;
        }
        return { ...rule, channels: next };
      }),
    );
  };

  const columns: DataTableColumn<Row>[] = [
    {
      id: 'recipient',
      header: 'Who Gets It',
      cell: (row) => <div className="min-w-48 max-w-xs whitespace-normal text-sm font-medium text-slate-900 [overflow-wrap:anywhere]">{nameOf(row.rule, row.index)}</div>,
    },
    {
      id: 'people',
      header: 'People Today',
      cell: (row) => (
        <div className="min-w-56 max-w-md whitespace-normal">
          <Who named={kindOf(row.rule)?.kind === 'CONTEXT'} description={kindOf(row.rule)?.description ?? ''} view={preview?.rules[row.index]} onShowAll={() => setListed(row.index)} />
        </div>
      ),
    },
    ...supportedChannels.map<DataTableColumn<Row>>((channel) => ({
      id: channel,
      header: channelsOn.includes(channel) ? CHANNEL_NAME[channel] : `${CHANNEL_NAME[channel]} (off)`,
      cell: (row) => (
        <Checkbox
          checked={channelsOfRule(row.rule, supportedChannels).includes(channel)}
          onChange={(on) => toggle(row.index, channel, on)}
          disabled={disabled}
          aria-label={`${nameOf(row.rule, row.index).replace(': ', ' ')}: ${CHANNEL_NAME[channel]}`}
        />
      ),
    })),
    {
      id: 'remove',
      header: '',
      cell: (row) =>
        disabled ? null : (
          <button
            type="button"
            aria-label={`Remove ${kindOf(row.rule)?.label ?? row.rule.type}${row.rule.value ? ` ${row.rule.value}` : ''}`}
            title="Remove"
            className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
            onClick={() => onChange(value.filter((_, i) => i !== row.index))}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ),
    },
  ];

  const noChannel = value.some((rule) => channelsOfRule(rule, supportedChannels).length === 0);
  const named = value.some((rule) => kindOf(rule)?.kind === 'CONTEXT');

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <DataTable
          rows={rows}
          columns={columns}
          getRowKey={(row) => `${row.rule.type}|${row.rule.value ?? ''}`}
          emptyState={<TableEmptyState title="Nobody Yet" description="Add at least one recipient, or switch the notification off." />}
        />
      </div>
      {noChannel ? <p className="text-xs text-red-600">A recipient needs at least one channel. Tick one, or remove the recipient.</p> : null}
      <RecipientPicker kinds={kinds} existing={value} onAdd={(rule) => onChange([...value, rule])} disabled={disabled} />
      {preview && value.length > 0 ? (
        <p className="text-xs text-slate-600" aria-label="Who it reaches today">
          Today this reaches{' '}
          {supportedChannels.map((c) => `${c === 'IN_APP' ? preview.inAppPeople : preview.emailPeople} ${(c === 'IN_APP' ? preview.inAppPeople : preview.emailPeople) === 1 ? 'person' : 'people'} by ${CHANNEL_NAME[c].toLowerCase()}`).join(' and ')}
          {named ? ', plus the people the module names when it happens' : ''}.
        </p>
      ) : null}
      <FormModal
        isOpen={listed !== null && Boolean(value[listed])}
        onClose={() => setListed(null)}
        onConfirm={() => setListed(null)}
        title="Who gets it today"
        description={listed !== null && value[listed] ? nameOf(value[listed], listed) : undefined}
        confirmText="Close"
        showCancel={false}
        size="md"
      >
        {listed !== null && preview?.rules[listed] ? (
          <div>
            <p className="text-sm text-slate-600">
              {preview.rules[listed].people} {preview.rules[listed].people === 1 ? 'person' : 'people'} today. Anyone added later to this group is reached without changing this list.
            </p>
            <ul className="mt-3 flex max-h-[50vh] flex-wrap gap-1.5 overflow-y-auto" aria-label="People">
              {preview.rules[listed].names.map((name, index) => (
                <li key={`${name}-${index}`} className="max-w-full rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700 [overflow-wrap:anywhere]">
                  {name}
                </li>
              ))}
            </ul>
            {preview.rules[listed].people > preview.rules[listed].names.length ? (
              <p className="mt-2 text-xs text-slate-500">and {preview.rules[listed].people - preview.rules[listed].names.length} more not listed here.</p>
            ) : null}
          </div>
        ) : null}
      </FormModal>
    </div>
  );
};
