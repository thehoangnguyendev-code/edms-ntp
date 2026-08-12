export type ControlledCopyStatusLabel =
  | "Ready for Distribution"
  | "Distributed"
  | "Obsoleted"
  | "Closed - Cancelled";

const normalizeText = (value?: string | null) =>
  (value ?? "").trim().toUpperCase().replace(/[\s_-]+/g, "");

export function normalizeControlledCopyStatusLabel(
  status?: string | null,
  statusInfo?: { id?: string | null; name?: string | null } | null,
): ControlledCopyStatusLabel {
  const raw = statusInfo?.name || statusInfo?.id || status || "";
  const normalized = normalizeText(raw);

  if (normalized === "READYFORDISTRIBUTION" || normalized === "READYFORDISTRIBUTE") {
    return "Ready for Distribution";
  }
  if (normalized === "DISTRIBUTED") {
    return "Distributed";
  }
  if (normalized === "OBSOLETE" || normalized === "OBSOLETED") {
    return "Obsoleted";
  }
  if (normalized === "CLOSEDCANCELLED" || normalized === "CANCELLED" || normalized === "CLOSED") {
    return "Closed - Cancelled";
  }

  // Unrecognized/blank status defaults to the safest (terminal, non-actionable) label
  // rather than implying the copy is still active.
  return "Closed - Cancelled";
}

export function isControlledCopyTerminalStatus(status?: string | null, statusInfo?: { id?: string | null; name?: string | null } | null): boolean {
  const normalized = normalizeControlledCopyStatusLabel(status, statusInfo);
  return normalized === "Obsoleted" || normalized === "Closed - Cancelled";
}
