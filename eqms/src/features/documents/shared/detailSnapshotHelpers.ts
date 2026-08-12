type SnapshotCandidate = { id?: string | null };

type SnapshotRefreshArgs<TDetail> = {
  enabled: boolean;
  fetchLive: () => Promise<TDetail>;
  onSuccess: (detail: TDetail) => void;
  onError?: () => void;
};

type SnapshotReadyArgs<TDetail extends { snapshotStatus?: string | null }> = {
  fetchLive: () => Promise<TDetail>;
  maxAttempts?: number;
  intervalMs?: number;
};

export const buildDocumentDetailSnapshotState = <T extends SnapshotCandidate>(detail: T) => ({
  preloadedDocumentDetail: detail,
  preloadedDocumentDetailSnapshot: true as const,
});

export const buildRevisionDetailSnapshotState = <T extends SnapshotCandidate>(detail: T) => ({
  preloadedRevisionDetail: detail,
  preloadedRevisionDetailSnapshot: true as const,
});

export const buildControlledCopySnapshotState = <T extends SnapshotCandidate>(controlledCopy: T) => ({
  preloadedControlledCopy: controlledCopy,
  preloadedControlledCopySnapshot: true as const,
});

export const isDocumentDetailSnapshotPreload = (
  state: { preloadedDocumentDetail?: SnapshotCandidate | null; preloadedDocumentDetailSnapshot?: boolean } | null | undefined,
  documentId: string,
) => Boolean(
  state?.preloadedDocumentDetailSnapshot &&
    String(state?.preloadedDocumentDetail?.id || "") === String(documentId || ""),
);

export const isRevisionDetailSnapshotPreload = (
  state: { preloadedRevisionDetail?: SnapshotCandidate | null; preloadedRevisionDetailSnapshot?: boolean } | null | undefined,
  revisionId: string,
) => Boolean(
  state?.preloadedRevisionDetailSnapshot &&
    String(state?.preloadedRevisionDetail?.id || "") === String(revisionId || ""),
);

export const isControlledCopySnapshotPreload = (
  state: { preloadedControlledCopy?: SnapshotCandidate | null; preloadedControlledCopySnapshot?: boolean } | null | undefined,
  controlledCopyId: string,
) => Boolean(
  state?.preloadedControlledCopySnapshot &&
    String(state?.preloadedControlledCopy?.id || "") === String(controlledCopyId || ""),
);

export const refreshDetailAfterSnapshot = async <TDetail>({
  enabled,
  fetchLive,
  onSuccess,
  onError,
}: SnapshotRefreshArgs<TDetail>) => {
  if (!enabled) {
    return;
  }

  try {
    const liveDetail = await fetchLive();
    onSuccess(liveDetail);
  } catch {
    onError?.();
  }
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const isSnapshotGenerating = (snapshotStatus?: string | null, previewStatus?: string | null) => {
  const normSnap = String(snapshotStatus || "").trim().toUpperCase();
  const normPrev = String(previewStatus || "").trim().toUpperCase();
  return normSnap === "GENERATING" || normPrev === "GENERATING" || normPrev === "QUEUED" || normPrev === "PROCESSING";
};

export const waitForSnapshotReady = async <TDetail extends { snapshotStatus?: string | null; previewStatus?: string | null }>({
  fetchLive,
  maxAttempts = 25,
  intervalMs = 1500,
}: SnapshotReadyArgs<TDetail>) => {
  let detail = await fetchLive();
  let attempts = 0;

  while (isSnapshotGenerating(detail?.snapshotStatus, detail?.previewStatus) && attempts < maxAttempts) {
    attempts += 1;
    await sleep(intervalMs);
    detail = await fetchLive();
  }

  return detail;
};

type SnapshotPollArgs<TDetail extends { snapshotStatus?: string | null; previewStatus?: string | null }> = SnapshotReadyArgs<TDetail> & {
  detail: TDetail | null | undefined;
  onUpdate: (detail: TDetail) => void;
};

/**
 * Non-blocking counterpart to waitForSnapshotReady(): the PDF composition round-trip
 * (Microsoft Graph, run twice per snapshot) can take upwards of 15-20s. Rather than making
 * the caller `await` that before rendering anything (freezing the whole screen behind a
 * loading spinner), callers should render immediately with `detail` as-is — the Document
 * tab already shows its own "PDF is being generated" state when snapshotStatus is
 * GENERATING — and use this to poll in the background, updating the view only once ready.
 * No-op if the given detail isn't actually mid-generation.
 */
export const pollSnapshotInBackground = <TDetail extends { snapshotStatus?: string | null; previewStatus?: string | null }>({
  detail,
  fetchLive,
  onUpdate,
  maxAttempts,
  intervalMs,
}: SnapshotPollArgs<TDetail>) => {
  if (!isSnapshotGenerating(detail?.snapshotStatus, detail?.previewStatus)) {
    return;
  }
  void waitForSnapshotReady({ fetchLive, maxAttempts, intervalMs })
    .then((resolved) => onUpdate(resolved))
    .catch(() => {
      // Best-effort background refresh — the UI already shows a "generating" state, and
      // the next manual reload/navigation will pick up the finished snapshot regardless.
    });
};
