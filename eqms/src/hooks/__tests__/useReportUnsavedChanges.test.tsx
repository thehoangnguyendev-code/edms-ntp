import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasUnsavedScreen, useReportUnsavedChanges } from '../useReportUnsavedChanges';

const Screen: React.FC<{ id: string; dirty: boolean }> = ({ id, dirty }) => {
  useReportUnsavedChanges(id, dirty);
  return null;
};

afterEach(cleanup);

describe('useReportUnsavedChanges', () => {
  it('reports a screen with changes, and nothing when it has none', () => {
    const { rerender } = render(<Screen id="a" dirty={false} />);
    expect(hasUnsavedScreen()).toBe(false);
    rerender(<Screen id="a" dirty />);
    expect(hasUnsavedScreen()).toBe(true);
    rerender(<Screen id="a" dirty={false} />);
    expect(hasUnsavedScreen()).toBe(false);
  });

  it('forgets the screen when it goes away with changes still in it', () => {
    const { unmount } = render(<Screen id="a" dirty />);
    expect(hasUnsavedScreen()).toBe(true);
    unmount();
    expect(hasUnsavedScreen()).toBe(false);
  });

  it('keeps the flag while any one of several screens has changes', () => {
    const first = render(<Screen id="a" dirty />);
    const second = render(<Screen id="b" dirty />);
    first.unmount();
    expect(hasUnsavedScreen()).toBe(true);
    second.unmount();
    expect(hasUnsavedScreen()).toBe(false);
  });

  it('asks before the tab is closed or reloaded while there are changes, and not otherwise', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const { rerender, unmount } = render(<Screen id="a" dirty={false} />);
    expect(add.mock.calls.filter(([type]) => type === 'beforeunload')).toHaveLength(0);
    rerender(<Screen id="a" dirty />);
    const handler = add.mock.calls.find(([type]) => type === 'beforeunload')?.[1] as (event: BeforeUnloadEvent) => void;
    const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
    handler(event);
    expect(event.defaultPrevented).toBe(true);
    unmount();
    expect(remove.mock.calls.filter(([type]) => type === 'beforeunload')).toHaveLength(1);
    add.mockRestore();
    remove.mockRestore();
  });
});
