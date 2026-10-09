import { getApiErrorMessage } from "@/utils/apiError";
import type { PolicyMedium, PolicyStatus } from "@/services/api/backupRestore";

/** Display text for machine values. The values themselves are never translated or sent back as text. */
export const POLICY_STATUS_COLOR: Record<PolicyStatus, "emerald" | "amber" | "slate" | "red"> = {
  ACTIVE: "emerald",
  DRAFT: "amber",
  SUPERSEDED: "slate",
  DISCARDED: "red",
};

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
  IMMUTABLE: { title: "One immutable copy", rule: "At least one target is declared immutable (cannot be deleted or changed)." },
  IMMUTABLE_CONFIGURED: { title: "Immutable targets are locked", rule: "A target declared immutable must really be configured as immutable." },
  TARGETS_WORK: { title: "Every target works", rule: "Each target is written, read back and, if immutable, asked to refuse a delete." },
};

/** Messages for the stable codes the server answers with; anything else falls back to the server's own message. */
export const POLICY_ERROR: Record<string, string> = {
  POLICY_SAME_PERSON: "You proposed this version, so someone else has to approve it.",
  POLICY_GATE_FAILED: "The policy does not meet the 3-2-1-1 rule, so it was not activated and nothing was signed.",
  POLICY_DRAFT_EXISTS: "A draft is already waiting. Activate or discard it before proposing another.",
  POLICY_NOT_DRAFT: "Only a draft can be activated or discarded.",
  POLICY_RETENTION: "Backups are kept permanently; no other retention can be set.",
  POLICY_OBJECTS_NOT_CONFIGURED: "The document store is not configured on the Backup Agent.",
};

/** The server answers a refusal with a stable code; show the plain-language message for it, else whatever the server said. */
export const policyErrorMessage = (error: unknown, fallback: string): string => {
  const code = (error as { response?: { data?: { code?: string } } })?.response?.data?.code;
  return (code && POLICY_ERROR[code]) || getApiErrorMessage(error, fallback);
};
