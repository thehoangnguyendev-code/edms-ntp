import { statusLabel as backupStatusLabel } from '@/features/backup-restore/types';
import { runStatusLabel } from '@/features/report/shared/reportLabels';
import { STATUS_LABEL as TRAINING_STATUS_LABEL } from '@/features/training-activities/shared/trainingLabels';
import { tr } from '@/i18n';
import { readableCode } from '@/utils/machineText';

/**
 * The words of the status badge of a result: the ones the screen of that kind of record shows. The server sends the machine value for the kinds whose
 * screen has its own words; the words of the screens that keep them inside the screen itself are repeated here, and a test keeps the two equal.
 */
const SCREEN_WORDS: Record<string, (code: string) => string | undefined> = {
  training: (code) => TRAINING_STATUS_LABEL[code],
  'training-requirements': (code) => ({ DRAFT: 'Draft', PENDING_REVIEW: 'Pending Review', PENDING_APPROVAL: 'Pending Approval', APPROVED: 'Approved' } as Record<string, string>)[code],
  'training-assessments': (code) => ({ DRAFT: 'Draft', PENDING_APPROVAL: 'Pending Approval', EFFECTIVE: 'Effective', OBSOLETED: 'Obsoleted' } as Record<string, string>)[code],
  'training-job-assignments': (code) => ({ DRAFT: 'Draft', PENDING_RECEIVER: 'Pending Employee Acceptance', EFFECTIVE: 'Effective', OBSOLETED: 'Obsoleted', CANCELLED: 'Cancelled' } as Record<string, string>)[code],
  'report-runs': (code) => runStatusLabel(code),
  backups: (code) => backupStatusLabel(code),
};

const isCode = (value: string) => /^[A-Z][A-Z0-9_]*$/.test(value);

/** Display only, never sent back. A status that already is a word ("Pending Training") is only translated. */
export const badgeLabel = (groupKey: string, badge: string): string => {
  const words = isCode(badge) ? SCREEN_WORDS[groupKey]?.(badge) ?? readableCode(badge) : badge;
  return tr(words);
};
