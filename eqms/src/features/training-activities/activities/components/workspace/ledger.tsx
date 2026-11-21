import type { ReactNode } from "react";

/**
 * The plain list the Assessment step is drawn with: two lines of text for each record (what it is, then the small facts), its state as a word, and its actions. No boxes inside the list.
 * On a desktop the state and the actions sit at the right of the text; on a phone they take their own lines under it, the text actions on the left and the one main action on the right.
 */
export type StateTone = "mute" | "amber" | "blue" | "red";

const TONE: Record<StateTone, string> = { mute: "text-slate-500", amber: "text-amber-700", blue: "text-blue-700", red: "text-red-700" };

export function LedgerList({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-slate-100">{children}</ul>;
}

export function LedgerRow({ title, meta, state, tone = "mute", actions, primary }: {
  title: ReactNode;
  meta?: ReactNode;
  state?: ReactNode;
  tone?: StateTone;
  /** Text actions, on the left on a phone. */
  actions?: ReactNode;
  /** The one main action (or the row menu), on the right. */
  primary?: ReactNode;
}) {
  const hasActions = Boolean(actions || primary);
  return (
    <li className="py-3.5 md:flex md:items-center md:gap-6">
      <div className="min-w-0 flex-1">
        <div className="break-words text-sm text-slate-900">{title}</div>
        {meta ? <div className="break-words text-[13px] leading-5 text-slate-500">{meta}</div> : null}
      </div>
      {state || hasActions ? (
        <div className="mt-1.5 md:mt-0 md:flex md:shrink-0 md:items-center md:gap-4">
          {/* a row with only its menu button keeps it on the line of its state, at the right */}
          {state && !actions && primary ? (
            <div className="flex items-center justify-between gap-4">
              <span className={`text-sm ${TONE[tone]}`}>{state}</span>
              {primary}
            </div>
          ) : null}
          {state && !(!actions && primary) ? <div className={`text-sm ${TONE[tone]}`}>{state}</div> : null}
          {hasActions && !(state && !actions && primary) ? (
            <div className="mt-1 flex items-center justify-between gap-4 md:mt-0 md:justify-end">
              <span className="flex items-center gap-5 md:gap-4">{actions}</span>
              {primary}
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

/** A text action of a row: a word, not a box. */
export function LedgerAction({ children, onClick, disabled, danger = false, label }: { children: ReactNode; onClick?: () => void; disabled?: boolean; danger?: boolean; label?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`h-9 rounded text-sm font-medium transition-colors hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 md:h-auto ${danger ? "text-red-700" : "text-slate-700"}`}
    >
      {children}
    </button>
  );
}

/** What a block shows when there is nothing to list. */
export function LedgerEmpty({ children }: { children: ReactNode }) {
  return <p className="py-4 text-sm text-slate-500">{children}</p>;
}

/** The strip of actions above the list of a block (the buttons that start something): at the right on a desktop, the full width on a phone. */
export function LedgerToolbar({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:justify-end [&>button]:w-full md:[&>button]:w-auto">{children}</div>;
}

/** The few words of guidance at the top of a block: what the list is for and what the person does with it. */
export function LedgerNote({ children }: { children: ReactNode }) {
  return <p className="text-[13px] leading-5 text-slate-500">{children}</p>;
}
