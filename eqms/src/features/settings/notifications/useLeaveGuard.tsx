import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NavigationGuardModal } from '@/components/ui/modal/NavigationGuardModal';

/**
 * Leaving an edit screen with changes that were not saved asks first, so nothing typed is lost by a click on Back or on the button to the other channel; with nothing to lose it
 * goes at once. A closed tab or a reload asks too. Returns the function to go with and the modal to render.
 */
export const useLeaveGuard = (dirty: boolean, pageTitle: string, destinationLabel = 'the list') => {
  const navigate = useNavigate();
  const [pending, setPending] = useState<string | null>(null);

  const go = useCallback(
    (path: string) => {
      if (dirty) setPending(path);
      else navigate(path);
    },
    [dirty, navigate],
  );

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const modal = (
    <NavigationGuardModal
      isOpen={pending !== null}
      mode="discard"
      onClose={() => setPending(null)}
      onConfirm={() => {
        const path = pending;
        setPending(null);
        if (path) navigate(path);
      }}
      currentPageTitle={pageTitle}
      destinationLabel={destinationLabel}
    />
  );
  return { go, modal };
};
