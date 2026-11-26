import { Children, Fragment, isValidElement, type ReactElement, type ReactNode } from "react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Popover } from "@/components/ui/popover/Popover";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import { WorkflowProgressStepper } from "@/components/ui/workflow-stepper/WorkflowProgressStepper";
import type { WorkflowProgress } from "@/types/document";
import { CONTROL_STATE_CLASSES } from "@/components/ui/controlState";
import type { BreadcrumbItem } from "@/components/ui/breadcrumb/Breadcrumb";
import { useLanguage, tr, trFormat } from "@/i18n";

interface Props {
  title: string;
  breadcrumbItems: BreadcrumbItem[];
  onBack: () => void;
  /** The lifecycle stepper as the server worked it out (steps, current step, skipped steps, where the record ended). The screen only draws it. */
  workflow?: WorkflowProgress | null;
  tabs: TabItem[];
  activeTab: string;
  onTab: (id: string) => void;
  tabLayoutId: string;
  /** Command buttons that sit after Back in the footer row. */
  footer?: ReactNode;
  /** Buttons that sit beside Back at the top of the page, for the commands that are used often (they are also in the footer row when the page puts them there). */
  headerExtra?: ReactNode;
  /** Show the same Back and command buttons beside the title too, so they can be used without scrolling to the foot of the page. */
  repeatFooterInHeader?: boolean;
  /** A second card of tabs below the Back and command buttons, as in Document Details (the copies sent, for example). */
  afterFooter?: ReactNode;
  children: ReactNode;
}

/** The frame of every Training detail screen; it repeats the frame of Document Details (stepper, tab card, footer row). */
export function TrainingDetailLayout({ title, breadcrumbItems, onBack, workflow, tabs, activeTab, onTab, tabLayoutId, footer, headerExtra, repeatFooterInHeader = false, afterFooter, children }: Props) {
  return (
    <div className="w-full space-y-4 md:space-y-6">
      <div className="flex flex-col gap-4">
        <PageHeader
          title={title}
          breadcrumbItems={breadcrumbItems}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={onBack} size="sm" variant="outline-emerald" className="whitespace-nowrap">{tr("Back")}</Button>
              {headerExtra}
              {repeatFooterInHeader && footer}
            </div>
          }
        />
      </div>
      <WorkflowProgressStepper workflow={workflow} />
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <TabNav tabs={tabs} activeTab={activeTab} onChange={onTab} layoutId={tabLayoutId} />
        <div className="p-4 md:p-5">{children}</div>
      </div>
      <div className="flex flex-wrap items-center gap-2 md:gap-3">
        <Button onClick={onBack} size="sm" variant="outline-emerald" className="whitespace-nowrap">{tr("Back")}</Button>
        {footer}
      </div>
      {afterFooter}
    </div>
  );
}

/** A label with a read-only box, as in the General Information tab of Document Details. */
/** `multiline` shows a long text in a box of its own size (a read-only text area), not squeezed into one line. */
/**
 * `placeholder` explains an empty field ("Auto-generated after Save"): it is shown in the light placeholder colour with an empty value, never as the value, so it is not mistaken for data.
 */
export function ReadonlyField({ label, value, wide, multiline, placeholder = "—", hint, children }: { label: string; value?: string | null; wide?: boolean; multiline?: boolean; placeholder?: string; hint?: string; children?: ReactNode }) {
  const { tLabel } = useLanguage();
  return (
    <div className={`flex flex-col gap-1.5${wide ? " md:col-span-2" : ""}`}>
      <label className="text-xs font-medium text-slate-700 sm:text-sm capitalize">{tLabel(label)}</label>
      {children ?? (multiline
        ? <textarea value={value ?? ""} readOnly rows={3} className={CONTROL_STATE_CLASSES.readonlyTextarea} placeholder={tLabel(placeholder)} />
        : <input type="text" value={value ?? ""} readOnly className={CONTROL_STATE_CLASSES.readonlyField} placeholder={tLabel(placeholder)} />)}
      {hint && <p className="text-xs text-slate-500">{tLabel(hint)}</p>}
    </div>
  );
}

/** The cells of a grid, with fragments opened and the empty ones (false, null) left out. */
function gridCells(children: ReactNode): ReactElement[] {
  const out: ReactElement[] = [];
  Children.toArray(children).forEach((child) => {
    if (!isValidElement(child)) return;
    if (child.type === Fragment) out.push(...gridCells((child.props as { children?: ReactNode }).children));
    else out.push(child);
  });
  return out;
}

/** A field that takes the whole row: a wide field or a large text area. Its place is never changed. */
function isFullWidth(cell: ReactElement): boolean {
  const props = cell.props as { wide?: boolean; multiline?: boolean; className?: string };
  return Boolean(props.wide || props.multiline || props.className?.includes("col-span-2"));
}

/**
 * Two columns. A field is never left alone in a row beside an empty space: the next ordinary field is brought up to fill it (a full-width field and a large text area keep their place),
 * and when no ordinary field is left, the lone field takes the whole row.
 */
export function ReadonlyGrid({ children }: { children: ReactNode }) {
  const pending = gridCells(children);
  const placed: { cell: ReactElement; full: boolean }[] = [];
  let column = 0;
  while (pending.length > 0) {
    const cell = pending.shift() as ReactElement;
    if (isFullWidth(cell)) {
      if (column === 1) {
        const next = pending.findIndex((c) => !isFullWidth(c));
        if (next >= 0) placed.push({ cell: pending.splice(next, 1)[0], full: false });
        else placed[placed.length - 1].full = true;
        column = 0;
      }
      placed.push({ cell, full: false });
    } else {
      placed.push({ cell, full: false });
      column = column === 0 ? 1 : 0;
    }
  }
  if (column === 1 && placed.length > 0) placed[placed.length - 1].full = true;
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
      {placed.map(({ cell, full }, index) => (full ? <div key={cell.key ?? index} className="md:col-span-2">{cell}</div> : cell))}
    </div>
  );
}

/** A bordered block inside a tab (a table, an approval step). */
export function TabBlock({ title, action, hint, count, children }: {
  title?: string;
  action?: ReactNode;
  /** Long explanation kept out of the page: shown in a small popover beside the title. */
  hint?: ReactNode;
  /** How many lines the block holds, shown beside the title. */
  count?: number;
  children: ReactNode;
}) {
  const { tLabel } = useLanguage();
  return (
    <div className="space-y-3">
      {(title || action) && (
        <div className={`flex flex-wrap items-center gap-2 ${title ? "justify-between" : "justify-end"}`}>
          {title && (
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-800">{tLabel(title)}</h3>
              {count !== undefined && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{count}</span>}
              {hint && <Popover title={title} content={hint} contentClassName="w-80 max-w-[calc(100vw-2rem)]" triggerAriaLabel={trFormat("About {title}", { title })} />}
            </div>
          )}
          {action}
        </div>
      )}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">{children}</div>
    </div>
  );
}
