import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Input, Textarea } from '../ResponsiveForm';
import { CONTROL_STATE_CLASSES } from '../../controlState';
import { Select } from '../../select/Select';
import { MultiSelect } from '../../select/MultiSelect';
import { DateTimePicker } from '../../datetime-picker/DateTimePicker';
import { DateRangePicker } from '../../datetime-picker/DateRangePicker';
import { TimePicker } from '../../datetime-picker/TimePicker';

describe('readonly controls share Document General Information styling', () => {
  it('keeps a readonly input focusable and copyable, with the reference cursor and focus border', async () => {
    const onChange = vi.fn();
    render(<Input aria-label="Revision" value="SOP.10340" readOnly onChange={onChange} className="bg-white text-slate-900" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveClass(...CONTROL_STATE_CLASSES.readonlyField.split(' '));
    expect(input).not.toHaveClass('read-only:border-slate-200');
    expect(input).not.toBeDisabled();
    const user = userEvent.setup();
    await user.tab();
    expect(input).toHaveFocus();
    await user.type(input, 'edited');
    expect(input).toHaveValue('SOP.10340');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps both native readonly and disabled flags without the forbidden cursor on reference-only data', () => {
    render(<Input aria-label="Training Status" value="In progress" disabled readOnly />);
    const input = screen.getByRole('textbox');
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute('readonly');
    expect(input).toHaveClass('cursor-default', 'focus:border-emerald-500');
    expect(input).not.toHaveClass('disabled:cursor-not-allowed');
  });

  it('does not restyle ordinary disabled input as a readonly input', () => {
    render(<Input aria-label="Saving field" disabled value="Saving" />);
    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.getByRole('textbox')).not.toHaveAttribute('readonly');
    expect(screen.getByRole('textbox')).toHaveClass('disabled:cursor-not-allowed');
  });

  it('uses the textarea reference without imposing a single-line height', async () => {
    const onChange = vi.fn();
    render(<Textarea aria-label="Description" readOnly rows={4} value="Line one\nLine two" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveClass(...CONTROL_STATE_CLASSES.readonlyTextarea.split(' '));
    expect(input).not.toHaveClass('h-9');
    expect(input).toHaveAttribute('rows', '4');
    await userEvent.setup().type(input, 'edited');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('preserves editable change handlers and validation appearance after toggling readonly', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<Input aria-label="Name" readOnly value="Old" onChange={onChange} />);
    rerender(<Input aria-label="Name" value="Old" onChange={onChange} error fullWidth={false} />);
    const input = screen.getByRole('textbox');
    expect(input).not.toHaveAttribute('readonly');
    expect(input).toHaveClass('w-auto', 'border-red-300', 'focus:border-red-500');
    expect(input).not.toHaveClass('cursor-default');
    await userEvent.setup().type(input, 'X');
    expect(onChange).toHaveBeenCalled();
  });

  it('keeps compact readonly fields visually identical to the reference field', () => {
    expect(CONTROL_STATE_CLASSES.readonlyFieldCompact).toBe(CONTROL_STATE_CLASSES.readonlyField);
  });

  it('keeps disabled selects inert while using the shared readonly field/container', () => {
    const onChange = vi.fn();
    const options = [{ value: 'qa', label: 'Quality Assurance' }];
    render(<>
      <Select label="Department" value="qa" options={options} disabled onChange={onChange} />
      <MultiSelect label="Departments" value={['qa']} options={options} disabled onChange={onChange} />
    </>);
    const [single, multiple] = screen.getAllByRole('combobox');
    expect(single).toHaveClass(...CONTROL_STATE_CLASSES.readonlyField.split(' '));
    expect(multiple).toHaveClass(...CONTROL_STATE_CLASSES.readonlyContainer.split(' '));
    for (const control of [single, multiple]) {
      expect(control).toBeDisabled();
      fireEvent.click(control);
      expect(control).toHaveAttribute('aria-expanded', 'false');
    }
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps disabled date, date range and time pickers inert without a forbidden cursor', () => {
    const onChange = vi.fn();
    render(<>
      <DateTimePicker label="Date" value="2026-10-24" onChange={onChange} disabled showTime={false} />
      <DateRangePicker label="Range" startDate="2026-10-23" endDate="2026-10-24" onStartDateChange={onChange} onEndDateChange={onChange} disabled />
      <TimePicker label="Time" value="12:00" onChange={onChange} disabled />
    </>);
    for (const label of ['Date', 'Range', 'Time']) {
      const control = screen.getByLabelText(label);
      expect(control).toBeDisabled();
      expect(control).toHaveClass(...CONTROL_STATE_CLASSES.readonlyField.split(' '));
      fireEvent.click(control);
      expect(control).toHaveAttribute('aria-expanded', 'false');
    }
    expect(onChange).not.toHaveBeenCalled();
  });
});
