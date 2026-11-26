/**
 * The sentences of the progress and result dialogs of a Controlled Copy batch. One whole sentence per action: Vietnamese does not follow the English word order, so
 * the action word is never glued to the rest. The keys are the values of `actionLabel` and are not shown as they are.
 */
export const BATCH_ACTION_COPY = {
  Distribution: { processing: "Distribution Processing", result: "Distribution Result", complete: "Distribution complete", errors: "Distribution completed with errors", exceptions: "Distribution completed with exceptions" },
  Recall: { processing: "Recall Processing", result: "Recall Result", complete: "Recall complete", errors: "Recall completed with errors", exceptions: "Recall completed with exceptions" },
  Cancellation: { processing: "Cancellation Processing", result: "Cancellation Result", complete: "Cancellation complete", errors: "Cancellation completed with errors", exceptions: "Cancellation completed with exceptions" },
} as const;

export type BatchActionLabel = keyof typeof BATCH_ACTION_COPY;
