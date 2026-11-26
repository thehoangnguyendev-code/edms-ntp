import React, { useCallback, useId, useState } from 'react';
import { useNavigate, type NavigateOptions } from 'react-router-dom';
import { NavigationGuardModal } from '@/components/ui/modal/NavigationGuardModal';
import { NAV_CONFIG, findNodeByPath } from '@/app/navigation';
import { previousRoute } from '@/app/navigation/routeTrail';
import { tr } from '@/i18n';
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
/** The name of the screen a path leads to: its menu entry (a detail or edit address gives the menu entry of its list). Undefined when no menu entry covers it. */
const nameOfPath = (path: string): string | undefined => {
  const label = findNodeByPath(NAV_CONFIG, path.split(/[?#]/)[0])?.label;
  return label ? tr(label) : undefined;
};

export const useLeaveGuard = (dirty: boolean, pageTitle: string, destinationLabel = 'the list') => {
  const navigate = useNavigate();
  const [pending, setPending] = useState<(() => void) | null>(null);
  // Where the way out leads, as the person knows it: the name of that screen, never "the previous page". The label the screen gave is only the fallback.
  const [target, setTarget] = useState<string | undefined>();
  const screenId = useId();
  useReportUnsavedChanges(`leave-guard-${screenId}`, dirty);

  /** Runs the way out at once when nothing was changed, and after the confirmation when something was. */
  const confirmLeave = useCallback(
    (action: () => void, destination?: string) => {
      if (dirty) {
        setTarget(destination);
        setPending(() => action);
      } else action();
    },
    [dirty],
  );

  const go = useCallback(
    (to: string | number, options?: NavigateOptions) => {
      const destination = typeof to === 'string' ? nameOfPath(to) : to === -1 ? (previousRoute() ? nameOfPath(previousRoute()!) : undefined) : undefined;
      confirmLeave(() => {
        if (typeof to === 'number') navigate(to);
        else navigate(to, options);
      }, destination);
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
      destinationLabel={target ?? (destinationLabel === 'the previous page' && previousRoute() ? nameOfPath(previousRoute()!) : undefined) ?? tr(destinationLabel)}
    />
  );
  return { go, confirmLeave, modal };
};
