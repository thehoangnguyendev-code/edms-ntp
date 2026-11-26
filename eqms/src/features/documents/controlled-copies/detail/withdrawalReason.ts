import { tr } from "@/i18n";
import type { ControlledCopy } from "../types";

/** Reasons the server writes when the copy is withdrawn without anybody recalling it (the values of `obsoleteReason`). */
const BY_SYSTEM: Record<string, string> = {
  EXPIRED: "Withdrawn automatically by the system: the expiry date was reached",
  NEW_REVISION_PUBLISHED: "Withdrawn automatically by the system: replaced by a newer revision",
  REVISION_OBSOLETED: "Withdrawn automatically by the system: the revision was made obsolete",
  DOCUMENT_OBSOLETED: "Withdrawn automatically by the system: the document was made obsolete",
};
const REPORTED: Record<string, string> = { LOST: "Reported lost", DAMAGED: "Reported damaged", DESTROYED: "Destroyed at end of life" };

/**
 * Why a Controlled Copy is out of use: the system says what happened when it withdrew the copy itself; a recall by a person shows the reason they gave when signing.
 * Empty while the copy has not been withdrawn.
 */
export function withdrawalReason(copy: Pick<ControlledCopy, "obsoleteReason" | "recallReason">): string {
  const code = (copy.obsoleteReason ?? "").trim().toUpperCase();
  if (BY_SYSTEM[code]) return tr(BY_SYSTEM[code]);
  if (REPORTED[code]) return tr(REPORTED[code]);
  return copy.recallReason ?? "";
}
