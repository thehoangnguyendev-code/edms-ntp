import React, { useRef, useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Drawer, type DrawerHandle } from '../Drawer';

beforeEach(() => { document.body.style.overflow = 'auto'; window.innerWidth = 1280; });
afterEach(() => { cleanup(); document.body.style.overflow = ''; });

describe('Shared Training-style Drawer', () => {
  it('does not render or lock the page while closed', () => {
    render(<Drawer open={false} title="Details" onClose={vi.fn()}>Content</Drawer>);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('auto');
  });

  it('renders one portal with header, body and footer slots', () => {
    const { container } = render(<Drawer title="Employee A" subtitle="Learning History" icon={<span>Icon</span>}
      headerActions={<span>EMP001</span>} description="Description" footer={<button>Export</button>} onClose={vi.fn()}>Record</Drawer>);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    const dialog = screen.getByRole('dialog', { name: 'Employee A' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveClass('rounded-2xl', 'right-4', 'top-4', 'bottom-4');
    expect(screen.getByText('Learning History')).toBeInTheDocument();
    expect(screen.getByText('EMP001')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByText('Export').closest('footer')).toBeInTheDocument();
  });

  it('closes once after animation and restores the original focus and scroll style', async () => {
    const onClose = vi.fn(), onExited = vi.fn();
    const trigger = document.createElement('button'); document.body.append(trigger); trigger.focus();
    render(<Drawer title="Details" onClose={onClose} onExited={onExited}>Content</Drawer>);
    expect(document.body.style.overflow).toBe('hidden');
    expect(screen.getByRole('dialog')).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' }); fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(onClose).toHaveBeenCalledTimes(1); expect(onExited).toHaveBeenCalledTimes(1);
    expect(document.body.style.overflow).toBe('auto'); expect(trigger).toHaveFocus(); trigger.remove();
  });

  it('external closing runs onExited without calling onClose and permits reopening', async () => {
    const onClose = vi.fn(), onExited = vi.fn();
    const { rerender } = render(<Drawer open title="Details" onClose={onClose} onExited={onExited}>Content</Drawer>);
    rerender(<Drawer open={false} title="Details" onClose={onClose} onExited={onExited}>Content</Drawer>);
    await waitFor(() => expect(onExited).toHaveBeenCalledOnce());
    expect(onClose).not.toHaveBeenCalled();
    rerender(<Drawer open title="Details" onClose={onClose}>Content</Drawer>);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('traps keyboard focus, including selects and textarea, and excludes hidden ancestors', () => {
    render(<Drawer title="Details" onClose={vi.fn()} footer={<textarea aria-label="Last" />}>
      <div style={{ display: 'none' }}><button>Hidden</button></div><select aria-label="Select"><option>A</option></select>
    </Drawer>);
    const first = screen.getByRole('button', { name: 'Close drawer' }), last = screen.getByLabelText('Last');
    fireEvent.keyDown(document, { key: 'Tab' }); expect(first).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true }); expect(last).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab' }); expect(first).toHaveFocus();
  });

  it('allows legacy conditional-mount consumers to close from their footer through a ref', async () => {
    const closed = vi.fn();
    const Consumer = () => {
      const ref = useRef<DrawerHandle>(null); const [mounted, setMounted] = useState(true);
      return mounted ? <Drawer ref={ref} title="Legacy" onClose={() => { closed(); setMounted(false); }}
        footer={<button onClick={() => ref.current?.close()}>Close footer</button>}>Content</Drawer> : null;
    };
    render(<Consumer />); fireEvent.click(screen.getByText('Close footer'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument()); expect(closed).toHaveBeenCalledOnce();
  });

  it('uses a mobile bottom sheet and supports keyboard resizing', () => {
    window.innerWidth = 375;
    render(<Drawer title="Mobile" onClose={vi.fn()}>Content</Drawer>);
    const dialog = screen.getByRole('dialog'); expect(dialog).toHaveClass('rounded-t-2xl'); expect(dialog.style.height).toBe('88dvh');
    fireEvent.keyDown(screen.getByLabelText('Resize drawer'), { key: 'ArrowUp' }); expect(dialog.style.height).toBe('100dvh');
    fireEvent.keyDown(screen.getByLabelText('Resize drawer'), { key: 'ArrowDown' }); expect(dialog.style.height).toBe('88dvh');
    act(() => { window.innerWidth = 1280; window.dispatchEvent(new Event('resize')); });
    expect(dialog).toHaveClass('right-4'); expect(screen.queryByLabelText('Resize drawer')).not.toBeInTheDocument();
  });

  it('only closes the top shared drawer and keeps scrolling locked while another remains', async () => {
    const firstClose = vi.fn(), secondClose = vi.fn();
    render(<><Drawer title="First" onClose={firstClose}>First body</Drawer><Drawer title="Second" onClose={secondClose}>Second body</Drawer></>);
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(secondClose).toHaveBeenCalledOnce()); expect(firstClose).not.toHaveBeenCalled();
    expect(document.body.style.overflow).toBe('hidden'); expect(screen.getByRole('dialog', { name: 'First' })).toBeInTheDocument();
  });

  it('closes by clicking the backdrop and cleans up immediately if unmounted', async () => {
    const onClose = vi.fn();
    const { unmount } = render(<Drawer title="Details" onClose={onClose}>Content</Drawer>);
    fireEvent.click(document.querySelector('[data-drawer-overlay] > [aria-hidden="true"]')!);
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce()); unmount();
    expect(document.body.style.overflow).toBe('auto');
  });
});
