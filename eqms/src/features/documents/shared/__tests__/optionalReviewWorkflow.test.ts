import { describe, expect, it } from 'vitest';
import { mapSignatureRecords } from '../components/SignatureFields';

describe('optional review presentation', () => {
  it('shows a dash for absent reviewer name and date', () => {
    const reviewer = mapSignatureRecords(undefined).find(record => record.actionBy === 'Reviewed By');
    expect(reviewer?.actionByName).toBe('-');
    expect(reviewer?.actionOnValue).toBe('-');
  });
});
