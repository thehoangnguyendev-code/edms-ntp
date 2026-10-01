import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  copies: vi.fn(), physical: vi.fn(), eform: vi.fn(), toast: vi.fn(),
}));
vi.mock('@/services/api/documents', () => ({ documentApi: { getControlledCopies: mocks.copies } }));
vi.mock('@/services/api/executedRecords', () => ({
  executedRecordApi: { recordPhysicalCopy: mocks.physical, submitEform: mocks.eform },
}));
vi.mock('@/components/ui/toast/Toast', () => ({ useToast: () => ({ showToast: mocks.toast }) }));
vi.mock('@/components/ui/modal/FormModal', () => ({
  FormModal: ({ isOpen, children, onConfirm, confirmDisabled }: any) => isOpen ? <div>
    {children}<button disabled={confirmDisabled} onClick={onConfirm}>Sign & Submit</button>
  </div> : null,
}));
vi.mock('@/components/ui/select', () => ({
  Select: ({ label, value, options, onChange }: any) => <label>{label}<select aria-label={label}
    value={value} onChange={e => onChange(e.target.value)}>
    <option value="">Select</option>
    {options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
    {label === 'Filled by' && !value && <option value="user-1">User One</option>}
  </select></label>,
}));
vi.mock('@/components/ui/datetime-picker/DateTimePicker', () => ({
  DateTimePicker: ({ label, value, showTime, onChange }: any) => <button
    aria-label={label} data-show-time={String(showTime)} data-value={value}
    onClick={() => onChange('30/09/2026')}>Choose date</button>,
}));
vi.mock('@/components/ui/esign-modal/ESignatureModal', () => ({
  ESignatureModal: ({ onConfirm }: any) => <button onClick={() =>
    onConfirm({ reason: 'Record scan', signatureToken: 'token-1' })}>Confirm signature</button>,
}));

import { SubmitExecutedRecordModal } from '../SubmitExecutedRecordModal';

const props = { isOpen: true, onClose: vi.fn(), formDocumentId: 'form-1',
  formDocumentNumber: 'FORM.0001', formDocumentTitle: 'Inspection Form' };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.copies.mockResolvedValue({ data: [{ id: 'copy-1', controlledCopyNumber: 'CC-1',
    statusCode: 'DISTRIBUTED', recipientName: 'User One' }] });
  mocks.physical.mockResolvedValue({ id: 'record-1', recordNumber: 'REC-1' });
  mocks.eform.mockResolvedValue({ id: 'record-2', recordNumber: 'REC-2' });
});

describe('Executed Record capture UI', () => {
  it('uses date-only picker and preserves ISO date/file/signature in the physical-copy request', async () => {
    const { container } = render(<SubmitExecutedRecordModal {...props} captureMethod="PAPER_SCAN" />);
    await screen.findByRole('option', { name: /CC-1/ });
    fireEvent.change(screen.getByLabelText('Controlled Copy'), { target: { value: 'copy-1' } });
    fireEvent.change(screen.getByLabelText('Filled by'), { target: { value: 'user-1' } });
    const date = screen.getByRole('button', { name: 'Date filled' });
    expect(date).toHaveAttribute('data-show-time', 'false');
    fireEvent.click(date);
    const file = new File(['scan'], 'scanned.pdf', { type: 'application/pdf' });
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } });
    expect(screen.getByText('scanned.pdf')).toBeInTheDocument();
    expect(mocks.physical).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sign & Submit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm signature' }));
    await waitFor(() => expect(mocks.physical).toHaveBeenCalledWith('form-1', {
      sourceControlledCopyId: 'copy-1', filledByUserId: 'user-1', filledAt: '2026-09-30',
      file, reason: 'Record scan', signatureToken: 'token-1',
    }));
    expect(mocks.eform).not.toHaveBeenCalled();
  });

  it('shows Upload/file/removal controls and requires a file again after removal', () => {
    const { container } = render(<SubmitExecutedRecordModal {...props} captureMethod="EFORM" />);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const click = vi.spyOn(input, 'click');
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));
    expect(click).toHaveBeenCalledOnce();
    expect(input).toHaveAttribute('accept', '.pdf,.jpg,.jpeg,.png');
    const file = new File(['scan'], 'scan.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByRole('button', { name: 'Sign & Submit' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Remove selected file' }));
    expect(screen.getByText('No file uploaded')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign & Submit' })).toBeDisabled();
    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByText('scan.png')).toBeInTheDocument();
    expect(mocks.physical).not.toHaveBeenCalled();
    expect(mocks.eform).not.toHaveBeenCalled();
  });

  it('keeps the eForm submission path separate and omits paper metadata', async () => {
    const { container } = render(<SubmitExecutedRecordModal {...props} captureMethod="EFORM" />);
    expect(screen.queryByRole('button', { name: 'Date filled' })).not.toBeInTheDocument();
    const file = new File(['form'], 'filled.pdf', { type: 'application/pdf' });
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign & Submit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm signature' }));
    await waitFor(() => expect(mocks.eform).toHaveBeenCalledWith('form-1', expect.objectContaining({
      file, filledAt: undefined, sourceControlledCopyId: undefined, filledByUserId: undefined,
      signatureToken: 'token-1',
    })));
    expect(mocks.physical).not.toHaveBeenCalled();
  });
});
