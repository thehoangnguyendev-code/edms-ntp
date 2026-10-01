import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
vi.mock('@/components/branding/BrandLogo', () => ({ useBranding: () => ({ compactDesktopFilters: true }) }));
vi.mock('@/components/ui/select/Select', () => ({
  Select: ({ label, value, onChange, options, disabled }: any) => <label>{label}<select aria-label={label} value={value} disabled={disabled}
    onChange={e => onChange(e.target.value)}>{options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>,
}));
import { DocumentFilters } from '../DocumentFilters';

const props = () => ({
  searchQuery: '', onSearchChange: vi.fn(), statusFilter: 'All', onStatusChange: vi.fn(),
  typeFilter: 'All', onTypeChange: vi.fn(), departmentFilter: 'All', onDepartmentChange: vi.fn(),
  authorFilter: 'All', onAuthorChange: vi.fn(), createdFromDate: '', createdToDate: '',
  effectiveFromDate: '', effectiveToDate: '', validFromDate: '', validToDate: '',
  onCreatedFromDateChange: vi.fn(), onCreatedToDateChange: vi.fn(), onEffectiveFromDateChange: vi.fn(),
  onEffectiveToDateChange: vi.fn(), onValidFromDateChange: vi.fn(), onValidToDateChange: vi.fn(),
  statusOptions: [{ label: 'All', value: 'All' }, { label: 'Active', value: 'ACTIVE' }],
  typeOptions: [{ label: 'All', value: 'All' }, { label: 'SOP', value: 'SOP' }],
} as React.ComponentProps<typeof DocumentFilters>);

describe('Document filter compact integration', () => {
  it('calls atomic Apply with all changed values, not individual setters while editing', () => {
    const p = props(); const apply = vi.fn();
    render(<DocumentFilters {...p} onApplyFilters={apply} />);
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    const panel = within(screen.getByLabelText('Advanced filters'));
    fireEvent.click(panel.getByRole('radio', { name: 'Active' }));
    fireEvent.click(panel.getByRole('button', { name: 'Document Type' }));
    fireEvent.click(panel.getByRole('radio', { name: 'SOP' }));
    expect(p.onStatusChange).not.toHaveBeenCalled(); expect(p.onTypeChange).not.toHaveBeenCalled();
    expect(apply).not.toHaveBeenCalled();
    fireEvent.click(panel.getByRole('button', { name: 'Apply' }));
    expect(apply).toHaveBeenCalledExactlyOnceWith({ status: 'ACTIVE', documentType: 'SOP' });
  });
  it('retains locked status and author when clearing the draft', () => {
    const p = props(); p.disableStatusFilter = true; p.authorFilterDisabled = true;
    p.statusFilter = 'ACTIVE' as any; p.authorFilter = 'owner';
    const apply = vi.fn(); render(<DocumentFilters {...p} onApplyFilters={apply} />);
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    const panel = within(screen.getByLabelText('Advanced filters'));
    expect(panel.getByRole('radio', { name: 'Active' })).toBeDisabled();
    fireEvent.click(panel.getByRole('button', { name: 'Clear all' }));
    fireEvent.click(panel.getByRole('button', { name: 'Apply' }));
    expect(apply).not.toHaveBeenCalled(); expect(p.onAuthorChange).not.toHaveBeenCalled();
  });
});
