import { getApiErrorMessage } from "@/utils/apiError";
import type { PolicyBody, PolicyMedium, PolicyStatus } from "@/services/api/backupRestore";
import { statusColors } from "@/components/ui/badge/statusColors";

/** Display text for machine values. The values themselves are never translated or sent back as text. */
export const POLICY_STATUS_COLOR = statusColors("ACTIVE", "DRAFT", "SUPERSEDED", "DISCARDED");

export const MEDIUM_LABEL: Record<PolicyMedium, string> = {
  SERVER_FOLDER: "Folder on the server",
  NETWORK_SHARE: "Network share (NAS)",
  OBJECT_STORAGE: "Object storage",
  REMOVABLE_MEDIA: "Removable media",
};

export const COMPONENT_LABEL: Record<string, string> = {
  DATABASE: "Database",
  OBJECT_STORE: "Documents (object store)",
};

export const GATE_LABEL: Record<string, { title: string; rule: string }> = {
  COPIES: { title: "Three copies", rule: "The live system plus at least two backup targets." },
  MEDIA: { title: "Two kinds of medium", rule: "Targets must not all be the same kind of storage." },
  OFFSITE: { title: "One copy off-site", rule: "At least one target is declared to be in another location." },
  IMMUTABLE: { title: "One copy out of the server's reach", rule: "At least one copy that the server cannot change: the manual copy kept offline (versions before 2026-11-10 could also name a locked target)." },
  IMMUTABLE_CONFIGURED: { title: "Locked targets are locked", rule: "Only in older versions: a target declared immutable had to be configured as immutable." },
  TARGETS_WORK: { title: "Every target works", rule: "Each target is written and read back." },
};

/** How a policy backs the files up: at a time of their own, in the database run, or not at all. */
export const filesText = (body: Pick<PolicyBody, "components" | "filesTime" | "enabled">): string => {
  if (!body.components.includes("OBJECT_STORE")) return "Not backed up";
  if (body.filesTime) return `Daily at ${body.filesTime} (own schedule)`;
  return body.enabled ? "With the database backup" : "Switched off";
};

/** Messages for the stable codes the server answers with; anything else falls back to the server's own message. */
export const POLICY_ERROR: Record<string, string> = {
  POLICY_GATE_FAILED: "The policy does not meet the 3-2-1-1 rule, so it was not activated and nothing was signed.",
  POLICY_DRAFT_EXISTS: "A draft is already waiting. Activate or discard it before proposing another.",
  POLICY_NOT_DRAFT: "Only a draft can be activated or discarded.",
  POLICY_RETENTION: "Backups are kept permanently; no other retention can be set.",
  POLICY_OBJECTS_NOT_CONFIGURED: "The document store is not configured on the Backup Agent.",
  POLICY_SCHEDULE_FILES_SCOPE: "The files have their own schedule, so they must be part of the policy.",
};

/** The server answers a refusal with a stable code; show the plain-language message for it, else whatever the server said. */
export const policyErrorMessage = (error: unknown, fallback: string): string => {
  const code = (error as { response?: { data?: { code?: string } } })?.response?.data?.code;
  return (code && POLICY_ERROR[code]) || getApiErrorMessage(error, fallback);
};
