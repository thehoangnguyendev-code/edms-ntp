import React from "react";
import { Info } from "lucide-react";

/**
 * Shown in place of the Training tab's fields for a controlled-document template. A template is never a
 * training trigger (the server refuses to make one require training and clears its training fields), so the
 * default "Requires Training? / Reason for skipping training" fields would only mislead.
 */
export const TemplateNoTrainingNotice: React.FC = () => (
  <div className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3.5 text-sm text-sky-900">
    <div className="space-y-1">
      <p className="font-medium">Training does not apply to a controlled document template.</p>
      <p className="text-xs sm:text-sm text-sky-800">
        A template is kept as a Word file for others to start new documents from, so it never requires training
        and has no training period, planned date or completion date. Training applies to the documents created
        from it.
      </p>
    </div>
  </div>
);
