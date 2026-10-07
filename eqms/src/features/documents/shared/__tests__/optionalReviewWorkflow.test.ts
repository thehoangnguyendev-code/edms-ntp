import { describe, expect, it } from 'vitest';
import { resolveRevisionSkippedSteps } from '../statusMapping';
import { mapSignatureRecords } from '../components/SignatureFields';

describe('optional review presentation', () => {
  it('marks review skipped when persisted history goes directly to approval', () => {
    expect(resolveRevisionSkippedSteps('PENDING_APPROVAL', [
      { fromStatus: 'DRAFT', toStatus: 'PENDING_APPROVAL' },
    ], false)).toContain('Pending Review');
  });

  it('does not mark review skipped when the stage was visited', () => {
    expect(resolveRevisionSkippedSteps('PENDING_APPROVAL', [
      { fromStatus: 'DRAFT', toStatus: 'PENDING_REVIEW' },
      { fromStatus: 'PENDING_REVIEW', toStatus: 'PENDING_APPROVAL' },
    ], false)).not.toContain('Pending Review');
  });

  it('shows a dash for absent reviewer name and date', () => {
    const reviewer = mapSignatureRecords(undefined).find(record => record.actionBy === 'Reviewed By');
    expect(reviewer?.actionByName).toBe('-');
    expect(reviewer?.actionOnValue).toBe('-');
  });
});
