import React from "react";
import { WorkflowStepper } from "@/components/ui/workflow-stepper/WorkflowStepper";
import type { WorkflowProgress } from "@/types/document";

/**
 * Draws the lifecycle stepper exactly as the server worked it out: the steps, the current one, those skipped,
 * where the record ended and whether the current step ends the lifecycle. Nothing is drawn until it has arrived.
 */
export const WorkflowProgressStepper: React.FC<{ workflow?: WorkflowProgress | null; className?: string }> = ({ workflow, className }) => {
  if (!workflow || workflow.steps.length === 0) return null;
  return (
    <WorkflowStepper
      className={className}
      steps={workflow.steps.map((step) => step.label)}
      currentStepIndex={workflow.currentStepIndex}
      skippedSteps={workflow.skippedSteps}
      terminalProgressStep={workflow.terminalProgressStep}
      isTerminal={workflow.steps[workflow.currentStepIndex]?.terminal ?? false}
    />
  );
};
