import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { FormModal } from '@/components/ui/modal/FormModal';
import { FormField, Input } from '@/components/ui/form/ResponsiveForm';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { TimePicker } from '@/components/ui/datetime-picker';
import type { DigestMode, NotificationPolicyDetail, RecipientRule, UpdateNotificationPolicyPayload } from '@/services/api/notificationPolicy';
import type { RecipientRuleKind } from '@/services/api/notificationAdministration';
import { RecipientRulesEditor } from './RecipientRulesEditor';
import { RecipientsMatrix } from './RecipientsMatrix';
import { tr } from "@/i18n";

/** What an administrator decides about the delivery of a notification: whether it is sent, on which channels, to whom, and when. */
export interface DeliveryForm {
  enabled: boolean;
  channels: string[];
  rules: RecipientRule[];
  digest: DigestMode;
  quietStart: string;
  quietEnd: string;
  escalate: boolean;
  escalateMinutes: string;
  escalationRules: RecipientRule[];
  /** LOW, MEDIUM or HIGH (or CRITICAL when that is the default of the event): how important the notification is. */
  priority: string;
}

export const EMPTY_DELIVERY: DeliveryForm = {
  enabled: true, channels: [], rules: [], digest: 'IMMEDIATE', quietStart: '', quietEnd: '', escalate: false, escalateMinutes: '', escalationRules: [], priority: 'MEDIUM',
};

const channelsOf = (value: string | null | undefined) => (value ?? '').split(',').map((c) => c.trim().toUpperCase()).filter(Boolean);

export const deliveryOf = (detail: NotificationPolicyDetail): DeliveryForm => ({
  enabled: detail.policyStatus === 'ACTIVE',
  channels: channelsOf(detail.enabledChannels),
  rules: detail.recipientRules ?? [],
  digest: detail.digestMode,
  quietStart: detail.quietHoursStart ?? '',
  quietEnd: detail.quietHoursEnd ?? '',
  escalate: detail.escalationEnabled,
  escalateMinutes: detail.escalationAfterMinutes == null ? '' : String(detail.escalationAfterMinutes),
  escalationRules: detail.escalationRecipientRules ?? [],
  priority: detail.priority,
});

const sameList = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export const deliveryDirty = (saved: DeliveryForm, form: DeliveryForm) => !sameList(saved, form);

/** Only what changed, so that a change of the recipients does not rewrite the channels, and the audit trail names exactly what the administrator touched. */
export const deliveryChanges = (saved: DeliveryForm, form: DeliveryForm): UpdateNotificationPolicyPayload => {
  const changes: UpdateNotificationPolicyPayload = {};
  if (saved.enabled !== form.enabled) changes.status = form.enabled ? 'ACTIVE' : 'DISABLED';
  if (!sameList(saved.channels, form.channels)) changes.enabledChannels = form.channels;
  if (!sameList(saved.rules, form.rules)) changes.recipientRules = form.rules;
  if (saved.digest !== form.digest) changes.digestMode = form.digest;
  if (saved.priority !== form.priority) changes.priority = form.priority;
  if (saved.quietStart !== form.quietStart || saved.quietEnd !== form.quietEnd) {
    changes.quietHoursStart = form.quietStart;
    changes.quietHoursEnd = form.quietEnd;
  }
  if (saved.escalate !== form.escalate) changes.escalationEnabled = form.escalate;
  if (form.escalate && saved.escalateMinutes !== form.escalateMinutes) changes.escalationAfterMinutes = Number(form.escalateMinutes);
  if (form.escalate && !sameList(saved.escalationRules, form.escalationRules)) changes.escalationRecipientRules = form.escalationRules;
  return changes;
};

/** What stops it being saved, in words; empty when it can be. */
export const deliveryProblem = (form: DeliveryForm): string => {
  if (form.enabled && form.channels.length === 0) return 'Choose at least one channel, or switch the notification off.';
  if (form.enabled && form.rules.length === 0) return 'Add at least one recipient, or switch the notification off.';
  if (form.rules.some((rule) => rule.channels && rule.channels.length === 0)) return 'Every recipient needs at least one channel. Tick one, or remove the recipient.';
  if (Boolean(form.quietStart) !== Boolean(form.quietEnd)) return 'Quiet hours need both a start and an end.';
  if (form.escalate) {
    const minutes = Number(form.escalateMinutes);
    if (!form.escalateMinutes || !Number.isInteger(minutes) || minutes < 1) return 'Escalation needs the number of minutes to wait (a whole number, at least 1).';
    if (form.escalationRules.length === 0) return 'Escalation needs at least one person to escalate to.';
  }
  return '';
};

/** Whether the notification is sent on a channel: the policy is on and sends on it. */
export const channelOn = (form: DeliveryForm, channel: string) => form.enabled && form.channels.includes(channel);

/**
 * Turns one channel on or off without touching the other. The notification as a whole is switched off only when its last channel is turned off, and switched on
 * again with just the channel that was turned on.
 */
export const withChannel = (form: DeliveryForm, channel: string, on: boolean, supported: string[]): DeliveryForm => {
  if (on) {
    const channels = form.enabled ? supported.filter((c) => c === channel || form.channels.includes(c)) : [channel];
    return { ...form, enabled: true, channels };
  }
  const remaining = form.channels.filter((c) => c !== channel);
  return remaining.length > 0 && form.enabled ? { ...form, channels: remaining } : { ...form, enabled: false };
};

const DIGEST_OPTIONS = [
  { value: 'IMMEDIATE', label: tr('Immediately') },
  { value: 'DAILY_DIGEST', label: tr('Daily digest') },
  { value: 'WEEKLY_DIGEST', label: tr('Weekly digest') },
];

