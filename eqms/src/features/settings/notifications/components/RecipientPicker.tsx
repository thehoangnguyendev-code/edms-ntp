import React, { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button/Button';
import { Select } from '@/components/ui/select';
import type { RecipientRule } from '@/services/api/notificationPolicy';
import { notificationAdministrationApi, type RecipientChoice, type RecipientRuleKind } from '@/services/api/notificationAdministration';
import { tr } from "@/i18n";

export const sameRule = (a: RecipientRule, b: RecipientRule) => a.type === b.type && (a.value ?? '').trim().toLowerCase() === (b.value ?? '').trim().toLowerCase();

interface Props {
  kinds: RecipientRuleKind[];
  /** The rules already in the list: one that is there cannot be added again. */
  existing: RecipientRule[];
  onAdd: (rule: RecipientRule) => void;
  disabled?: boolean;
}

/**
 * Adds one kind of recipient. The kinds are put in two groups in words a person understands: the people of the record the notification is about (the author, the
 * reviewer, the requester…), and groups of people of the system. A group that needs one more word (a permission, a role, a department) is chosen from the list the
 * server gives, shown by its name, so that nobody types a code.
 */
export const RecipientPicker: React.FC<Props> = ({ kinds, existing, onAdd, disabled }) => {
  const [type, setType] = useState('');
  const [value, setValue] = useState('');
  const [choices, setChoices] = useState<RecipientChoice[] | null>(null);
  const kind = useMemo(() => kinds.find((k) => k.type === type), [kinds, type]);

  useEffect(() => {
    setValue('');
    setChoices(null);
    if (!kind?.needsValue) return;
    let live = true;
    notificationAdministrationApi
      .recipientValues(kind.type)
      .then((list) => live && setChoices(list))
      .catch(() => live && setChoices([]));
    return () => {
      live = false;
    };
  }, [kind]);

  const groups = useMemo(
    () => [
      { groupLabel: 'People of the record', options: kinds.filter((k) => k.kind === 'CONTEXT').map((k) => ({ value: k.type, label: k.label })) },
      { groupLabel: 'Groups of people', options: kinds.filter((k) => k.kind === 'AUDIENCE').map((k) => ({ value: k.type, label: k.label })) },
    ].filter((g) => g.options.length > 0),
    [kinds],
  );
  const valueOptions = useMemo(() => (choices ?? []).map((c) => ({ value: c.value, label: c.label })), [choices]);

  const candidate: RecipientRule | null = kind ? (kind.needsValue ? (value ? { type: kind.type, value } : null) : { type: kind.type }) : null;
  const repeated = candidate ? existing.some((rule) => sameRule(rule, candidate)) : false;

  const add = () => {
    if (!candidate || repeated) return;
    onAdd(candidate);
    setType('');
  };

  if (disabled) return null;
  return (
    <div className="flex flex-col gap-2">
      {/* wraps by itself: the picker sits in a card that is half the screen wide on a large screen and the whole of it on a phone */}
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-[12rem] flex-1 basis-56">
          <Select value={type} onChange={(next: string) => setType(next)} groups={groups} options={[]} placeholder={tr("Add who gets it…")} aria-label={tr("Kind of recipient")} />
        </div>
        {kind?.needsValue ? (
          <div className="min-w-[12rem] flex-1 basis-56">
          <Select
            value={value}
            onChange={(next: string) => setValue(next)}
            options={valueOptions}
            enableSearch
            isLoading={choices === null}
            placeholder={`Choose: ${(kind.valueLabel ?? 'value').toLowerCase()}`}
            searchPlaceholder={tr("Search…")}
            aria-label={kind.valueLabel ?? 'Value'}
          />
          </div>
        ) : kind?.description ? (
          <p className="w-full py-1 text-xs text-slate-500 sm:order-last">{kind.description}</p>
        ) : null}
        <Button size="sm" variant="outline-emerald" disabled={!candidate || repeated} onClick={add}>
          <Plus className="mr-1.5 h-4 w-4" />
          {tr("Add")}
        </Button>
      </div>
      {repeated ? <p className="text-xs text-amber-700">{tr("This recipient is already in the list.")}</p> : null}
    </div>
  );
};
