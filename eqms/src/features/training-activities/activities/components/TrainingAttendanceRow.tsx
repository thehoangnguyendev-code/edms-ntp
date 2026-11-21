import { useState, type ReactNode } from "react";
import { MoreVertical } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";

/**
 * One person in the attendance list of the session workspace. On a desktop the status and every action sit at the right of the name; on a phone the line keeps two rows of text, one main action
 * (Mark) and a menu button that opens the other actions under the line, so six people do not fill three screens.
 */
export function TrainingAttendanceRow({ name, avatar, meta, notes, status, actions, quickAction, moreActions }: {
  name: string;
  avatar?: string | null;
  /** The second line: employee ID, department and so on, already joined. */
  meta: ReactNode;
  /** Extra lines under the name (added by hand, account note). */
  notes?: ReactNode;
  status: ReactNode;
  /** Every action, for a desktop. */
  actions: ReactNode;
  /** The one main action of a phone (Mark), when the person can be marked. */
  quickAction?: ReactNode;
  /** The other actions of a phone; the menu button is drawn only when there are some. */
  moreActions?: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <li className="px-4 py-3 transition-colors hover:bg-slate-50 md:px-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Avatar name={name || "User"} src={avatar ?? undefined} tone="brand" className="h-10 w-10 shrink-0 md:h-9 md:w-9" />
        <div className="min-w-0 flex-1 basis-32">
          <div className="line-clamp-2 break-words text-sm font-medium text-slate-900 md:line-clamp-1" title={name}>{name}</div>
          <div className="truncate text-xs text-slate-500">{meta}</div>
          {notes}
          <div className="mt-1 md:hidden">{status}</div>
        </div>
        <div className="hidden shrink-0 flex-wrap items-center justify-end gap-2 md:flex">
          {status}
          {actions}
        </div>
        <div className="flex shrink-0 items-center gap-1 md:hidden">
          {quickAction}
          {moreActions ? (
            <button
              type="button"
              aria-label={`More actions for ${name}`}
              aria-expanded={expanded}
              onClick={() => setExpanded((v) => !v)}
              className="grid h-10 w-10 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500"
            >
              <MoreVertical className="h-5 w-5" />
            </button>
          ) : null}
        </div>
      </div>
      {expanded && moreActions ? <div className="mt-2 flex justify-end md:hidden [&>div]:max-w-none">{moreActions}</div> : null}
    </li>
  );
}
