import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/modal/NavigationGuardModal', () => ({
  NavigationGuardModal: ({ isOpen, onClose, onConfirm, currentPageTitle, destinationLabel }: any) =>
    isOpen ? (
      <div role="dialog">
        Leave {currentPageTitle} for {destinationLabel}
        <button onClick={onClose}>Stay</button>
        <button onClick={onConfirm}>Leave</button>
      </div>
    ) : null,
}));

import { useLeaveGuard } from '../useLeaveGuard';
import { hasUnsavedScreen } from '../useReportUnsavedChanges';

const onLeave = vi.fn();

const Where = () => {
  const location = useLocation();
  return <p data-testid="where" data-state={JSON.stringify(location.state)}>{location.pathname}</p>;
};

const Screen: React.FC<{ dirty: boolean; label?: string }> = ({ dirty, label }) => {
  const { go, confirmLeave, modal } = useLeaveGuard(dirty, 'Edit Thing', label);
  return (
    <>
      <button onClick={() => go('/list')}>Back</button>
      <button onClick={() => go('/other')}>Breadcrumb</button>
      <button onClick={() => go('/draft', { state: { draft: 1 } })}>With state</button>
      <button onClick={() => go(-1)}>History back</button>
      <button onClick={() => confirmLeave(() => onLeave())}>Close panel</button>
      {modal}
    </>
  );
};

const mount = (dirty: boolean, label?: string) =>
  render(<MemoryRouter initialEntries={['/previous', '/edit']} initialIndex={1}><Screen dirty={dirty} label={label} /><Where /></MemoryRouter>);

afterEach(cleanup);

describe('useLeaveGuard', () => {
  it('goes at once when nothing was changed', () => {
    mount(false);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByTestId('where').textContent).toBe('/list');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('asks first when there are changes, naming the page and where it goes, and does not go yet', () => {
    mount(true, 'the Time-Limited Users');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('dialog').textContent).toContain('Leave Edit Thing for the Time-Limited Users');
    expect(screen.getByTestId('where').textContent).toBe('/edit');
  });

  it('keeps the person on the page and the changes when they stay', () => {
    mount(true);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Stay' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('where').textContent).toBe('/edit');
    expect(hasUnsavedScreen()).toBe(true);
  });

  it('goes where the person asked, after the confirmation, and forgets the pending move', () => {
    mount(true);
    fireEvent.click(screen.getByRole('button', { name: 'Breadcrumb' }));
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
    expect(screen.getByTestId('where').textContent).toBe('/other');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('tells the shell about the changes, so the sidebar and a reload ask too, and stops when they are saved', () => {
    const { rerender } = mount(true);
    expect(hasUnsavedScreen()).toBe(true);
    rerender(<MemoryRouter initialEntries={['/edit']}><Screen dirty={false} /><Where /></MemoryRouter>);
    expect(hasUnsavedScreen()).toBe(false);
  });

  it('two screens report on their own and the flag stays while either has changes', () => {
    const first = mount(true);
    const second = render(<MemoryRouter><Screen dirty /></MemoryRouter>);
    first.unmount();
    expect(hasUnsavedScreen()).toBe(true);
    second.unmount();
    expect(hasUnsavedScreen()).toBe(false);
  });
  it('keeps the options of the move (the state that carries a draft) through the confirmation, and passes them at once when nothing was changed', () => {
    mount(true);
    fireEvent.click(screen.getByRole('button', { name: 'With state' }));
    expect(screen.getByTestId('where').textContent).toBe('/edit');
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
    expect(screen.getByTestId('where').textContent).toBe('/draft');
    expect(screen.getByTestId('where').getAttribute('data-state')).toBe('{"draft":1}');
    cleanup();
    mount(false);
    fireEvent.click(screen.getByRole('button', { name: 'With state' }));
    expect(screen.getByTestId('where').getAttribute('data-state')).toBe('{"draft":1}');
  });
  it('goes back in the history (a number) after the confirmation, and at once when nothing was changed', () => {
    mount(true);
    fireEvent.click(screen.getByRole('button', { name: 'History back' }));
    expect(screen.getByTestId('where').textContent).toBe('/edit');
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
    expect(screen.getByTestId('where').textContent).toBe('/previous');
    cleanup();
    mount(false);
    fireEvent.click(screen.getByRole('button', { name: 'History back' }));
    expect(screen.getByTestId('where').textContent).toBe('/previous');
  });
  it('asks before a way out that is not a path (a callback) and runs it only after the confirmation, or at once when nothing was changed', () => {
    onLeave.mockClear();
    mount(true);
    fireEvent.click(screen.getByRole('button', { name: 'Close panel' }));
    expect(onLeave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Stay' }));
    expect(onLeave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Close panel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
    expect(onLeave).toHaveBeenCalledOnce();
    cleanup();
    mount(false);
    fireEvent.click(screen.getByRole('button', { name: 'Close panel' }));
    expect(onLeave).toHaveBeenCalledTimes(2);
  });
});
