/** What an audit action is, in words a person scans: the icon and the colour of its mark in a timeline. */
export type AuditActionKind =
  | "create"
  | "update"
  | "approve"
  | "reject"
  | "submit"
  | "review"
  | "publish"
  | "login"
  | "logout"
  | "failed"
  | "upload"
  | "download"
  | "view"
  | "delete"
  | "assign"
  | "disable"
  | "enable"
  | "note"
  | "cancel"
  | "restore"
  | "system";

export type AuditTone = "emerald" | "sky" | "rose" | "slate" | "amber" | "violet";

/** The same six colour groups as the badge of the audit table (`actionBadge.ts`), so a record has one colour on every audit screen. */
export const AUDIT_KIND_TONE: Record<AuditActionKind, AuditTone> = {
  create: "emerald",
  submit: "emerald",
  approve: "emerald",
  review: "emerald",
  publish: "emerald",
  login: "emerald",
  enable: "emerald",
  update: "sky",
  view: "sky",
  delete: "rose",
  reject: "rose",
  failed: "rose",
  cancel: "rose",
  logout: "slate",
  disable: "slate",
  system: "slate",
  upload: "amber",
  download: "amber",
  assign: "violet",
  note: "violet",
  restore: "violet",
};

/**
 * The kind of an action, read from the words of its code (TRAINING_ACTIVITY_CREATED, Failed Login, publish_to_effective ...). The order matters: "FAILED_LOGIN"
 * is a failure before it is a sign-in, "ADD_WORKING_NOTE" a note before it is an addition. A code with no known word is a plain event of the system.
 */
export function auditActionKind(action: string | null | undefined): AuditActionKind {
  const words = String(action ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_\s-]+/g, " ");
  const has = (...needles: string[]) => needles.some((needle) => new RegExp(`(^| )${needle}`).test(words));
  if (has("fail", "locked", "denied", "error")) return "failed";
  if (has("note")) return "note";
  if (has("reject")) return "reject";
  if (has("approv")) return "approve";
  if (has("submit")) return "submit";
  if (has("review")) return "review";
  if (has("publish")) return "publish";
  if (has("logout", "log out", "sign out")) return "logout";
  if (has("login", "log in", "sign in", "signed in")) return "login";
  if (has("upload")) return "upload";
  if (has("download", "export")) return "download";
  if (has("delet", "destroy", "remov")) return "delete";
  if (has("unassign", "assign")) return "assign";
  if (has("disabl", "deactivat", "suspend", "archiv", "obsolet")) return "disable";
  if (has("enabl", "activat")) return "enable";
  if (has("cancel", "void")) return "cancel";
  if (has("restor")) return "restore";
  if (has("creat", "add", "new", "register")) return "create";
  if (has("view", "open", "preview", "read", "close preview")) return "view";
  if (has("updat", "edit", "chang", "modif", "replac", "sync", "renam", "set")) return "update";
  return "system";
}
