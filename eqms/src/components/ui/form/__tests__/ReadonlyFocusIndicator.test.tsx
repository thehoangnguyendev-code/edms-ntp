import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ReadonlyFocusIndicator } from '../ReadonlyFocusIndicator';

const attribute = 'data-readonly-visual-focus';

function Fixture() {
  const navigate = useNavigate();
  return <>
    <ReadonlyFocusIndicator />
    <button onClick={() => navigate('/next')}>Next page</button>
    <input aria-label="Readonly status" readOnly disabled value="In progress" />
    <textarea aria-label="Readonly note" readOnly disabled value="Note" />
    <input aria-label="Editable name" defaultValue="Name" />
    <input aria-label="Busy input" disabled value="Busy" />
  </>;
}

describe('UI-only focus border on disabled readonly fields', () => {
  it('marks the clicked field without enabling it, focusing it or calling input handlers', () => {
    const change = vi.fn();
    const click = vi.fn();
    render(<MemoryRouter><ReadonlyFocusIndicator /><input aria-label="Status" value="In progress" disabled readOnly onChange={change} onClick={click} /></MemoryRouter>);
    const field = screen.getByRole('textbox');
    fireEvent.pointerDown(field, { button: 0 });
    fireEvent.focusIn(field.parentElement!);
    expect(field).toHaveAttribute(attribute, 'true');
    expect(field).toBeDisabled();
    expect(field).toHaveAttribute('readonly');
    expect(field).not.toHaveFocus();
    expect(field).toHaveValue('In progress');
    expect(change).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
  });

  it('moves the visual border between fields and clears it on an outside click', () => {
    render(<MemoryRouter><Fixture /></MemoryRouter>);
    const first = screen.getByLabelText('Readonly status');
    const second = screen.getByLabelText('Readonly note');
    fireEvent.pointerDown(first);
    fireEvent.pointerDown(second);
    expect(first).not.toHaveAttribute(attribute);
    expect(second).toHaveAttribute(attribute, 'true');
    fireEvent.pointerDown(screen.getByLabelText('Editable name'));
    expect(second).not.toHaveAttribute(attribute);
    fireEvent.pointerDown(screen.getByLabelText('Busy input'));
    expect(screen.getByLabelText('Busy input')).not.toHaveAttribute(attribute);
  });

  it('clears the border when native focus moves, Tab/Escape is pressed or the window blurs', () => {
    render(<MemoryRouter><Fixture /></MemoryRouter>);
    const field = screen.getByLabelText('Readonly status');
    for (const key of ['Tab', 'Escape']) {
      fireEvent.pointerDown(field);
      fireEvent.keyDown(document, { key });
      expect(field).not.toHaveAttribute(attribute);
    }
    fireEvent.pointerDown(field);
    fireEvent.focusIn(screen.getByLabelText('Editable name'));
    expect(field).not.toHaveAttribute(attribute);
    fireEvent.pointerDown(field);
    fireEvent.blur(window);
    expect(field).not.toHaveAttribute(attribute);
  });

  it('marks disabled picker buttons but never dispatches their selection actions', () => {
    const onClick = vi.fn();
    render(<MemoryRouter><ReadonlyFocusIndicator /><button role="combobox" disabled onClick={onClick}>Department</button></MemoryRouter>);
    const field = screen.getByRole('combobox');
    fireEvent.pointerDown(field);
    expect(field).toHaveAttribute(attribute, 'true');
    expect(field).toBeDisabled();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('cleans up on route changes and unmount', () => {
    const { unmount } = render(<MemoryRouter><Fixture /></MemoryRouter>);
    const field = screen.getByLabelText('Readonly status');
    fireEvent.pointerDown(field);
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(field).not.toHaveAttribute(attribute);
    fireEvent.pointerDown(field);
    unmount();
    expect(field).not.toHaveAttribute(attribute);
    fireEvent.pointerDown(field);
    expect(field).not.toHaveAttribute(attribute);
  });
});
