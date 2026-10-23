import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import { WorkflowStepper } from "@/components/ui/workflow-stepper/WorkflowStepper";
import { CONTROL_STATE_CLASSES } from "@/components/ui/controlState";
import type { BreadcrumbItem } from "@/components/ui/breadcrumb/Breadcrumb";

interface Props {
  title: string;
  breadcrumbItems: BreadcrumbItem[];
  onBack: () => void;
  /** Status steps as in the Document Details stepper. */
  steps: string[];
  currentStepIndex: number;
  terminalProgressStep?: string;
  skippedSteps?: string[];
  tabs: TabItem[];
  activeTab: string;
  onTab: (id: string) => void;
  tabLayoutId: string;
  /** Command buttons that sit after Back in the footer row. */
  footer?: ReactNode;
  /** Show the same Back and command buttons beside the title too, so they can be used without scrolling to the foot of the page. */
  repeatFooterInHeader?: boolean;
  /** A second card of tabs below the Back and command buttons, as in Document Details (the copies sent, for example). */
  afterFooter?: ReactNode;
  children: ReactNode;
}

/** The frame of every Training detail screen; it repeats the frame of Document Details (stepper, tab card, footer row). */
export function TrainingDetailLayout({ title, breadcrumbItems, onBack, steps, currentStepIndex, terminalProgressStep, skippedSteps, tabs, activeTab, onTab, tabLayoutId, footer, repeatFooterInHeader = false, afterFooter, children }: Props) {
  return (
    <div className="w-full space-y-4 md:space-y-6">
      <div className="flex flex-col gap-4">
        <PageHeader
          title={title}
          breadcrumbItems={breadcrumbItems}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={onBack} size="sm" variant="outline-emerald" className="whitespace-nowrap">Back</Button>
              {repeatFooterInHeader && footer}
            </div>
          }
        />
      </div>
      <WorkflowStepper steps={steps} currentStepIndex={currentStepIndex} terminalProgressStep={terminalProgressStep} skippedSteps={skippedSteps} />
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <TabNav tabs={tabs} activeTab={activeTab} onChange={onTab} layoutId={tabLayoutId} />
        <div className="p-4 md:p-5">{children}</div>
      </div>
      <div className="flex flex-wrap items-center gap-2 md:gap-3">
        <Button onClick={onBack} size="sm" variant="outline-emerald" className="whitespace-nowrap">Back</Button>
        {footer}
      </div>
      {afterFooter}
    </div>
  );
}

/** A label with a read-only box, as in the General Information tab of Document Details. */
export function ReadonlyField({ label, value, wide, children }: { label: string; value?: string | null; wide?: boolean; children?: ReactNode }) {
  return (
    <div className={`flex flex-col gap-1.5${wide ? " md:col-span-2" : ""}`}>
      <label className="text-xs font-medium text-slate-700 sm:text-sm">{label}</label>
      {children ?? <input type="text" value={value ?? ""} readOnly className={CONTROL_STATE_CLASSES.readonlyField} placeholder="—" />}
    </div>
  );
}

export function ReadonlyGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">{children}</div>;
}

/** A bordered block inside a tab (a table, an approval step). */
export function TabBlock({ title, action, children }: { title?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-3">
      {(title || action) && (
        <div className={`flex flex-wrap items-center gap-2 ${title ? "justify-between" : "justify-end"}`}>
          {title && <h3 className="text-sm font-semibold text-slate-800">{title}</h3>}
          {action}
        </div>
      )}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">{children}</div>
    </div>
  );
}
