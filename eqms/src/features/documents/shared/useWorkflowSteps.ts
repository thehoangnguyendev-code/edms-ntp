import { useEffect, useState } from "react";
import { documentApi } from "@/services/api/documents";
import type { WorkflowStep } from "@/types/document";

interface WorkflowSteps {
  revision: WorkflowStep[];
  document: WorkflowStep[];
  /** Revision steps a Legacy Import never goes through (labels). */
  legacyImportSkippedSteps: string[];
}

let cached: WorkflowSteps | null = null;
let inflight: Promise<WorkflowSteps> | null = null;

const load = (): Promise<WorkflowSteps> => {
  if (cached) return Promise.resolve(cached);
  inflight ??= documentApi
    .getWorkflowSteps()
    .then((steps) => {
      cached = steps;
      return steps;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
};

/**
 * The Revision and Document lifecycles in order, as the server defines them. For screens that draw a stepper
 * before a record exists (a new Document or Revision); a saved record carries its own `workflow`.
 * Empty until loaded, so the stepper has nothing to draw rather than a made-up list.
 */
export const useWorkflowSteps = (): WorkflowSteps => {
  const [steps, setSteps] = useState<WorkflowSteps>(cached ?? { revision: [], document: [], legacyImportSkippedSteps: [] });
  useEffect(() => {
    let live = true;
    load()
      .then((loaded) => {
        if (live) setSteps(loaded);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  return steps;
};

export const stepLabels = (steps: readonly WorkflowStep[] | undefined | null): string[] => (steps ?? []).map((step) => step.label);
