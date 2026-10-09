import type { ExportStatus, MediaKind, MediaStatus } from "@/services/api/backupRestore";
import { getApiErrorMessage } from "@/utils/apiError";

/** Display text and colours for machine values of the offline media register and the export requests. */
export const MEDIA_STATUS_COLOR: Record<MediaStatus, "emerald" | "amber" | "blue" | "slate" | "red"> = {
  AVAILABLE: "emerald",
  IN_TRANSIT: "amber",
  STORED_OFFSITE: "blue",
  IN_READ_TEST: "amber",
  QUARANTINED: "red",
  RETIRED: "slate",
};

export const MEDIA_STATUS_HINT: Record<MediaStatus, string> = {
  AVAILABLE: "Empty and ready to receive a package.",
  IN_TRANSIT: "Holds a package and is on its way to the place it will be kept.",
  STORED_OFFSITE: "Holds a package and is kept away from the server.",
  IN_READ_TEST: "Being read back to prove it still works.",
  QUARANTINED: "Failed a read test. Its packages must be exported again.",
  RETIRED: "Destroyed. It can never be used again.",
};

export const MEDIA_KIND_LABEL: Record<MediaKind, string> = { HDD: "Hard disk", SSD: "Solid-state drive", USB: "USB drive", TAPE: "Tape" };

export const EXPORT_STATUS_COLOR: Record<ExportStatus, "emerald" | "amber" | "blue" | "slate" | "red"> = {
  REQUESTED: "amber",
  APPROVED: "blue",
  RUNNING: "blue",
  COMPLETED: "emerald",
  INVALID: "red",
  REJECTED: "slate",
};

export const MEDIA_EVENT_LABEL: Record<string, string> = {
  REGISTERED: "Registered",
  EXPORTED: "Package written",
  HANDED_OVER: "Handed over",
  RECEIVED: "Receipt confirmed",
  READ_TESTED: "Read test",
  RECYCLED: "Wiped and returned to use",
  RETIRED: "Retired",
};

export const EXPORT_ERROR: Record<string, string> = {
  EXPORT_SAME_PERSON: "You asked for this export, so someone else has to approve it.",
  MEDIA_SAME_PERSON: "You handed this medium over, so someone else has to confirm receiving it.",
  EXPORT_MEDIA_BUSY: "Another export is already waiting for this medium.",
  EXPORT_MEDIA_NOT_AVAILABLE: "That medium is not available. Only an empty, registered medium can receive a package.",
  EXPORT_MEDIA_TOO_SMALL: "The package would not fit on that medium.",
  EXPORT_BACKUP_NOT_VERIFIED: "Only a backup whose latest integrity check passed can be exported.",
  EXPORT_SAME_DISK: "That medium is on the same disk as the backups, so it would not protect against losing the disk.",
  MEDIA_NOT_HANDED_OVER: "The deliverer has not recorded the handover yet.",
  MEDIA_LEGAL_HOLD: "This medium holds data under legal hold.",
  MEDIA_WIPE_UNCONFIRMED: "Confirm that the medium was securely wiped.",
  MEDIA_DUPLICATE: "A medium with that label or folder already exists.",
};

/** The server answers a refusal with a stable code; show the plain-language message for it, else whatever the server said. */
export const exportErrorMessage = (error: unknown, fallback: string): string => {
  const code = (error as { response?: { data?: { code?: string } } })?.response?.data?.code;
  return (code && EXPORT_ERROR[code]) || getApiErrorMessage(error, fallback);
};
