import React, { useState } from "react";
import { Clock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button/Button";
import { formatDateTime } from "@/utils/format";

export interface RevisionWorkingNoteItem {
  id: string;
  author?: string | null;
  authorUsername?: string | null;
  timestamp?: string | null;
  content: string;
  workflowStage?: string | null;
  workflowStageLabel?: string | null;
  canDelete?: boolean;
}

interface WorkingNotesTabProps {
  notes?: RevisionWorkingNoteItem[];
  onAddNote?: (content: string) => Promise<void> | void;
  onDeleteNote?: (id: string) => Promise<void> | void;
  isSubmitting?: boolean;
  isReadOnly?: boolean;
}

export const WorkingNotesTab: React.FC<WorkingNotesTabProps> = ({
  notes = [],
  onAddNote,
  onDeleteNote,
  isSubmitting = false,
  isReadOnly = false,
}) => {
  const [input, setInput] = useState("");

  const handleAddNote = async () => {
    if (!input.trim() || !onAddNote) return;
    await onAddNote(input.trim());
    setInput("");
  };

  const handleDeleteNote = async (id: string) => {
    if (!onDeleteNote) return;
    await onDeleteNote(id);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      void handleAddNote();
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2">
        {!isReadOnly && (
          <>
            <label className="text-xs sm:text-sm font-medium text-slate-700">Working Note</label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter your working note or comment about this revision... (Ctrl+Enter to submit)"
              rows={4}
              disabled={isReadOnly || isSubmitting}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-slate-400"
            />
            <div className="flex items-center justify-start">
              <Button
                size="sm"
                onClick={() => void handleAddNote()}
                loading={isSubmitting}
                disabled={!input.trim() || isReadOnly || !onAddNote}
                className="bg-emerald-600 hover:bg-emerald-700 text-white disabled:bg-slate-300"
              >
                Add Note
              </Button>
            </div>
          </>
        )}
      </div>

      <div className="space-y-3">
        {notes.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
            No working notes have been added.
          </div>
        )}
        {notes.map((note) => (
          <div
            key={note.id}
            className="group relative bg-amber-50 border border-amber-200 rounded-xl p-4 md:p-5 transition-all hover:shadow-sm"
          >
            <div className="flex items-center justify-between gap-3 mb-2">
              <span className="text-xs font-semibold text-amber-800">
                {note.author || note.authorUsername || "Unknown User"}
              </span>
              <div className="flex items-center gap-3">
                <span className="rounded-full border border-amber-200 bg-white px-2 py-0.5 text-[11px] font-medium text-amber-700">
                  {note.workflowStageLabel || "Previous Stage"}
                </span>
                <span className="flex items-center gap-1 text-xs text-amber-600">
                  {formatDateTime(note.timestamp || "")}
                </span>
                {note.canDelete && onDeleteNote && !isReadOnly && (
                  <button
                    onClick={() => void handleDeleteNote(note.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-amber-600 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                    title="Delete note"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{note.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
