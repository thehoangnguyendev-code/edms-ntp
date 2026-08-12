import React from "react";
import { Reply } from "lucide-react";

interface EmailLivePreviewProps {
  subject: string;
  content?: string;
  variables?: string[];
  copyright?: string;
  contactEmail?: string;
  logoUrl?: string;
  renderedSubject?: string;
  renderedHtml?: string;
}

export const EmailLivePreview: React.FC<EmailLivePreviewProps> = ({
  subject,
  renderedSubject,
  renderedHtml,
}) => {
  const previewSubject = renderedSubject || subject || "No subject";
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long",
    day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      {/* Window Top Bar */}
      <div className="h-11 bg-gradient-to-b from-slate-50 to-slate-100/50 border-b border-slate-200 flex items-center px-4 justify-between select-none">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400 border border-red-500/50" />
          <div className="w-3 h-3 rounded-full bg-amber-400 border border-amber-500/50" />
          <div className="w-3 h-3 rounded-full bg-emerald-400 border border-emerald-500/50" />
        </div>
        <div className="text-xs text-slate-600 bg-white/70 px-3 py-1 rounded-lg border border-slate-200 max-w-[50%] truncate">
          {previewSubject}
        </div>
        <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400">
          <Reply className="h-3.5 w-3.5" />
        </div>
      </div>

      {/* Email Header */}
      <div className="px-6 pt-5 pb-4 border-b border-slate-100 bg-white">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white font-bold text-base shadow-sm ring-2 ring-emerald-50 flex-shrink-0">
              S
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">System Notification</p>
              <p className="text-xs text-slate-500">noreply@eqms.example.com</p>
            </div>
          </div>
          <span className="text-xs text-slate-400 whitespace-nowrap">{today}</span>
        </div>
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-400 w-14">To:</span>
            <span className="text-xs font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              user@example.com
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-medium text-slate-400 w-14">Subject:</span>
            <span className="text-sm font-bold text-slate-900">{previewSubject}</span>
          </div>
        </div>
      </div>

      {/* Email Body */}
      <div className="bg-slate-100 overflow-y-auto max-h-[520px] scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-50">
        {renderedHtml ? (
          <iframe
            sandbox="allow-same-origin"
            srcDoc={renderedHtml}
            className="w-full border-0 block"
            style={{ minHeight: 480 }}
            title="Email Preview"
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center px-6">
            <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center">
              <Reply className="h-4 w-4 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-500">Switch to Preview mode to see the rendered email</p>
            <p className="text-xs text-slate-400">The backend will apply branding, layout, and variable substitution</p>
          </div>
        )}
      </div>
    </div>
  );
};
