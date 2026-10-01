import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { CopyDesktopFilters } from '../CopyDesktopFilters';
import { DesktopSelectFilters } from '../DesktopSelectFilters';

describe('Portal filter adapters', () => {
  it('stages copy status and actual calendar selections until the outer Apply', async () => {
    const apply = vi.fn();
    render(<CopyDesktopFilters search={null} status="All" allStatus="All" statusLocked={false}
      statusOptions={[{ label: 'All', value: 'All' }, { label: 'Distributed', value: 'DISTRIBUTED' }]}
      dates={[{ id: 'created', label: 'Created Date Range', from: '', to: '' }]} onApply={apply} />);
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    const panel = within(screen.getByRole('dialog', { name: 'Advanced filters' }));
    fireEvent.click(panel.getByRole('radio', { name: 'Distributed' }));
    fireEvent.click(within(panel.getByRole('navigation')).getByRole('button', { name: 'Created Date Range' }));
    const calendar = within(panel.getByRole('group', { name: 'Created Date Range' }));
    fireEvent.mouseDown(calendar.getByRole('button', { name: 'Today' }));
    fireEvent.click(calendar.getByRole('button', { name: 'Today' }));
    expect(screen.getByRole('dialog', { name: 'Advanced filters' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Choose date range' })).not.toBeInTheDocument();
    expect(calendar.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
    const selectedDate = calendar.getByLabelText('Start Date').textContent;
    fireEvent.click(within(panel.getByRole('navigation')).getByRole('button', { name: 'Status' }));
    fireEvent.click(within(panel.getByRole('navigation')).getByRole('button', { name: 'Created Date Range' }));
    expect(panel.getByLabelText('Start Date').textContent).toBe(selectedDate);
    expect(apply).not.toHaveBeenCalled();
    fireEvent.click(panel.getByRole('button', { name: 'Apply' }));
    expect(apply).toHaveBeenCalledExactlyOnceWith({ status: 'DISTRIBUTED', createdFrom: expect.any(String), createdTo: expect.any(String) });
    expect(apply.mock.calls[0][0].createdFrom).not.toBe('');
  });

  it('uses direct values for state-owned lists and calls setters only on Apply', () => {
    const change = vi.fn(); const applied = vi.fn();
    render(<DesktopSelectFilters search={null} onApplied={applied}
      filters={[{ id: 'status', label: 'Status', value: 'All', defaultValue: 'All',
        options: [{ label: 'All', value: 'All' }, { label: 'Active', value: 'ACTIVE' }], onChange: change }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Active' }));
    expect(change).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(change).toHaveBeenCalledExactlyOnceWith('ACTIVE');
    expect(applied).toHaveBeenCalledOnce();
  });

  it('preserves the locked copy status on Clear all and Apply', () => {
    const apply = vi.fn();
    render(<CopyDesktopFilters search={null} status="DISTRIBUTED" allStatus="All" statusLocked
      statusOptions={[{ label: 'All', value: 'All' }, { label: 'Distributed', value: 'DISTRIBUTED' }]}
      dates={[]} onApply={apply} />);
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    expect(screen.getByRole('radio', { name: 'All' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(apply).toHaveBeenCalledExactlyOnceWith({ status: 'DISTRIBUTED' });
  });
});
