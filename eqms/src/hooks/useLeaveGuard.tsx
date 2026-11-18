import React, { useCallback, useId, useState } from 'react';
import { useNavigate, type NavigateOptions } from 'react-router-dom';
import { NavigationGuardModal } from '@/components/ui/modal/NavigationGuardModal';
import { allowNextLeave, useReportUnsavedChanges } from './useReportUnsavedChanges';

/**
 * The one way a screen that keeps edits until its own Save protects them. Leaving with changes that were not saved asks first with the same "Leave without saving?" question as the sidebar, so nothing typed is lost by
 * a click on Back, Cancel, a breadcrumb or the button to another page; with nothing to lose it goes at once. The sidebar asks too, and so does a closed tab or a reload, because the
 * screen reports its changes to the shell (useReportUnsavedChanges).
 *
 * Returns the function to go with and the modal to render:
 *   const { go, modal } = useLeaveGuard(isDirty, 'Page title');
 *   <PageHeader breadcrumbItems={crumbs(go)} actions={<Button onClick={() => go(ROUTES.X)}>Back</Button>} />
 *   {modal}
 * `confirmLeave(action)` asks the same question before any other way out that is not a path (a callback that closes a panel or goes back). `go(path, options?)` also fits the breadcrumb builders, which take (path) => void, and `navigateBack`, which may go back in the history (a number); the options (state, replace) are kept for the move after the confirmation. A move that follows a successful Save is not a leave: it uses the plain `navigate`.
 */
export const useLeaveGuard = (dirty: boolean, pageTitle: string, destinationLabel = 'the list') => {
  const navigate = useNavigate();
  const [pending, setPending] = useState<(() => void) | null>(null);
  const screenId = useId();
  useReportUnsavedChanges(`leave-guard-${screenId}`, dirty);

  /** Runs the way out at once when nothing was changed, and after the confirmation when something was. */
  const confirmLeave = useCallback(
    (action: () => void) => {
      if (dirty) setPending(() => action);
      else action();
    },
    [dirty],
  );

  const go = useCallback(
    (to: string | number, options?: NavigateOptions) => {
      confirmLeave(() => {
        if (typeof to === 'number') navigate(to);
        else navigate(to, options);
      });
    },
    [confirmLeave, navigate],
  );

  const modal = (
    <NavigationGuardModal
      isOpen={pending !== null}
      onClose={() => setPending(null)}
      onConfirm={() => {
        const action = pending;
        setPending(null);
        allowNextLeave();
        action?.();
      }}
      currentPageTitle={pageTitle}
      destinationLabel={destinationLabel}
    />
  );
  return { go, confirmLeave, modal };
};
