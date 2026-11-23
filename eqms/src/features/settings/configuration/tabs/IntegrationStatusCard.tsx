import React from 'react';
import { IconCircleCheck, IconCircleDashed, IconCircleX } from '@tabler/icons-react';
import { Badge } from '@/components/ui/badge/Badge';
import { formatDateTime } from '@/utils/format';
import type { IntegrationCheck, IntegrationCheckStep } from '@/services/api/settings';
import { tr } from "@/i18n";

interface IntegrationStatusCardProps {
  icon: React.ReactNode;
  title: string;
  /** What it points at (an address, a bucket), shown in a fixed-width font. */
  subtitle?: string;
  /** Next to the action: for example Enabled or Disabled. */
  badge?: React.ReactNode;
  /** The Test connection button (the card does not decide when a test may run). */
  action?: React.ReactNode;
  /** The last test that was run, kept by the server. */
  check?: IntegrationCheck;
  /** What the screen would test now, in the words of `check.subject`: a last test of another setup is said so. */
  currentSubject?: string;
  /** Said when no test has ever been run. */
  emptyText: string;
}

const STEP_ICON: Record<IntegrationCheckStep['status'], React.ReactNode> = {
  OK: <IconCircleCheck className="h-4 w-4 text-emerald-600" aria-label={tr("Passed")} />,
  FAILED: <IconCircleX className="h-4 w-4 text-red-600" aria-label={tr("Failed")} />,
  NOT_CHECKED: <IconCircleDashed className="h-4 w-4 text-slate-400" aria-label={tr("Not checked")} />,
};

/** The state of one integration at the top of its tab: what it is, a Test connection button, and what the last test found (it stays after the toast is gone). */
export const IntegrationStatusCard: React.FC<IntegrationStatusCardProps> = ({ icon, title, subtitle, badge, action, check, currentSubject, emptyText }) => {
  const anotherSetup = Boolean(check && currentSubject && check.subject !== currentSubject);
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-50 text-slate-600">{icon}</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">{title}</p>
            {subtitle && <p className="break-all font-mono text-2xs text-slate-500 md:text-xs">{subtitle}</p>}
          </div>
        </div>
        {(badge || action) && <div className="flex flex-wrap items-center gap-2">{badge}{action}</div>}
      </div>
      <div className="mt-3 border-t border-slate-100 pt-3" aria-live="polite">
        {check ? (
          <>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <Badge semantic={check.success ? 'success' : 'danger'}>{check.success ? tr('Last test passed') : tr('Last test failed')}</Badge>
              <span className="min-w-0 break-words text-slate-700">{tr(check.message)}</span>
            </div>
            <p className="mt-1 text-2xs text-slate-500 md:text-xs">{formatDateTime(check.checkedAt)}{check.checkedBy ? ` · ${check.checkedBy}` : ''}</p>
            {anotherSetup && <p className="mt-1 text-2xs text-amber-700 md:text-xs">{tr("That test was of another setup:")} {check.subject}.</p>}
            {check.steps.length > 0 && (
              <ul className="mt-3 divide-y divide-slate-100">
                {check.steps.map((step) => (
                  <li key={step.key} className="flex items-start gap-2 py-2">
                    <span className="mt-0.5 shrink-0">{STEP_ICON[step.status]}</span>
                    <div className="min-w-0">
                      <p className={`text-sm ${step.status === 'FAILED' ? 'text-red-700' : 'text-slate-800'}`}>{tr(step.label)}</p>
                      <p className="text-2xs text-slate-500 md:text-xs">{tr(step.detail)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="text-sm text-slate-500">{emptyText}</p>
        )}
      </div>
    </section>
  );
};
