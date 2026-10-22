const ACTION_BADGE_CLASS_MAP: Array<{ actions: string[]; className: string }> = [
  {
    actions: ["create", "submit", "publish", "publish to effective", "approve", "review", "login"],
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  {
    actions: ["update", "view", "open", "preview", "open preview", "view page", "open edit online", "open publishing workspace", "generate publishing preview", "edit online synced back to minio", "edit online session closed", "placeholder style updated", "placeholder style copied to new version"],
    className: "bg-sky-50 text-sky-700 border-sky-200",
  },
  {
    actions: ["delete", "reject", "failed login", "cancel", "destroy", "placeholder style deleted", "account locked"],
    className: "bg-rose-50 text-rose-700 border-rose-200",
  },
  {
    actions: ["archive", "disable", "obsoleted"],
    className: "bg-slate-50 text-slate-700 border-slate-200",
  },
  {
    actions: ["upload", "download", "export", "download evidence", "upload to office online", "revision file uploaded to office online"],
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  {
    actions: ["replace", "restore", "assign", "unassign", "add working note", "delete working note"],
    className: "bg-violet-50 text-violet-700 border-violet-200",
  },
];

export const getAuditActionBadgeClass = (action: string) => {
  const normalized = action.trim().toLowerCase().replace(/[_\s-]+/g, " ");
  const matched = ACTION_BADGE_CLASS_MAP.find((group) => group.actions.includes(normalized));
  return matched?.className ?? "bg-slate-50 text-slate-700 border-slate-200";
};

const ACTION_LABEL_MAP: Record<string, string> = {
  open_publishing_workspace: "Open Publishing Workspace",
  generate_publishing_preview: "Generate Publishing Preview",
  publish_to_effective: "Publish to Effective",
  placeholder_style_updated: "Placeholder Style Updated",
  placeholder_style_deleted: "Placeholder Style Deleted",
  placeholder_style_copied_to_new_version: "Placeholder Style Copied to New Version",
};

/** Words that keep their own spelling in a label (an acronym or a product name), by their lower-case form. */
const LABEL_WORDS: Record<string, string> = {
  pdf: "PDF", sop: "SOP", id: "ID", ip: "IP", url: "URL", api: "API", otp: "OTP", mfa: "MFA", sso: "SSO", qr: "QR", ai: "AI", minio: "MinIO", onlyoffice: "OnlyOffice",
};

/**
 * The label of an audit action. The server sends the action as a code (TRAINING_ACTIVITY_CREATED, or Training_activity_created once normalised); every audit
 * screen shows the same words in Title Case without the underscores: "Training Activity Created".
 */
export const formatAuditActionLabel = (action: string) => {
  const normalized = action.trim().toLowerCase();
  const mapped = ACTION_LABEL_MAP[normalized];
  if (mapped) {
    return mapped;
  }
  return normalized
    .replace(/[_\s-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => LABEL_WORDS[word] ?? word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

/**
 * The label of the module of an audit record. A module the screens already name ("Document", "Controlled Copy") is shown as it is; a machine code
 * (TRAINING_ACTIVITY) is shown as words ("Training Activity").
 */
export const formatAuditModuleLabel = (module?: string | null) => {
  const value = (module ?? "").trim();
  if (!value) return "-";
  return /_/.test(value) || value === value.toUpperCase() ? formatAuditActionLabel(value) : value;
};
