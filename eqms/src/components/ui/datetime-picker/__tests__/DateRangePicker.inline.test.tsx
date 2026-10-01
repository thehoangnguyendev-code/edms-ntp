import React, { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DateRangePicker } from '../DateRangePicker';

function Harness({ includeTime = false }: { includeTime?: boolean }) {
  const [start, setStart] = useState('01/10/2026' + (includeTime ? ' 00:00:00' : ''));
  const [end, setEnd] = useState('03/10/2026' + (includeTime ? ' 23:59:59' : ''));
  return <>
    <DateRangePicker inline label="Dates" includeTime={includeTime}
      startDate={start} endDate={end} onStartDateChange={setStart} onEndDateChange={setEnd} />
    <output data-testid="range">{start}|{end}</output>
  </>;
}

describe('Inline date range', () => {
  it('shows the calendar directly and publishes presets/reset without a second Apply', () => {
    render(<Harness />);
    expect(screen.getByRole('group', { name: 'Dates' })).toBeInTheDocument();
    expect(screen.queryByText('Dates')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Start Date')).toBeInTheDocument();
    expect(screen.getByLabelText('End Date')).toBeInTheDocument();
    expect(screen.getByRole('grid')).toBeInTheDocument();
    const layout = screen.getByRole('grid').closest('[data-inline-date-layout]');
    expect(layout).toHaveClass('flex-row');
    expect(layout).toHaveClass('h-full');
    expect(screen.getByRole('group', { name: 'Dates' })).toHaveClass('h-full', 'min-h-[320px]');
    expect(screen.getByRole('grid')).toHaveClass('flex-1', 'auto-rows-fr');
    const presets = layout?.querySelector('[data-date-presets]');
    expect(presets).toHaveClass('w-[120px]', 'border-l');
    expect(presets?.firstElementChild).toHaveClass('grid-cols-1');
    expect(screen.getByRole('button', { name: '1 October 2026' })).toHaveClass('h-6', 'w-6');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    expect(screen.getByTestId('range').textContent).toMatch(/^\d{2}\/\d{2}\/\d{4}\|\d{2}\/\d{2}\/\d{4}$/);
    expect(screen.getByRole('grid')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reset range' }));
    expect(screen.getByTestId('range')).toHaveTextContent('|');
  });

  it('publishes time edits using the existing date-time format', () => {
    render(<Harness includeTime />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Start hour' }), { target: { value: '09' } });
    expect(screen.getByTestId('range')).toHaveTextContent('01/10/2026 09:00:00|03/10/2026 23:59:59');
  });

  it('keeps the default dropdown staged until its Apply', async () => {
    const start = vi.fn(); const end = vi.fn();
    render(<DateRangePicker label="Dates" startDate="" endDate=""
      onStartDateChange={start} onEndDateChange={end} />);
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Dates'));
    fireEvent.click(await screen.findByRole('button', { name: 'Today' }));
    expect(start).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Apply' }));
    expect(start).toHaveBeenCalledOnce();
    expect(end).toHaveBeenCalledOnce();
  });

  it('honors disabled inline controls', () => {
    render(<DateRangePicker inline disabled label="Dates" startDate="" endDate=""
      onStartDateChange={vi.fn()} onEndDateChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Today' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reset range' })).toBeDisabled();
  });

  it('updates manual dates and clears an end date earlier than the new start', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: '5 October 2026' }));
    expect(screen.getByTestId('range')).toHaveTextContent('05/10/2026|');
    fireEvent.click(screen.getByRole('button', { name: '7 October 2026' }));
    expect(screen.getByTestId('range')).toHaveTextContent('05/10/2026|07/10/2026');
  });
});
