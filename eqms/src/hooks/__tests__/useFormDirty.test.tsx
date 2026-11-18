import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useFormDirty } from '../useFormDirty';

describe('useFormDirty', () => {
  it('is clean when the form is as it was first shown, and dirty after an edit, and clean again when the edit is undone', () => {
    const { result, rerender } = renderHook(({ form }) => useFormDirty(form), { initialProps: { form: { name: 'A', active: true } } });
    expect(result.current.isDirty).toBe(false);
    rerender({ form: { name: 'AB', active: true } });
    expect(result.current.isDirty).toBe(true);
    rerender({ form: { name: 'A', active: true } });
    expect(result.current.isDirty).toBe(false);
  });

  it('takes the first render with ready true as the start, so what the server filled in is not an edit', () => {
    const { result, rerender } = renderHook(({ form, ready }) => useFormDirty(form, ready), { initialProps: { form: { name: '' }, ready: false } });
    expect(result.current.isDirty).toBe(false);
    rerender({ form: { name: 'From the server' }, ready: true });
    expect(result.current.isDirty).toBe(false);
    rerender({ form: { name: 'From the server, edited' }, ready: true });
    expect(result.current.isDirty).toBe(true);
  });

  it('is never dirty while the form is not ready, whatever it holds', () => {
    const { result, rerender } = renderHook(({ form, ready }) => useFormDirty(form, ready), { initialProps: { form: { name: 'x' }, ready: false } });
    rerender({ form: { name: 'xy' }, ready: false });
    expect(result.current.isDirty).toBe(false);
  });

  it('a new form that starts blank is dirty as soon as something is typed', () => {
    const { result, rerender } = renderHook(({ form }) => useFormDirty(form), { initialProps: { form: { name: '', note: '' } } });
    expect(result.current.isDirty).toBe(false);
    rerender({ form: { name: 'T', note: '' } });
    expect(result.current.isDirty).toBe(true);
  });

  it('markSaved makes the current values the new start', () => {
    const { result, rerender } = renderHook(({ form }) => useFormDirty(form), { initialProps: { form: { name: 'A' } } });
    rerender({ form: { name: 'B' } });
    expect(result.current.isDirty).toBe(true);
    act(() => result.current.markSaved());
    rerender({ form: { name: 'B' } });
    expect(result.current.isDirty).toBe(false);
    rerender({ form: { name: 'C' } });
    expect(result.current.isDirty).toBe(true);
  });
});
