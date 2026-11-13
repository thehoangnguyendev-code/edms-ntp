import { useEffect, useState } from "react";
import type { WorkflowProgress } from "@/types/document";

const cache = new Map<string, WorkflowProgress>();
const inflight = new Map<string, Promise<WorkflowProgress>>();

/**
 * A lifecycle stepper the server defines for a record that does not exist yet (a new activity, a new template).
 * It is asked for once per kind and kept; `key` names the kind, and no key asks for nothing.
 * Nothing is returned until the server has answered: the screen never makes up a list of steps.
 */
export const useServerWorkflow = (key: string | null, load: () => Promise<WorkflowProgress>): WorkflowProgress | undefined => {
  const [workflow, setWorkflow] = useState<WorkflowProgress | undefined>(key ? cache.get(key) : undefined);
  useEffect(() => {
    if (!key) {
      setWorkflow(undefined);
      return;
    }
    const known = cache.get(key);
    if (known) {
      setWorkflow(known);
      return;
    }
    let live = true;
    let request = inflight.get(key);
    if (!request) {
      request = load().finally(() => inflight.delete(key));
      inflight.set(key, request);
    }
    request
      .then((result) => {
        cache.set(key, result);
        if (live) setWorkflow(result);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
    // `load` is a stable API call for the key; asking again on every render would defeat the cache.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return workflow;
};
