import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Badge } from '@/components/ui/badge/Badge';
import { Select } from '@/components/ui/select/Select';
import { displayNode, displayText, isMachineCode, readableCode } from '../machineText';

afterEach(cleanup);

describe('machine values are never shown to a person', () => {
  it('recognises a value written with capitals and underscores, and nothing a person may have written on purpose', () => {
    expect(isMachineCode('IN_PROGRESS')).toBe(true);
    expect(isMachineCode('PENDING_QA_CONFIRMATION')).toBe(true);
    expect(isMachineCode('NOT_VERIFIED')).toBe(true);
    expect(isMachineCode('TEST')).toBe(false); // one word in capitals can be the name of the environment or an abbreviation; the server labels one-word statuses
    expect(isMachineCode('DONE')).toBe(true); // a status word the server keeps in capitals
    expect(isMachineCode('CRITICAL')).toBe(true);
    expect(isMachineCode('SOP.0032')).toBe(false);
    expect(isMachineCode('Pending Training')).toBe(false);
    expect(isMachineCode('in_progress')).toBe(false);
    expect(isMachineCode(undefined)).toBe(false);
  });

  it('makes a code readable and keeps the known abbreviations in capitals', () => {
    expect(readableCode('IN_PROGRESS')).toBe('In progress');
    expect(readableCode('PENDING_QA_CONFIRMATION')).toBe('Pending QA confirmation');
    expect(displayText('IN_PROGRESS')).toBe('In progress');
    expect(displayText('Effective')).toBe('Effective');
    expect(displayNode(42)).toBe(42);
  });

  it('a Badge shows the readable words, and leaves an element or an ordinary label alone', () => {
    render(<><Badge>IN_PROGRESS</Badge><Badge>Pending Training</Badge><Badge><b>RAW_CODE</b></Badge></>);
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.getByText('Pending Training')).toBeInTheDocument();
    expect(screen.getByText('RAW_CODE')).toBeInTheDocument(); // inside an element the author chose what to draw
    expect(screen.queryByText('IN_PROGRESS')).toBeNull();
  });

  it('a Select shows the readable words for an option whose label is a code, and keeps the value as it is', () => {
    render(<Select value="PENDING_QA_CONFIRMATION" onChange={() => undefined} options={[{ label: 'PENDING_QA_CONFIRMATION', value: 'PENDING_QA_CONFIRMATION' }, { label: 'COMPLETED', value: 'COMPLETED' }]} aria-label="Status" />);
    expect(screen.getByText('Pending QA confirmation')).toBeInTheDocument();
    expect(screen.queryByText('PENDING_QA_CONFIRMATION')).toBeNull();
  });
});
