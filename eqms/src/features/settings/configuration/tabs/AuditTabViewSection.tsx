import React from 'react';
import { IconTimeline } from '@tabler/icons-react';
import { FormSection } from '@/components/ui/form/FormSection';
import { Radio } from '@/components/ui/radio/Radio';
import type { GeneralConfig } from '../types';

type TimelineStyle = NonNullable<GeneralConfig['appearance']['auditTabTimelineStyle']>;

const STYLES: { value: TimelineStyle; label: string; description: string }[] = [
  { value: 'RAIL', label: 'Rail and cards', description: 'A line on the left, a card for each record. The easiest to read.' },
  { value: 'CENTER', label: 'Centre spine', description: 'Records alternate left and right of a centre line, the time opposite.' },
  { value: 'COMPACT', label: 'Compact log', description: 'One line for each record; hover for the details. Shows the most records.' },
  { value: 'SCROLL_LIT', label: 'Date column', description: 'A big date on the left; the line lights up as you scroll.' },
];

/** A few strokes that show the shape of each look, so that the choice is made by seeing it. */
const Thumb: React.FC<{ value: TimelineStyle }> = ({ value }) => {
  const line = '#cbd5e1';
  const dot = '#10b981';
  const card = '#e2e8f0';
  return (
    <svg width="56" height="40" viewBox="0 0 56 40" aria-hidden="true" className="shrink-0 rounded-md border border-slate-200 bg-slate-50">
      {value === 'RAIL' && (
        <>
          <line x1="9" y1="5" x2="9" y2="35" stroke={line} strokeWidth="1.5" />
          {[8, 20, 32].map((y) => (
            <g key={y}>
              <circle cx="9" cy={y} r="3" fill={dot} />
              <rect x="17" y={y - 5} width="34" height="10" rx="2.5" fill={card} />
            </g>
          ))}
        </>
      )}
      {value === 'CENTER' && (
        <>
          <line x1="28" y1="4" x2="28" y2="36" stroke={line} strokeWidth="1.5" />
          {[8, 20, 32].map((y, i) => (
            <g key={y}>
              <circle cx="28" cy={y} r="3" fill={dot} />
              <rect x={i % 2 === 0 ? 5 : 33} y={y - 5} width="18" height="10" rx="2.5" fill={card} />
            </g>
          ))}
        </>
      )}
      {value === 'COMPACT' && (
        <>
          <line x1="10" y1="6" x2="10" y2="34" stroke={line} strokeWidth="1.5" />
          {[8, 20, 32].map((y) => (
            <g key={y}>
              <circle cx="10" cy={y} r="4" fill="#bbf7d0" />
              <rect x="18" y={y - 2} width="26" height="4" rx="2" fill={card} />
              <rect x="46" y={y - 2} width="6" height="4" rx="2" fill={line} />
            </g>
          ))}
        </>
      )}
      {value === 'SCROLL_LIT' && (
        <>
          <rect x="3" y="5" width="12" height="14" rx="3" fill="#fff" stroke={line} />
          <line x1="22" y1="5" x2="22" y2="20" stroke={dot} strokeWidth="2" />
          <line x1="22" y1="20" x2="22" y2="36" stroke={line} strokeWidth="1.5" />
          {[8, 20, 32].map((y, i) => (
            <g key={y}>
              <circle cx="22" cy={y} r="3" fill={i < 2 ? dot : '#fff'} stroke={i < 2 ? dot : line} />
              <rect x="29" y={y - 5} width="22" height="10" rx="2.5" fill={card} />
            </g>
          ))}
        </>
      )}
    </svg>
  );
};

interface AuditTabViewSectionProps {
  config: GeneralConfig;
  onChange: (key: 'auditTabView' | 'auditTabTimelineStyle', value: string) => void;
}

/**
 * How the Audit Trail tab of a record (document, revision, copy, training activity ...) is drawn: a table, or a vertical timeline in one of four looks.
 * The Audit Trail module has no such choice and stays a table.
 */
export const AuditTabViewSection: React.FC<AuditTabViewSectionProps> = ({ config, onChange }) => {
  const view = config.appearance?.auditTabView ?? 'TABLE';
  const style = config.appearance?.auditTabTimelineStyle ?? 'COMPACT';
  return (
    <FormSection title="Audit Trail Tabs" icon={<IconTimeline className="h-4 w-4" />}>
      <div className="space-y-5">
        <div>
          <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">View</p>
          <div role="radiogroup" aria-label="Audit Trail tab view" className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Radio variant="card" name="audit-tab-view" value="TABLE" checked={view === 'TABLE'} onChange={() => onChange('auditTabView', 'TABLE')}
              label="Table" description="Columns with sort and pagination, as it is today." />
            <Radio variant="card" name="audit-tab-view" value="TIMELINE" checked={view === 'TIMELINE'} onChange={() => onChange('auditTabView', 'TIMELINE')}
              label="Timeline" description="Who did what and when, newest first, in a panel that scrolls on its own." />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Applies to the Audit Trail tab of every record, for every signed-in user, after you save. The Audit Trail module and the export of the audit trail are not affected.
          </p>
        </div>
        {view === 'TIMELINE' && (
          <div className="border-t border-slate-100 pt-4">
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Timeline look</p>
            <div role="radiogroup" aria-label="Timeline look" className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {STYLES.map((option) => (
                <Radio key={option.value} variant="card" name="audit-tab-timeline-style" value={option.value} checked={style === option.value}
                  onChange={() => onChange('auditTabTimelineStyle', option.value)}
                  icon={<Thumb value={option.value} />} label={option.label} description={option.description} />
              ))}
            </div>
          </div>
        )}
      </div>
    </FormSection>
  );
};
