import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useDashboardResource } from '../useDashboardResource';

describe('useDashboardResource', () => {
  it('returns the same object while nothing changes, so the cards that receive it do not render again', async () => {
    const load = vi.fn().mockResolvedValue({ n: 1 });
    const { result, rerender } = renderHook(() => useDashboardResource(load, []));
    await waitFor(() => expect(result.current.data).toEqual({ n: 1 }));

    const settled = result.current;
    rerender();
    rerender();

    expect(result.current).toBe(settled);
    expect(result.current.reload).toBe(settled.reload);
  });

  it('gives a new object when the data, the loading flag or the error changes', async () => {
    const load = vi.fn().mockResolvedValueOnce({ n: 1 }).mockResolvedValueOnce({ n: 2 });
    const { result } = renderHook(() => useDashboardResource(load, []));
    await waitFor(() => expect(result.current.data).toEqual({ n: 1 }));
    const first = result.current;

    act(() => result.current.reload());
    await waitFor(() => expect(result.current.data).toEqual({ n: 2 }));

    expect(result.current).not.toBe(first);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('keeps the last data while it reloads, and reports a failure with no data rather than a stale number', async () => {
    const load = vi.fn().mockResolvedValueOnce({ n: 1 }).mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useDashboardResource(load, []));
    await waitFor(() => expect(result.current.data).toEqual({ n: 1 }));

    act(() => result.current.reload());
    await waitFor(() => expect(result.current.error).toBe(true));

    expect(result.current.data).toBeNull();
  });
});
