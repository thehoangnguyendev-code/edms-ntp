import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button/Button';
import { ButtonLoading } from '@/components/ui/loading/Loading';

interface UnsavedChangesBarProps {
  visible: boolean;
  saving?: boolean;
  message?: string;
  onSave: () => void;
  onDiscard: () => void;
}

/** Sticky bottom action bar shown whenever a form has unsaved edits — used by the Notification
 * Policy detail page, reusable anywhere a page needs the same "Save / Discard" affordance
 * instead of relying only on a header button that can scroll out of view. */
export const UnsavedChangesBar: React.FC<UnsavedChangesBarProps> = ({
  visible,
  saving = false,
  message = 'You have unsaved changes.',
  onSave,
  onDiscard,
}) => {
  if (!visible) return null;

  return (
    <div className="sticky bottom-0 z-20 -mx-4 -mb-4 border-t border-amber-200 bg-amber-50/95 px-4 py-3 backdrop-blur-sm md:-mx-5 md:-mb-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {message}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onDiscard} disabled={saving}>
            Discard
          </Button>
          <Button size="sm" onClick={onSave} disabled={saving}>
            {saving ? <ButtonLoading text="Saving..." light /> : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
};
