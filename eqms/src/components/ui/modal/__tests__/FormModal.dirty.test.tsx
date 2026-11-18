import React, { useEffect, useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FormModal } from '../FormModal';
import { useOpenedFormDirty } from '@/hooks/useFormDirty';

afterEach(cleanup);

const Plain: React.FC<{ dirty?: boolean; onClose: () => void; onConfirm?: () => void }> = ({ dirty, onClose, onConfirm }) => (
  <FormModal isOpen onClose={onClose} onConfirm={onConfirm} dirty={dirty} title="Edit Thing">
    <p>body</p>
  </FormModal>
);

describe('FormModal asks before it closes a form that has unsaved changes', () => {
  it('closes at once when nothing was changed (the default)', () => {
    const onClose = vi.fn();
    render(<Plain onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Discard unsaved changes?')).toBeNull();
  });

  it.each([
    ['Cancel', () => fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))],
    ['the X', () => fireEvent.click(screen.getByRole('button', { name: 'Close' }))],
    ['Esc', () => fireEvent.keyDown(document, { key: 'Escape' })],
  ])('asks first when changes were made, then %s keeps the dialog on "Keep editing"', async (_name, close) => {
    const onClose = vi.fn();
    render(<Plain dirty onClose={onClose} />);
    close();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('Discard unsaved changes?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(onClose).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText('Discard unsaved changes?')).toBeNull());
  });

  it('closes after "Discard Changes"', () => {
    const onClose = vi.fn();
    render(<Plain dirty onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard Changes' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Esc inside the question answers the question and does not stack a second one', async () => {
    const onClose = vi.fn();
    render(<Plain dirty onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByText('Discard unsaved changes?')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByText('Discard unsaved changes?')).toBeNull());
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Save is not a close and is not asked', () => {
    const onConfirm = vi.fn();
    render(<Plain dirty onClose={vi.fn()} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Discard unsaved changes?')).toBeNull();
  });
});

// A dictionary-style dialog: stays mounted, fills its form from the item in an effect when it opens.
const Dictionary: React.FC<{ item: { name: string } | null; isOpen: boolean; onClose: () => void }> = ({ item, isOpen, onClose }) => {
  const [formData, setFormData] = useState({ name: '' });
  useEffect(() => {
    setFormData(item ? { name: item.name } : { name: '' });
  }, [item, isOpen]);
  const dirty = useOpenedFormDirty(formData, isOpen);
  return (
    <FormModal isOpen={isOpen} onClose={onClose} dirty={dirty} title="Edit Department">
      <input aria-label="Name" value={formData.name} onChange={(e) => setFormData({ name: e.target.value })} />
    </FormModal>
  );
};

describe('useOpenedFormDirty with a dialog that fills itself from an item', () => {
  it('what the effect filled in is not an edit; a typed change is', () => {
    const onClose = vi.fn();
    render(<Dictionary item={{ name: 'Quality' }} isOpen onClose={onClose} />);
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Quality');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1); // untouched: closes without a question

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Quality Assurance' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1); // typed: asks
    expect(screen.getByText('Discard unsaved changes?')).toBeTruthy();
  });

  it('typing the original value back is not a change', () => {
    const onClose = vi.fn();
    render(<Dictionary item={{ name: 'Quality' }} isOpen onClose={onClose} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Quality x' } });
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Quality' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('a new open starts clean after a dirty one was discarded', () => {
    const onClose = vi.fn();
    const { rerender } = render(<Dictionary item={null} isOpen onClose={onClose} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'half typed' } });
    rerender(<Dictionary item={null} isOpen={false} onClose={onClose} />);
    rerender(<Dictionary item={null} isOpen onClose={onClose} />);
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Discard unsaved changes?')).toBeNull();
  });
});
