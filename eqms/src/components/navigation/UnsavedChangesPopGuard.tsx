import React from 'react';
import { useBlocker } from 'react-router-dom';
import { NavigationGuardModal } from '@/components/ui/modal/NavigationGuardModal';
import { hasUnsavedScreen, isLeaveAllowed } from '@/hooks/useReportUnsavedChanges';
import { tr } from "@/i18n";

/**
 * The browser's Back and Forward buttons (a POP in the history) do not go through the Back / Cancel / breadcrumb / sidebar of a screen, so those screens cannot ask for them. While a screen
 * reports changes that were not saved (useReportUnsavedChanges), this asks the same question for a POP: "Stay" puts the person back on the page with everything typed; "Leave" lets the move happen.
 * A move the screen has just confirmed itself (useLeaveGuard) is let through without asking a second time. Needs a data router (createBrowserRouter).
 */
export const UnsavedChangesPopGuard: React.FC = () => {
  const blocker = useBlocker(({ historyAction }) => historyAction === 'POP' && hasUnsavedScreen() && !isLeaveAllowed());
  return (
    <NavigationGuardModal
      isOpen={blocker.state === 'blocked'}
      mode="discard"
      title={tr("Leave without saving?")}
      description={<p>{tr("You have unsaved changes on this page. If you go back now, they will be lost.")}</p>}
      primaryActionLabel={tr("Leave Anyway")}
      secondaryActionLabel={tr("Stay on page")}
      onClose={() => blocker.state === 'blocked' && blocker.reset()}
      onConfirm={() => blocker.state === 'blocked' && blocker.proceed()}
    />
  );
};
