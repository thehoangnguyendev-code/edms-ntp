import { describe, expect, it } from 'vitest';
import { knownStatusColor, statusColor } from '@/components/ui/badge/statusColors';
import { statusLabel as backupStatusLabel } from '@/features/backup-restore/types';
import { runStatusLabel } from '@/features/report/shared/reportLabels';
import { ASSESSMENT_STATUS_LABEL } from '@/features/training-activities/assessments/TrainingAssessmentListView';
import { JOB_STATUS_LABEL } from '@/features/training-activities/jobs/TrainingJobListView';
import { REQUIREMENT_STATUS_LABEL } from '@/features/training-activities/requirements/TrainingRequirementListView';
import { STATUS_LABEL } from '@/features/training-activities/shared/trainingLabels';
import { translateLabel } from '@/i18n';
import { badgeLabel } from '../badgeLabel';

/** Every value a result of the search box can carry as its badge, as the server sends it (the database status tables and check constraints). */
const BADGES: Record<string, string[]> = {
  documents: ['Draft', 'Active', 'Obsoleted', 'Closed - Cancelled'],
  revisions: ['Draft', 'Pending Review', 'Pending Approval', 'Pending Training', 'Ready for Publishing', 'Effective', 'Obsoleted', 'Closed - Cancelled'],
  'controlled-copies': ['Ready for Distribution', 'Distributed', 'Obsoleted', 'Closed - Cancelled'],
  'uncontrolled-copies': ['Ready for Distribution', 'Distributed', 'Closed - Cancelled'],
  training: ['RESERVED', 'PLANNED', 'PENDING_APPROVAL', 'NOTIFIED', 'IN_PROGRESS', 'PENDING_QA_CONFIRMATION', 'COMPLETED', 'CANCELLED'],
  'training-requirements': ['DRAFT', 'PENDING_REVIEW', 'PENDING_APPROVAL', 'APPROVED'],
  'training-assessments': ['DRAFT', 'PENDING_APPROVAL', 'EFFECTIVE', 'OBSOLETED'],
  'training-job-assignments': ['DRAFT', 'PENDING_RECEIVER', 'EFFECTIVE', 'OBSOLETED', 'CANCELLED'],
  users: ['Active', 'Inactive', 'Pending', 'Suspended', 'Terminated'],
  'access-profiles': ['Active', 'Inactive'],
  'report-runs': ['QUEUED', 'PROCESSING', 'COMPLETED', 'RETRY_SCHEDULED', 'FAILED', 'DEAD_LETTERED'],
  backups: ['RUNNING', 'COMPLETED', 'FAILED', 'EXPIRED'],
};

describe('The status badge of a search result', () => {
  it('has a colour of the shared table for every status', () => {
    const unknown = Object.entries(BADGES).flatMap(([kind, values]) => values.filter((v) => !knownStatusColor(v)).map((v) => `${kind}:${v}`));
    expect(unknown).toEqual([]);
    // the colour of the code is also the colour of the older word some remembered results still carry
    expect(statusColor('Pending Document Approval')).toBe(statusColor('RESERVED'));
  });

  it('uses the words of the screen of that kind', () => {
    const screens: Record<string, (code: string) => string> = {
      training: (c) => STATUS_LABEL[c],
      'training-requirements': (c) => REQUIREMENT_STATUS_LABEL[c],
      'training-assessments': (c) => ASSESSMENT_STATUS_LABEL[c],
      'training-job-assignments': (c) => JOB_STATUS_LABEL[c],
      'report-runs': runStatusLabel,
      backups: backupStatusLabel,
    };
    for (const [kind, words] of Object.entries(screens)) {
      for (const code of BADGES[kind]) expect(badgeLabel(kind, code), `${kind}:${code}`).toBe(words(code));
    }
  });

  it('has a Vietnamese word for every status', () => {
    const missing = [...new Set(Object.entries(BADGES).flatMap(([kind, values]) => values.map((v) => badgeLabel(kind, v))))]
      .filter((word) => translateLabel('vi', word) === word);
    expect(missing).toEqual([]);
  });
});
