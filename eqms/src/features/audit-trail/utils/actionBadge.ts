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
    actions: ["delete", "reject", "failed login", "cancel", "destroy", "placeholder style deleted"],
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

export const formatAuditActionLabel = (action: string) => {
  const normalized = action.trim().toLowerCase();
  const mapped = ACTION_LABEL_MAP[normalized];
  if (mapped) {
    return mapped;
  }
  return action
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
};
