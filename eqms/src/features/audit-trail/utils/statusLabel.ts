const STATUS_LABEL_MAP: Record<string, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  EFFECTIVE: "Effective",
  OBSOLETED: "Obsoleted",
  CLOSED: "Closed",
  CLOSED_CANCELLED: "Closed - Cancelled",
  "CLOSED-CANCELLED": "Closed - Cancelled",
  PENDING_REVIEW: "Pending Review",
  PENDING_APPROVAL: "Pending Approval",
  PENDING_TRAINING: "Pending Training",
  READY_FOR_PUBLISHING: "Ready for Publishing",
  READY_FOR_DISTRIBUTION: "Ready for Distribution",
  DISTRIBUTED: "Distributed",
};

const SMALL_WORDS = new Set(["and", "or", "of", "the", "to", "for", "by", "from", "in", "on", "at"]);

export const formatWorkflowStatusLabel = (value?: string | null) => {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return "-";
  }

  const normalizedKey = raw.replace(/[\s-]+/g, "_").toUpperCase();
  const exact = STATUS_LABEL_MAP[normalizedKey] || STATUS_LABEL_MAP[raw.toUpperCase()];
  if (exact) {
    return exact;
  }

  const cleaned = raw.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return "-";
  }

  return cleaned
    .split(" ")
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && SMALL_WORDS.has(lower)) {
        return lower;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
};
