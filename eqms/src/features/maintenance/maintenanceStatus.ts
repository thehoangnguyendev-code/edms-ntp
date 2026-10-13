import apiClient from "@/services/api/client";

/** The maintenance window as the Backup Agent records it (SDS 11.5.1). Machine values only; the words on screen are made here. */
export type MaintenanceState = "NORMAL" | "NOTICE" | "DRAINED" | "LOCKED" | "UNKNOWN";

export interface MaintenanceStatus {
  state: MaintenanceState;
  endsAt: string | null;
  serverNow: string;
  locked: boolean;
  /** The manual switch in System Administration > Configuration > General. */
  manual?: boolean;
  source: "agent" | "lock-file";
}

/** Public: no session is needed, so the header and the login page can show the window. */
export const fetchMaintenanceStatus = async (): Promise<MaintenanceStatus> =>
  (await apiClient.get<MaintenanceStatus>("/system/maintenance-status")).data;

/**
 * Seconds left in the notice, counted on the server's clock. `offsetMs` is serverNow minus the browser clock at the moment the status
 * arrived, so a wrong browser clock does not change the countdown (SDS 11.5.4).
 */
export const remainingSeconds = (endsAt: string | null, offsetMs: number, nowMs: number): number | null => {
  if (!endsAt) return null;
  const ends = Date.parse(endsAt);
  if (Number.isNaN(ends)) return null;
  return Math.max(0, Math.ceil((ends - (nowMs + offsetMs)) / 1000));
};

/** mm:ss, the form the header chip shows. */
export const formatCountdown = (seconds: number): string => {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
};

/** Once the last minute has started the status is read every 5 seconds; otherwise every 15 seconds. */
export const pollIntervalMs = (state: MaintenanceState, remaining: number | null): number =>
  state === "NOTICE" && remaining !== null && remaining <= 60 ? 5000 : 15000;

/** The reminders that are read aloud (SDS 11.5.4: the 5-minute and 1-minute marks, not every second). */
export const announcementFor = (remaining: number | null, state: MaintenanceState): string | null => {
  if (state !== "NOTICE" || remaining === null) return null;
  // two fixed texts: a text that changed every second would be read aloud every second
  if (remaining <= 60) return "The system will be locked in 1 minute. Save your work and sign out.";
  if (remaining <= 300) return "The system will be locked in 5 minutes. Save your work and sign out.";
  return null;
};

/** True when the window has moved past the notice: users must be signed out now. */
export const mustSignOut = (state: MaintenanceState): boolean => state === "DRAINED" || state === "LOCKED";
