import React from "react";
import { Check } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { motion } from "framer-motion";

export interface WorkflowStepperProps {
  steps: readonly string[] | string[];
  currentStepIndex: number;
  terminalProgressStep?: string;
  className?: string;
  onStepClick?: (index: number) => void;
  icons?: React.ElementType[];
  skippedSteps?: readonly string[];
}

export const WorkflowStepper: React.FC<WorkflowStepperProps> = ({
  steps,
  currentStepIndex,
  terminalProgressStep,
  className,
  onStepClick,
  icons,
  skippedSteps,
}) => {
  const currentStepLabel = String(steps[currentStepIndex] ?? "");
  const normalizedCurrentStepLabel = currentStepLabel.toLowerCase();
  const isTerminalStatus =
    normalizedCurrentStepLabel === "obsoleted" ||
    normalizedCurrentStepLabel === "obsolete" ||
    normalizedCurrentStepLabel === "closed - cancelled" ||
    normalizedCurrentStepLabel === "closed-cancelled" ||
    normalizedCurrentStepLabel === "cancelled";

  const terminalProgressIndex =
    isTerminalStatus
      ? (() => {
          const resolvedIndex = terminalProgressStep
            ? steps.findIndex((step) => String(step).toLowerCase() === String(terminalProgressStep).toLowerCase())
            : -1;
          // Do not portray missing transition history as completed stages. A
          // terminal record with no verifiable progress is shown conservatively
          // from its known Draft origin, with intervening steps striped.
          return resolvedIndex >= 0 ? resolvedIndex : 0;
        })()
      : -1;
  const skippedStepSet = new Set([
    ...(skippedSteps ?? []).map((step) => String(step)),
  ]);

  return (
    <div className={cn("bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden", className)}>
      {/* Mobile View (Compact circles) */}
      <div className="flex sm:hidden items-center justify-start gap-0 px-2 py-4 bg-slate-50/50 border-b border-slate-100 overflow-x-auto">
        <div className="flex items-center justify-start min-w-max mx-auto">
          {steps.map((step, index) => {
            const isTerminalProgressStep =
              isTerminalStatus && terminalProgressIndex !== -1 && index === terminalProgressIndex;
            const isCompleted = isTerminalStatus && terminalProgressIndex !== -1
              ? index < terminalProgressIndex
              : index < currentStepIndex;
            const isCurrent = index === currentStepIndex;
            const isLast = index === steps.length - 1;

            const hasStripe = skippedStepSet.has(step);
            const isTerminalGap =
              isTerminalStatus &&
              terminalProgressIndex !== -1 &&
              index > terminalProgressIndex &&
              index < currentStepIndex;

            return (
              <React.Fragment key={step}>
                <div 
                  className={cn(
                    "flex flex-col items-center gap-1.5 select-none w-[64px] flex-shrink-0",
                    onStepClick && "cursor-pointer"
                  )}
                  onClick={() => onStepClick?.(index)}
                >
                  <motion.div
                    className={cn(
                      "relative w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold transition-all shadow-sm",
                      isCurrent
                        ? "bg-emerald-600 text-white ring-4 ring-emerald-100"
                        : isCompleted || isTerminalProgressStep
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-100 text-slate-400 border border-slate-200",
                    )}
                    style={
                      (hasStripe || isTerminalGap)
                        ? { backgroundImage: "repeating-linear-gradient(45deg, #f1f5f9, #f1f5f9 6px, #e2e8f0 6px, #e2e8f0 12px)" }
                        : undefined
                    }
                    animate={isCurrent ? { scale: [1, 1.08] } : undefined}
                    transition={
                      isCurrent
                        ? {
                            duration: 1,
                            repeat: Infinity,
                            ease: "easeInOut",
                            repeatType: "mirror",
                          }
                        : undefined
                    }
                  >
                    {isCurrent && (
                      <motion.span
                        className="pointer-events-none absolute inset-0 rounded-full border-2 border-emerald-300/70"
                        animate={{ scale: [1, 1.24], opacity: [0.5, 0.08] }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          ease: "easeInOut",
                          repeatType: "mirror",
                        }}
                      />
                    )}
                    {(isCompleted || isTerminalProgressStep) && !hasStripe ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : icons?.[index] ? (
                      React.createElement(icons[index], { className: "h-3.5 w-3.5" })
                    ) : (
                      index + 1
                    )}
                  </motion.div>
                  <span
                    className={cn(
                      "mt-1 text-[10px] font-medium text-center leading-tight transition-colors whitespace-normal break-words max-w-[64px] min-h-[24px]",
                      hasStripe || isTerminalGap
                        ? "text-slate-500"
                        : isCurrent
                          ? "text-emerald-700"
                          : isCompleted || isTerminalProgressStep
                            ? "text-emerald-700"
                            : "text-slate-400",
                    )}
                  >
                    {step}
                  </span>
                </div>
                {!isLast && (
                  <div
                    className={cn(
                      "w-4 h-0.5 flex-shrink-0 transition-all self-start mt-3.5 rounded-full",
                      isCompleted ? "bg-emerald-500" : "bg-slate-200",
                    )}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Desktop View (Arrow shapes) */}
      <div className="hidden sm:block overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
        <div className="flex items-stretch min-w-full">
          {steps.map((step, index) => {
            const isTerminalProgressStep =
              isTerminalStatus && terminalProgressIndex !== -1 && index === terminalProgressIndex;
            const isCompleted = isTerminalStatus && terminalProgressIndex !== -1
              ? index < terminalProgressIndex
              : index < currentStepIndex;
            const isCurrent = index === currentStepIndex;
            const isFirst = index === 0;
            const isLast = index === steps.length - 1;

            const hasStripe = skippedStepSet.has(step);
            const isTerminalGap =
              isTerminalStatus &&
              terminalProgressIndex !== -1 &&
              index > terminalProgressIndex &&
              index < currentStepIndex;

            return (
              <div
                key={step}
                className={cn(
                  "relative flex-1 flex items-center justify-center min-w-[140px]",
                  onStepClick && "cursor-pointer"
                )}
                style={{ minHeight: "56px" }}
                onClick={() => onStepClick?.(index)}
              >
                <div
                  className={cn(
                    "absolute inset-0 transition-all",
                    isCurrent
                      ? "bg-emerald-600"
                      : isCompleted || isTerminalProgressStep
                        ? "bg-emerald-100"
                        : "bg-slate-100",
                  )}
                  style={{
                    clipPath: isFirst
                      ? "polygon(0% 0%, calc(100% - 20px) 0%, 100% 50%, calc(100% - 20px) 100%, 0% 100%)"
                      : isLast
                        ? "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 20px 50%)"
                        : "polygon(0% 0%, calc(100% - 20px) 0%, 100% 50%, calc(100% - 20px) 100%, 0% 100%, 20px 50%)",
                    backgroundImage: (hasStripe || isTerminalGap)
                      ? "repeating-linear-gradient(45deg, #f1f5f9, #f1f5f9 10px, #e2e8f0 10px, #e2e8f0 20px)"
                      : undefined,
                  }}
                />
                <div className="relative z-10 flex items-center justify-center gap-1.5 px-4 w-full max-w-full">
                  {(isCompleted || isTerminalProgressStep) && !hasStripe ? (
                    <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                  ) : icons?.[index] ? (
                    React.createElement(icons[index], {
                      className: cn(
                        "h-4 w-4 shrink-0",
                        isCurrent ? "text-white" : "text-slate-400"
                      ),
                    })
                  ) : null}
                  <span
                    className={cn(
                      "text-xs md:text-sm font-medium text-center whitespace-normal break-words",
                      isCurrent
                        ? "text-white"
                        : hasStripe || isTerminalGap
                          ? "text-slate-500"
                          : isCompleted || isTerminalProgressStep
                            ? "text-slate-700"
                            : "text-slate-400",
                    )}
                  >
                    {step}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
