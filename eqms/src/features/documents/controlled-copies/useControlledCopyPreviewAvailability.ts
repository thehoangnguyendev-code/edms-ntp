import { useEffect, useRef } from "react";
import { config } from "@/config";

export interface ControlledCopyPreviewState {
  available: boolean;
  /** OBSOLETED or CLOSED_CANCELLED (EXPIRED when only the expiry date has passed). */
  status?: string | null;
  /** RECALLED, EXPIRED, NEW_REVISION_PUBLISHED, REVISION_OBSOLETED, DOCUMENT_OBSOLETED, LOST, DAMAGED, DESTROYED. */
  reason?: string | null;
  message?: string | null;
  occurredAt?: string | null;
}

interface Options {
  /** The copy became unavailable (recalled, cancelled, obsoleted, expired). */
  onState: (state: ControlledCopyPreviewState) => void;
  /** The recipient's viewing session ended (time limit reached, or the session is no longer valid). */
  onSessionEnded: () => void;
  /** When the session ends (ISO-8601, from the server); a local timer locks the page even if the network is down. */
  sessionExpiresAt?: string | null;
}

/** Parses an SSE text stream into {event, data} messages (blank line terminates a message). */
async function readEventStream(
  response: Response,
  onMessage: (event: string, data: string) => void,
  signal: AbortSignal,
) {
  const reader = response.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = "";
  while (!signal.aborted) {
    const { done, value } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      let event = "message";
      const dataLines: string[] = [];
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
      }
      if (dataLines.length > 0) onMessage(event, dataLines.join("\n"));
      boundary = buffer.indexOf("\n\n");
    }
  }
}

/**
 * Keeps an open controlled-copy viewer in step with the server. The recipient has no eQMS session, so the stream is
 * authorised by the copy-bound preview grant (sent as a header, which `EventSource` cannot do, hence fetch).
 *
 * - `state` event: the copy was recalled, cancelled, made obsolete or expired -> `onState`.
 * - `session` event, a local timer at `sessionExpiresAt`, or the grant being rejected on (re)connect -> `onSessionEnded`.
 * The connection is re-established with a growing delay if it drops.
 */
export function useControlledCopyPreviewAvailability(copyId: string, grant: string | null, options: Options) {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const sessionExpiresAt = options.sessionExpiresAt;

  useEffect(() => {
    if (!copyId || !grant) return;
    const controller = new AbortController();
    let retryTimer: number | undefined;
    let sessionTimer: number | undefined;
    let attempt = 0;

    const endSession = () => {
      controller.abort();
      optionsRef.current.onSessionEnded();
    };

    if (sessionExpiresAt) {
      const remaining = new Date(sessionExpiresAt).getTime() - Date.now();
      if (Number.isFinite(remaining)) {
        // Guard against very long timers overflowing setTimeout's 32-bit limit.
        sessionTimer = window.setTimeout(endSession, Math.max(0, Math.min(remaining, 2_147_000_000)));
      }
    }

    const connect = async () => {
      try {
        const response = await fetch(`${config.api.baseURL}/controlled-copies/${copyId}/preview/events`, {
          headers: {
            Accept: "text/event-stream",
            "X-EQMS-Controlled-Copy-Preview-Grant": grant,
          },
          signal: controller.signal,
          cache: "no-store",
        });
        if (response.status === 401 || response.status === 403) {
          endSession(); // the grant is no longer valid: the viewing session is over
          return;
        }
        if (response.status === 404 || response.status === 410) {
          return;
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        attempt = 0;
        await readEventStream(
          response,
          (event, data) => {
            try {
              if (event === "state") {
                optionsRef.current.onState(JSON.parse(data) as ControlledCopyPreviewState);
              } else if (event === "session") {
                endSession();
              }
            } catch {
              // ignore a malformed event; the next one will carry the state
            }
          },
          controller.signal,
        );
      } catch {
        if (controller.signal.aborted) return;
      }
      if (controller.signal.aborted) return;
      attempt += 1;
      retryTimer = window.setTimeout(() => void connect(), Math.min(30000, 2000 * attempt));
    };

    void connect();
    return () => {
      controller.abort();
      if (retryTimer) window.clearTimeout(retryTimer);
      if (sessionTimer) window.clearTimeout(sessionTimer);
    };
  }, [copyId, grant, sessionExpiresAt]);
}
