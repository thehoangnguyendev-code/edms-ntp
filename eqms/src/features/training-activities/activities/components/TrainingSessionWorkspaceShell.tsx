import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { FormSection } from "@/components/ui/form/FormSection";
import { WorkflowStepper } from "@/components/ui/workflow-stepper/WorkflowStepper";
import { IconArrowRight, IconConfetti } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { cn } from "@/components/ui/utils";

type Icon = ComponentType<{ className?: string }>;

export interface WorkspaceStep {
  id: string;
  label: string;
  subtitle: string;
  description: string;
  done: boolean;
  icon: Icon;
}
export interface WorkspaceStat {
  label: string;
  value: number | string;
  icon: Icon;
  tone: "emerald" | "blue" | "amber" | "red" | "slate";
}
export interface WorkspaceRate {
  label: string;
  percent: number | null;
  detail: string;
  tone: "emerald" | "blue";
}
export interface WorkspaceNext {
  text: string;
  action?: { label: string; onClick: () => void; loading?: boolean };
  tone?: "go" | "wait" | "done";
}

const TONE: Record<WorkspaceStat["tone"], string> = {
  emerald: "text-emerald-600",
  blue: "text-blue-600",
  amber: "text-amber-600",
  red: "text-red-600",
  slate: "text-slate-500",
};

