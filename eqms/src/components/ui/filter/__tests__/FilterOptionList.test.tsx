import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, cleanup } from '@testing-library/react';
import { FilterOptionList } from '../FilterOptionList';

afterEach(() => { cleanup(); vi.useRealTimers(); });
const options = [{ label: 'All', value: 'All' }, { label: 'Active', value: 'ACTIVE' }, { label: 'Draft', value: 'DRAFT' }];

describe('Direct filter option list', () => {
  it('shows values immediately, searches locally and emits the unchanged machine value', () => {
    const change = vi.fn();
    render(<FilterOptionList label="Status" options={options} value="ACTIVE" onChange={change} />);
    expect(screen.getByRole('radio', { name: 'Active' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Search Status' }), { target: { value: 'draft' } });
    expect(screen.queryByRole('radio', { name: 'Active' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Draft' }));
    expect(change).toHaveBeenCalledExactlyOnceWith('DRAFT');
  });
  it('blocks changes to a locked filter', () => {
    const change = vi.fn();
    render(<FilterOptionList label="Status" options={options} value="ACTIVE" onChange={change} disabled />);
    fireEvent.click(screen.getByRole('radio', { name: 'Draft' }));
    expect(change).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox')).toBeDisabled();
  });
  it('loads async options only when active, keeps All and ignores out-of-order responses', async () => {
    vi.useFakeTimers();
    let resolveInitial!: (options: Array<{ label: string; value: string }>) => void;
    const search = vi.fn().mockImplementationOnce(() => new Promise(resolve => { resolveInitial = resolve; }))
      .mockResolvedValue([{ label: 'Newest User', value: 'user-2' }]);
    const props = { label: 'Author', options: [options[0]], value: 'All', onChange: vi.fn(), onSearch: search };
    const view = render(<FilterOptionList {...props} active={false} />);
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(search).not.toHaveBeenCalled();
    view.rerender(<FilterOptionList {...props} active />);
    await act(() => vi.advanceTimersByTimeAsync(300));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'new' } });
    await act(() => vi.advanceTimersByTimeAsync(300));
    await act(async () => resolveInitial([{ label: 'Old User', value: 'user-1' }]));
    expect(screen.getByRole('radio', { name: 'Newest User' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'All' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Old User' })).not.toBeInTheDocument();
  });
  it('reports server failures and allows retry', async () => {
    vi.useFakeTimers();
    const search = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue([{ label: 'Recovered', value: 'ok' }]);
    render(<FilterOptionList label="Author" options={[options[0]]} value="All" onChange={vi.fn()} onSearch={search} />);
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load options');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(screen.getByRole('radio', { name: 'Recovered' })).toBeInTheDocument();
  });
});
