import React from 'react';
import { Radio } from '@/components/ui/radio/Radio';
import type { GeneralConfig } from '../types';
import { tr } from "@/i18n";

interface NotificationInboxLayoutSectionProps {
  config: GeneralConfig;
  onChange: (key: 'notificationInboxLayout', value: string) => void;
}

/** A few strokes that show the shape of each look, so that the choice is made by seeing it. */
const Thumb: React.FC<{ value: 'TABS' | 'TIMELINE' }> = ({ value }) => (
  <svg viewBox="0 0 96 56" className="h-14 w-24 shrink-0 rounded-md border border-slate-200 bg-white" aria-hidden="true">
    {value === 'TABS' ? (
      <>
        <rect x="6" y="6" width="84" height="8" rx="2" fill="#f1f5f9" />
        {[10, 28, 46, 64].map((x, i) => <circle key={x} cx={x + 2} cy="10" r="1.6" fill={['#94a3b8', '#ef4444', '#f59e0b', '#10b981'][i]} />)}
        {[22, 32, 42].map((y) => (
          <g key={y}>
            <rect x="8" y={y} width="8" height="7" rx="2" fill="#e2e8f0" />
            <rect x="20" y={y + 1} width="46" height="2.4" rx="1" fill="#94a3b8" />
            <rect x="20" y={y + 4.6} width="30" height="1.8" rx="0.9" fill="#cbd5e1" />
          </g>
        ))}
      </>
    ) : (
      <>
        <line x1="14" y1="8" x2="14" y2="50" stroke="#cbd5e1" strokeWidth="1.5" />
        {[12, 24, 36].map((y, i) => (
          <g key={y}>
            <circle cx="14" cy={y + 4} r="2.2" fill={['#ef4444', '#f59e0b', '#10b981'][i]} />
            <rect x="22" y={y} width="42" height="9" rx="2.5" fill="none" stroke="#cbd5e1" />
          </g>
        ))}
        <rect x="70" y="10" width="20" height="36" rx="3" fill="#f1f5f9" stroke="#e2e8f0" />
      </>
    )}
  </svg>
);

/**
 * How the notifications page of every person is drawn: priority tabs over a plain list, or the notifications on a timeline by day with a column of filters.
 * What a person can do (open, mark as read, delete, filter) is the same in both.
 */
export const NotificationInboxLayoutSection: React.FC<NotificationInboxLayoutSectionProps> = ({ config, onChange }) => {
  const layout = config.appearance?.notificationInboxLayout ?? 'TABS';
  return (
    <div className="border-t border-slate-200 pt-6">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">{tr("Notifications")}</h3>
      <p className="mb-2 text-xs font-medium text-slate-700 sm:text-sm">{tr("Inbox layout")}</p>
      <div role="radiogroup" aria-label={tr("Notifications inbox layout")} className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Radio
          variant="card"
          name="notification-inbox-layout"
          value="TABS"
          checked={layout === 'TABS'}
          onChange={() => onChange('notificationInboxLayout', 'TABS')}
          icon={<Thumb value="TABS" />}
          label={tr("Priority tabs")}
          description={tr("Tabs for All, High, Medium, Low and Unread with their counts, and a plain list. The lightest page, best on a phone.")}
        />
        <Radio
          variant="card"
          name="notification-inbox-layout"
          value="TIMELINE"
          checked={layout === 'TIMELINE'}
          onChange={() => onChange('notificationInboxLayout', 'TIMELINE')}
          icon={<Thumb value="TIMELINE" />}
          label={tr("Timeline")}
          description={tr("Notifications by day on a timeline, a dot coloured by priority on each card, and a column of filters on the right.")}
        />
      </div>
      <p className="mt-2 text-xs text-slate-500">{tr("Applies to the Notifications page of every signed-in user, after you save. The bell menu and the pop-up messages are not affected.")}</p>
    </div>
  );
};
