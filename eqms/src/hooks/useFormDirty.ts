import { useCallback, useRef } from 'react';

/**
 * Whether the person has changed a form since it was loaded (or since it was last saved), for the screens that have no "saved" copy to compare with. The values are compared as they
 * are written to JSON, so give it the values of the fields (an object) and not a function or a DOM node. The first render with `ready` true is the starting point: pass `ready` false while
 * the form is still being filled from the server, so what the server returned is not mistaken for the person's edit. After a save that keeps the person on the screen, call `markSaved()`.
 *
 *   const dirty = useFormDirty(form, !loading);
 *   const { go, modal } = useLeaveGuard(dirty.isDirty, 'Edit School');
 */
/**
 * The same question for a dialog that stays mounted and fills its form from an `item` in an effect when it opens (the dictionary-style Edit / New dialogs). The first value the form
 * takes after the dialog opens is what the server or the empty form gave, so that value is the starting point; anything after it is the person's edit. Closed means not dirty.
 * Pass it to `FormModal` as `dirty`.
 */
export const useOpenedFormDirty = (value: unknown, isOpen: boolean): boolean => {
  const openedWith = useRef<unknown>(null);
  const wasOpen = useRef(false);
  const baseline = useRef<string | null>(null);
  if (!isOpen) {
    wasOpen.current = false;
    baseline.current = null;
    return false;
  }
  if (!wasOpen.current) {
    wasOpen.current = true;
    openedWith.current = value;
    baseline.current = null;
  } else if (baseline.current === null && value !== openedWith.current) {
    baseline.current = JSON.stringify(value);
  }
  return baseline.current !== null && JSON.stringify(value) !== baseline.current;
};

export const useFormDirty = (value: unknown, ready = true): { isDirty: boolean; markSaved: () => void } => {
  const baseline = useRef<string | null>(null);
  const latest = useRef<string>('');
  latest.current = JSON.stringify(value);
  if (!ready) baseline.current = null;
  else if (baseline.current === null) baseline.current = latest.current;
  const markSaved = useCallback(() => {
    baseline.current = latest.current;
  }, []);
  return { isDirty: ready && baseline.current !== null && latest.current !== baseline.current, markSaved };
};
