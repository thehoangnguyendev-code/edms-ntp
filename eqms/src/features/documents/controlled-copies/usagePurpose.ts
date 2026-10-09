/**
 * Usage purpose of a controlled copy (CC-PURPOSE-2026-10-07). The machine values travel to and from the server and decide nothing on
 * the screen by their label; the labels are display text only.
 *
 * READ_AND_COMPLY: nothing is written on the copy; it is recalled without a scan and never becomes a Record.
 * RECORD_KEEPING: written on by hand; recalled by scan, and the scan becomes a Record.
 * Copies issued before the purpose existed have none (shown as a dash).
 */
export type ControlledCopyUsagePurpose = "READ_AND_COMPLY" | "RECORD_KEEPING";

export const USAGE_PURPOSE_LABELS: Record<ControlledCopyUsagePurpose, string> = {
  READ_AND_COMPLY: "Read and comply",
  RECORD_KEEPING: "Record-keeping",
};

export const USAGE_PURPOSE_DESCRIPTIONS: Record<ControlledCopyUsagePurpose, string> = {
  READ_AND_COMPLY:
    "Work instructions, standards, equipment lists. Read and follow only: nothing is written on it. Recalled without a scan.",
  RECORD_KEEPING:
    "Logbooks, plans, report and data forms. Written on by hand and kept as a Record. Recalled by scanning it.",
};

export const USAGE_PURPOSE_ALL = "All";

/** The Purpose filter: All, then the two purposes. */
export const USAGE_PURPOSE_FILTER_OPTIONS: { label: string; value: string }[] = [
  { label: "All", value: USAGE_PURPOSE_ALL },
  { label: USAGE_PURPOSE_LABELS.READ_AND_COMPLY, value: "READ_AND_COMPLY" },
  { label: USAGE_PURPOSE_LABELS.RECORD_KEEPING, value: "RECORD_KEEPING" },
];

/** The value if it is one of the two purposes, otherwise undefined (an unknown value is never guessed). */
export const normalizeUsagePurpose = (value: unknown): ControlledCopyUsagePurpose | undefined =>
  value === "READ_AND_COMPLY" || value === "RECORD_KEEPING" ? value : undefined;

/** The label, or a dash for a copy issued before the purpose existed. */
export const usagePurposeLabel = (value: unknown): string => {
  const purpose = normalizeUsagePurpose(value);
  return purpose ? USAGE_PURPOSE_LABELS[purpose] : "-";
};

/** A Purpose filter value read from the address bar: only the two purposes count, anything else means All. */
export const usagePurposeFilterFromParam = (value: string | null): string =>
  normalizeUsagePurpose(value) ?? USAGE_PURPOSE_ALL;
