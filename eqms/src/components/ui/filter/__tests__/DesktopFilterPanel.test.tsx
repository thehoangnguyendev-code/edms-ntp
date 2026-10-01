import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DesktopFilterPanel, type DesktopFilterField } from '../DesktopFilterPanel';
import { createPortal } from 'react-dom';
import { FilterOptionList } from '../FilterOptionList';

const fields: DesktopFilterField[] = ['status', 'type'].map(id => ({ id, label: id,
  render: (draft, change) => <input aria-label={`value-${id}`} value={draft[id]} onChange={e => change(id, e.target.value)} /> }));
const values = { status: 'Pending', type: 'SOP' };
const defaults = { status: 'All', type: 'All' };
const setup = () => {
  const apply = vi.fn();
  const view = render(<DesktopFilterPanel search={<input aria-label="Search" />} fields={fields} values={values} defaults={defaults} onApply={apply} />);
  fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
  return { apply, view };
};
describe('Desktop filter drafts', () => {
  it('adds a decorative search icon and leaves the input behavior unchanged', () => {
    const change = vi.fn();
    render(<DesktopFilterPanel search={<input aria-label="Search" onChange={change} />}
      fields={fields} values={values} defaults={defaults} onApply={vi.fn()} />);
    const input = screen.getByRole('textbox', { name: 'Search' });
    const wrapper = input.parentElement;
    expect(wrapper).toHaveClass('relative', '[&_input]:pl-9');
    expect(wrapper?.querySelector('[data-advanced-search-icon]')).toHaveAttribute('aria-hidden', 'true');
    fireEvent.change(input, { target: { value: 'SOP' } });
    expect(change).toHaveBeenCalledOnce();
  });

  it('does not show a stray icon when the search is hidden', () => {
    const { container } = render(<DesktopFilterPanel search={null} fields={fields}
      values={values} defaults={defaults} onApply={vi.fn()} />);
    expect(container.querySelector('[data-advanced-search-icon]')).toBeNull();
  });

  it('preserves option searches and draft selections across animated label switches', () => {
    const apply = vi.fn();
    const optionFields: DesktopFilterField[] = ['status', 'type'].map(id => ({ id, label: id,
      render: (draft, change, active) => <FilterOptionList label={id} value={draft[id]} active={active}
        options={[{ label: 'All', value: 'All' }, { label: 'Active', value: 'ACTIVE' }]}
        onChange={value => change(id, value)} /> }));
    render(<DesktopFilterPanel search={null} fields={optionFields} values={defaults} defaults={defaults} onApply={apply} />);
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Search status' }), { target: { value: 'active' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Active' }));
    fireEvent.click(screen.getByRole('button', { name: 'type' }));
    fireEvent.click(screen.getByRole('button', { name: 'status' }));
    expect(screen.getByRole('textbox', { name: 'Search status' })).toHaveValue('active');
    expect(screen.getByRole('radio', { name: 'Active' })).toHaveAttribute('aria-checked', 'true');
    expect(apply).not.toHaveBeenCalled();
  });
  it('retains an inert surface for the exit animation, then removes it', async () => {
    const { apply } = setup();
    const surface = screen.getByRole('dialog', { name: 'Advanced filters' });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(surface).toBeInTheDocument();
    expect(surface).toHaveAttribute('inert');
    expect(surface).toHaveAttribute('aria-hidden', 'true');
    await waitFor(() => expect(surface).not.toBeInTheDocument());
    expect(apply).not.toHaveBeenCalled();
  });
  it('cancels exit removal when reopened rapidly', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    const surface = screen.getByRole('dialog', { name: 'Advanced filters' });
    expect(surface).not.toHaveAttribute('inert');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(surface).not.toBeInTheDocument());
  });
  it('portals above the table without changing page layout; actions belong to the right column', () => {
    const { view } = setup();
    const panel = screen.getByRole('dialog', { name: 'Advanced filters' });
    expect(view.container).not.toContainElement(panel);
    expect(panel).toHaveStyle({ position: 'fixed' });
    const actions = screen.getByRole('button', { name: 'Apply' }).closest('[data-filter-actions]');
    expect(actions?.parentElement).not.toContainElement(screen.getByRole('navigation', { name: 'Filter fields' }));
  });
  it('outside clicks discard the draft', () => {
    const { apply } = setup();
    fireEvent.change(screen.getByLabelText('value-status'), { target: { value: 'Active' } });
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    expect(screen.getByLabelText('value-status')).toHaveValue('Pending');
    expect(apply).not.toHaveBeenCalled();
  });
  it('keeps nested calendar portals open when clicked', () => {
    render(<DesktopFilterPanel search={null} values={values} defaults={defaults} onApply={vi.fn()}
      fields={[{ id: 'date', label: 'Date', render: () => createPortal(<button>Calendar day</button>, document.body) }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Calendar day' }));
    expect(screen.getByRole('dialog', { name: 'Advanced filters' })).toBeInTheDocument();
  });
  it('stages multiple fields, then commits exactly once on Apply', () => {
    const { apply } = setup();
    fireEvent.change(screen.getByLabelText('value-status'), { target: { value: 'Active' } });
    fireEvent.click(screen.getByRole('button', { name: 'type' }));
    fireEvent.change(screen.getByLabelText('value-type'), { target: { value: 'FORM' } });
    expect(apply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(apply).toHaveBeenCalledExactlyOnceWith({ status: 'Active', type: 'FORM' });
  });
  it('Clear all changes only the draft and Cancel discards it', () => {
    const { apply } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(apply).not.toHaveBeenCalled();
    expect(screen.getByLabelText('value-status')).toHaveValue('All');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    expect(screen.getByLabelText('value-status')).toHaveValue('Pending');
  });
  it('Escape closes without committing and restores focus', () => {
    const { apply } = setup();
    fireEvent.keyDown(screen.getByLabelText('Advanced filters'), { key: 'Escape' });
    expect(apply).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Filter' })).toHaveFocus();
  });
  it('closes a stale draft when committed filters change via Back/Forward', () => {
    const { apply, view } = setup();
    view.rerender(<DesktopFilterPanel search={null} fields={fields} values={{ ...values, status: 'Closed' }} defaults={defaults} onApply={apply} />);
    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
    expect(apply).not.toHaveBeenCalled();
  });
});
