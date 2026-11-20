import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const http = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock('@/services/api/client', () => ({ api: http }));

import { GIB, parseStoragePolicy, useStoragePolicyDraft } from '../useStoragePolicyDraft';

const status = (budgetBytes: number | null, warningPercent = 80) => ({ data: { policy: { budgetBytes, warningPercent }, warning: false, scanState: null } });

beforeEach(() => { http.get.mockReset(); http.put.mockReset(); });

describe('parseStoragePolicy', () => {
  it('turns GiB into bytes, and an empty budget into "no budget"', () => {
    expect(parseStoragePolicy({ budget: '1.5', threshold: '80' }).value).toEqual({ budgetBytes: 1.5 * GIB, warningPercent: 80 });
    expect(parseStoragePolicy({ budget: ' ', threshold: '90' }).value).toEqual({ budgetBytes: null, warningPercent: 90 });
  });

  it('names what is wrong, field by field', () => {
    expect(parseStoragePolicy({ budget: '0', threshold: '80' }).errors.budget).toBeTruthy();
    expect(parseStoragePolicy({ budget: '-3', threshold: '80' }).value).toBeNull();
    expect(parseStoragePolicy({ budget: 'abc', threshold: '80' }).errors.budget).toBeTruthy();
    expect(parseStoragePolicy({ budget: '2', threshold: '0' }).errors.threshold).toBeTruthy();
    expect(parseStoragePolicy({ budget: '2', threshold: '100.5' }).errors.threshold).toBeTruthy();
    expect(parseStoragePolicy({ budget: '2', threshold: '' }).errors.threshold).toBeTruthy();
  });
});

describe('useStoragePolicyDraft', () => {
  it('loads only when enabled, and starts clean', async () => {
    http.get.mockResolvedValue(status(2 * GIB));
    const { result, rerender } = renderHook(({ on }) => useStoragePolicyDraft(on), { initialProps: { on: false } });
    expect(http.get).not.toHaveBeenCalled();

    rerender({ on: true });
    await waitFor(() => expect(result.current.draft).toEqual({ budget: '2', threshold: '80' }));
    expect(result.current.isDirty).toBe(false);
    expect(result.current.isValid).toBe(true);
  });

  it('is dirty and valid for a good edit, dirty and invalid for a bad one, and Reset puts it back', async () => {
    http.get.mockResolvedValue(status(null));
    const { result } = renderHook(() => useStoragePolicyDraft(true));
    await waitFor(() => expect(result.current.draft).not.toBeNull());

    act(() => result.current.setDraft({ budget: '5', threshold: '80' }));
    expect(result.current.isDirty).toBe(true);
    expect(result.current.isValid).toBe(true);
    expect(result.current.effective).toEqual({ budgetBytes: 5 * GIB, warningPercent: 80 });

    act(() => result.current.setDraft({ budget: '-1', threshold: '80' }));
    expect(result.current.isValid).toBe(false);
    expect(result.current.effective).toEqual({ budgetBytes: null, warningPercent: 80 }); // while it cannot be saved the screen keeps reasoning with the saved policy

    act(() => result.current.reset());
    expect(result.current.isDirty).toBe(false);
    expect(result.current.draft).toEqual({ budget: '', threshold: '80' });
  });

  it('writes the policy in bytes, reads it back, and is clean again; nothing is written when nothing changed', async () => {
    http.get.mockResolvedValueOnce(status(null)).mockResolvedValueOnce(status(1.5 * GIB, 70));
    http.put.mockResolvedValue({ data: {} });
    const { result } = renderHook(() => useStoragePolicyDraft(true));
    await waitFor(() => expect(result.current.draft).not.toBeNull());

    await act(async () => { await result.current.save(); });
    expect(http.put).not.toHaveBeenCalled();

    act(() => result.current.setDraft({ budget: '1.5', threshold: '70' }));
    await act(async () => { await result.current.save(); });
    expect(http.put).toHaveBeenCalledWith('/settings/storage-usage/policy', { budgetBytes: 1.5 * GIB, warningPercent: 70 });
    expect(result.current.isDirty).toBe(false);
    expect(result.current.draft).toEqual({ budget: '1.5', threshold: '70' });
  });

  it('does not write a draft that is not valid, and keeps a rejected draft for another try', async () => {
    http.get.mockResolvedValue(status(null));
    http.put.mockRejectedValueOnce(new Error('refused'));
    const { result } = renderHook(() => useStoragePolicyDraft(true));
    await waitFor(() => expect(result.current.draft).not.toBeNull());

    act(() => result.current.setDraft({ budget: '-2', threshold: '80' }));
    await act(async () => { await result.current.save(); });
    expect(http.put).not.toHaveBeenCalled();

    act(() => result.current.setDraft({ budget: '2', threshold: '80' }));
    await act(async () => { await expect(result.current.save()).rejects.toThrow('refused'); });
    expect(result.current.isDirty).toBe(true);
    expect(result.current.draft).toEqual({ budget: '2', threshold: '80' });
  });

  it('can be retried after the load failed', async () => {
    http.get.mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce(status(GIB));
    const { result } = renderHook(() => useStoragePolicyDraft(true));
    await waitFor(() => expect(result.current.failed).toBe(true));

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.draft?.budget).toBe('1'));
    expect(result.current.failed).toBe(false);
  });
});