/** A bar that fills to the percentage; the figures are written beside it, so the colour is never the only carrier. */
function RateBar({ rate }: { rate: WorkspaceRate }) {
  const value = rate.percent ?? 0;
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-semibold text-slate-800">{rate.label}</span>
        <span className="text-slate-500">
          {rate.detail} · <span className="font-semibold text-slate-900">{rate.percent == null ? "—" : `${rate.percent}%`}</span>
        </span>
      </div>
      <div
        className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={rate.percent ?? undefined}
        aria-label={`${rate.label}: ${rate.detail}`}
      >
        <motion.div
          className={cn("h-full rounded-full", rate.tone === "blue" ? "bg-blue-500" : "bg-emerald-500")}
          initial={false}
          animate={{ width: `${value}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
      </div>
    </div>
  );
}

/** A short burst of dots from the centre when the last step is done. It plays once per visit and not at all for people who ask for less motion. */
function Burst() {
  const dots = Array.from({ length: 18 }, (_x, i) => ({
    angle: (i / 18) * 2 * Math.PI,
    distance: 70 + (i % 3) * 22,
    color: ["bg-emerald-400", "bg-blue-400", "bg-amber-400"][i % 3],
  }));
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {dots.map((d, i) => (
        <motion.span
          key={i}
          className={cn(
            "absolute left-1/2 top-1/2 h-2 w-2 rounded-full",
            d.color,
          )}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{
            x: Math.cos(d.angle) * d.distance,
            y: Math.sin(d.angle) * d.distance,
            opacity: 0,
            scale: 0.4,
          }}
          transition={{ duration: 1.1, ease: "easeOut", delay: (i % 4) * 0.04 }}
        />
      ))}
    </div>
  );
}

/**
 * The frame of the workspace of one training session, in the way a learning platform shows a lesson: a header card with the session and its figures, a stepper with the progress,
 * the one thing to do next, and the work of the chosen step. It only lays out what the page gives it; the steps guide the work and never block it.
 */
export function TrainingSessionWorkspaceShell({
  breadcrumbItems,
  onBack,
  trainingNumber,
  heading,
  badges,
  facts,
  stats,
  rates,
  steps,
  current,
  onStep,
  next,
  children,
}: {
  breadcrumbItems: React.ComponentProps<typeof PageHeader>["breadcrumbItems"];
  onBack: () => void;
  trainingNumber: string;
  heading: string;
  badges: {
    label: string;
    color: "emerald" | "blue" | "amber" | "slate" | "red";
  }[];
  facts: { icon: Icon; label: string; value: string }[];
  stats: WorkspaceStat[];
  rates: WorkspaceRate[];
  steps: WorkspaceStep[];
  current: string;
  onStep: (id: string) => void;
  next: WorkspaceNext | null;
  children: ReactNode;
}) {
  const index = Math.max(
    0,
    steps.findIndex((s) => s.id === current),
  );
  const active = steps[index];
  const doneCount = steps.filter((s) => s.done).length;
  const percent = Math.round((doneCount / steps.length) * 100);
  const ActiveIcon = active.icon;
  // The congratulation: a banner while all steps are done, and a burst when this visit sees the last step become done.
  const allDone = doneCount === steps.length;
  const reduced = useReducedMotion();
  const wasDone = useRef(allDone);
  const [burst, setBurst] = useState(false);
  useEffect(() => {
    if (allDone && !wasDone.current && !reduced) {
      setBurst(true);
      const id = window.setTimeout(() => setBurst(false), 1800);
      wasDone.current = true;
      return () => window.clearTimeout(id);
    }
    wasDone.current = allDone;
  }, [allDone, reduced]);

  return (
    <div className="flex min-w-0 flex-col gap-4 md:gap-5">
      <PageHeader
        title="Session Workspace"
        breadcrumbItems={breadcrumbItems}
        actions={
          <Button size="sm" variant="outline-emerald" onClick={onBack}>
            Back
          </Button>
        }
      />

      <section
        className="overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-white p-4 shadow-sm md:p-6"
        aria-label="Session"
      >
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-8">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{trainingNumber}</div>
            <h2 className="mt-1 text-lg font-semibold leading-snug text-slate-900 md:text-xl">{heading}</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {badges.map((b) => (
                <Badge key={b.label} color={b.color}>
                  {b.label}
                </Badge>
              ))}
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 xl:grid-cols-4">
              {facts.map((f) => {
                const FactIcon = f.icon;
                return (
                  <div key={f.label} className="flex min-w-0 items-start gap-2.5">
                    <FactIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <div className="min-w-0">
                      <dt className="text-2xs font-semibold uppercase tracking-wide text-slate-500">{f.label}</dt>
                      <dd className="break-words text-sm font-medium text-slate-900" title={`${f.label}: ${f.value}`}>
                        {f.value || "—"}
                      </dd>
                    </div>
                  </div>
                );
              })}
            </dl>
          </div>

          <aside className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4" aria-label="Figures of the session">
            <div>
              <div className="flex items-baseline justify-between text-xs">
                <span className="font-semibold text-slate-800">Progress</span>
                <span className="text-slate-500">
                  <span className="font-semibold text-slate-900">{doneCount}</span> of {steps.length} steps
                </span>
              </div>
              <div
                className="mt-1.5 h-2 overflow-hidden rounded-full bg-emerald-100"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                aria-label="Progress of the session"
              >
                <motion.div
                  className="h-full rounded-full bg-emerald-500"
                  initial={false}
                  animate={{ width: `${percent}%` }}
                  transition={{ type: "spring", stiffness: 120, damping: 20 }}
                />
              </div>
            </div>
            {rates.map((r) => (
              <RateBar key={r.label} rate={r} />
            ))}
            <ul className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
              {stats.map((s) => {
                const StatIcon = s.icon;
                return (
                  <li key={s.label} className="flex items-center gap-2 text-sm text-slate-600">
                    <StatIcon className={cn("h-4 w-4 shrink-0", TONE[s.tone])} />
                    <span className="text-base font-semibold leading-none text-slate-900">{s.value}</span>
                    <span className="truncate">{s.label}</span>
                  </li>
                );
              })}
            </ul>
          </aside>
        </div>
      </section>

      <WorkflowStepper
        steps={steps.map((s) => s.label)}
        currentStepIndex={index}
        icons={steps.map((s) => s.icon)}
        onStepClick={(i) => onStep(steps[i].id)}
      />

      {allDone && (
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 18 }}
          className="relative flex items-center gap-3 overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white px-4 py-4 md:px-5"
          role="status"
        >
          {burst && <Burst />}
          <motion.span
            initial={reduced ? false : { scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{
              type: "spring",
              stiffness: 260,
              damping: 14,
              delay: 0.1,
            }}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white"
          >
            <IconConfetti className="h-6 w-6" />
          </motion.span>
          <div className="min-w-0 flex-1 text-sm">
            <div className="font-semibold text-emerald-900">
              All five steps are done. Well done!
            </div>
            <div className="text-slate-600">
              {next?.text ?? "The session is complete."}
            </div>
          </div>
          {next?.action && (
            <Button
              size="sm"
              variant="default"
              className="shrink-0 whitespace-nowrap"
              loading={next.action.loading}
              onClick={next.action.onClick}
            >
              {next.action.label}
            </Button>
          )}
        </motion.div>
      )}
      {!allDone && next && (
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 md:px-5",
            next.tone === "done"
              ? "border-emerald-200 bg-emerald-50"
              : next.tone === "wait"
                ? "border-slate-200 bg-slate-50"
                : "border-amber-200 bg-amber-50",
          )}
          role="status"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={cn(
                "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full",
                next.tone === "done"
                  ? "bg-emerald-600 text-white"
                  : next.tone === "wait"
                    ? "bg-slate-200 text-slate-600"
                    : "bg-amber-500 text-white",
              )}
            >
              <IconArrowRight className="h-5 w-5" />
            </span>
            <div className="min-w-0 text-sm">
              <span className="font-semibold text-slate-900">Next: </span>
              <span className="text-slate-700">{next.text}</span>
            </div>
          </div>
          {next.action && (
            <Button
              size="sm"
              variant="default"
              loading={next.action.loading}
              onClick={next.action.onClick}
            >
              {next.action.label}
            </Button>
          )}
        </div>
      )}

      <FormSection
        title={`Step ${index + 1}: ${active.label}`}
        icon={<ActiveIcon className="h-4 w-4" />}
        description={active.description}
        contentClassName="p-0"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col gap-6 p-4 md:p-5"
          >
            {children}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
              <div>
                {index > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onStep(steps[index - 1].id)}
                  >
                    Back: {steps[index - 1].label}
                  </Button>
                )}
              </div>
              <div className="text-xs text-slate-500">
                The steps guide the work; nothing is blocked by their order.
              </div>
              <div>
                {index < steps.length - 1 && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => onStep(steps[index + 1].id)}
                  >
                    Next: {steps[index + 1].label}
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </FormSection>
    </div>
  );
}