interface Props {
  /** The channel of the screen: it shows and changes only what belongs to that channel. */
  channel: 'IN_APP' | 'EMAIL';
  form: DeliveryForm;
  onChange: (next: DeliveryForm) => void;
  supportedChannels: string[];
  kinds: RecipientRuleKind[];
  disabled?: boolean;
  /** A line under which the settings start: what this part is for. */
  intro?: string;
}

const CHANNEL_WORDS: Record<'IN_APP' | 'EMAIL', { name: string; on: string; off: string }> = {
  IN_APP: { name: 'Send in-app notification', on: 'It is shown in the bell and on the notifications page when the event happens.', off: 'It is switched off: nobody gets it in the application.' },
  EMAIL: { name: 'Send email', on: 'It is sent by email when the event happens.', off: 'It is switched off: nobody gets it by email.' },
};

export const DeliverySettings: React.FC<Props> = ({ channel, form, onChange, supportedChannels, kinds, disabled, intro }) => {
  const set = (patch: Partial<DeliveryForm>) => onChange({ ...form, ...patch });
  const on = channelOn(form, channel);
  const words = CHANNEL_WORDS[channel];
  // the timing, the quiet hours and the escalation are rarely touched: they are in a window of their own, so that opening them never moves the screen
  const [advanced, setAdvanced] = useState(false);
  const summary =
    channel === 'EMAIL'
      ? `${DIGEST_OPTIONS.find((o) => o.value === form.digest)?.label ?? 'Immediately'}${form.quietStart && form.quietEnd ? `, quiet ${form.quietStart} to ${form.quietEnd}` : tr(', no quiet hours')}`
      : form.escalate
        ? `Escalates after ${form.escalateMinutes || '…'} minutes to ${form.escalationRules.length} ${form.escalationRules.length === 1 ? 'group' : 'groups'}`
        : tr('No escalation');
  const channelsOn = supportedChannels.filter((c) => channelOn(form, c));
  return (
    <div className="flex flex-col gap-4 md:gap-5">
      {intro ? <p className="text-sm text-slate-600">{intro}</p> : null}

      {/* the settings of the notification on the left, who gets it on the right (the table has the width): one under the other on a narrow screen */}
      <div className="grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4 self-start">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800">{words.name}</p>
              <p className="text-xs text-slate-500">{on ? words.on : words.off}</p>
            </div>
            <Switch className="shrink-0" checked={on} onChange={(next) => onChange(withChannel(form, channel, next, supportedChannels))} disabled={disabled} aria-label={words.name} />
          </div>

          <button
            type="button"
            onClick={() => setAdvanced(true)}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left hover:bg-slate-50"
          >
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-800">{tr("Advanced")}</span>
              <span className="block text-xs text-slate-500 [overflow-wrap:anywhere]">
                {channel === 'EMAIL' ? tr('When the email is sent: timing and quiet hours.') : tr('Escalate the notification when it is not acted on.')} {summary}.
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
          </button>
        </div>

        <div className="min-w-0">
          <p className="mb-2 text-sm font-medium text-slate-800">{tr("Who gets this notification, and on which channel")}</p>
          <RecipientsMatrix kinds={kinds} value={form.rules} onChange={(rules) => set({ rules })} supportedChannels={supportedChannels} channelsOn={channelsOn} disabled={disabled} />
          <p className="mt-2 text-xs text-slate-500">{tr("The same list is shown on the in-app and on the email screen of this event.")}</p>
        </div>
      </div>

      <FormModal
        isOpen={advanced}
        onClose={() => setAdvanced(false)}
        onConfirm={() => setAdvanced(false)}
        title={channel === 'EMAIL' ? tr('Advanced: when the email is sent') : tr('Advanced: escalation')}
        description={tr("What you change here is part of this notification and is saved with Publish.")}
        confirmText="Done"
        showCancel={false}
        size="lg"
      >
        <div className="flex flex-col gap-4">
          {channel === 'EMAIL' ? (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <FormField label={tr("Email timing")}>
                  <Select value={form.digest} onChange={(digest: DigestMode) => set({ digest })} options={DIGEST_OPTIONS} disabled={disabled} aria-label={tr("Email timing")} />
                </FormField>
                <FormField label={tr("Quiet hours start")}>
                  <TimePicker value={form.quietStart} onChange={(quietStart) => set({ quietStart })} placeholder={tr("None")} disabled={disabled} />
                </FormField>
                <FormField label={tr("Quiet hours end")}>
                  <TimePicker value={form.quietEnd} onChange={(quietEnd) => set({ quietEnd })} placeholder={tr("None")} disabled={disabled} />
                </FormField>
              </div>
              <p className="-mt-2 text-xs text-slate-500">{tr("Timing and quiet hours hold back the email; a digest groups the emails of a person into one.")}</p>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">{tr("Escalate when it is not acted on")}</p>
                  <p className="text-xs text-slate-500">{tr("Tell more people when the notification stays unread.")}</p>
                </div>
                <Switch checked={form.escalate} onChange={(escalate) => set({ escalate })} disabled={disabled} aria-label={tr("Escalate when it is not acted on")} />
              </div>
              {form.escalate ? (
                <>
                  <FormField label={tr("Escalate after (minutes)")}>
                    <Input type="number" min={1} value={form.escalateMinutes} disabled={disabled} onChange={(e) => set({ escalateMinutes: e.target.value })} />
                  </FormField>
                  <FormField label={tr("Escalate to")}>
                    <RecipientRulesEditor kinds={kinds.filter((k) => k.kind === 'AUDIENCE')} value={form.escalationRules} onChange={(escalationRules) => set({ escalationRules })} disabled={disabled} />
                  </FormField>
                </>
              ) : null}
            </>
          )}
        </div>
      </FormModal>
    </div>
  );
};
