import type { RevisionDetailResponse } from "@/features/documents/document-revisions/detail-revision/types";

export interface SignatureTabRecord {
  actionBy: string;
  actionByName: string;
  actionOn: string;
  actionOnValue: string;
}

const normalizeLabel = (value?: string | null) => String(value || "").trim().toLowerCase();

const matchesLabel = (actionBy: string | undefined | null, labels: string[]) => {
  const normalizedActionBy = normalizeLabel(actionBy);
  return labels.some((label) => {
    const normalized = normalizeLabel(label);
    return normalizedActionBy === normalized || normalizedActionBy.startsWith(`${normalized} `);
  });
};

const hasMeaningfulSignature = (record: any) => {
  if (!record) return false;
  const byName = normalizeLabel(record.actionByName);
  const onValue = normalizeLabel(record.actionOnValue);
  return (byName && byName !== "-" && byName !== "-") || (onValue && onValue !== "-" && onValue !== "-");
};

const getSignatureMatches = (revision: RevisionDetailResponse | null, labels: string[]) =>
  (revision?.signatures ?? []).filter((record) => matchesLabel(record?.actionBy, labels) && hasMeaningfulSignature(record));

const buildDynamicRows = (baseLabelBy: string, labelOn: string, matches: any[]): SignatureTabRecord[] =>
  matches.map((record, index) => ({
    actionBy: matches.length > 1 ? `${baseLabelBy} ${index + 1}` : baseLabelBy,
    actionByName: record?.actionByName || "-",
    actionOn: labelOn,
    actionOnValue: record?.actionOnValue || "-",
  }));

const buildParticipantRows = (
  baseLabelBy: string,
  labelOn: string,
  people: Array<{ fullName?: string | null; actedAt?: string | null; actionStatus?: string | null }> | undefined | null,
  acceptedStatuses: string[]
): SignatureTabRecord[] =>
  [...(people ?? [])].map((person, index, arr) => {
    const status = normalizeLabel(person?.actionStatus);
    const completed = !!person?.actedAt && acceptedStatuses.includes(status);
    return {
      actionBy: arr.length > 1 ? `${baseLabelBy} ${index + 1}` : baseLabelBy,
      actionByName: completed ? (person?.fullName || "-") : "-",
      actionOn: labelOn,
      actionOnValue: completed ? (person?.actedAt || "-") : "-",
    };
  });

const normalize = (actionBy: string, actionOn: string, record: any | null): SignatureTabRecord => ({
  actionBy,
  actionByName: record?.actionByName || "-",
  actionOn,
  actionOnValue: record?.actionOnValue || "-",
});

export const buildRevisionSignatureRecords = (revision: RevisionDetailResponse | null): SignatureTabRecord[] => {
  const preparedMatches = getSignatureMatches(revision, ["prepared by", "prepared"]);
  const reviewedMatches = getSignatureMatches(revision, ["reviewed by", "reviewed"]);
  const approvedMatches = getSignatureMatches(revision, ["approved by", "approved"]);
  const preparedRows = buildDynamicRows("Prepared By", "Prepared On (Date - Time)", preparedMatches);
  const reviewedParticipantRows = buildParticipantRows(
    "Reviewed By",
    "Reviewed On (Date - Time)",
    revision?.reviewers,
    ["reviewed", "approved"],
  );
  const approvedParticipantRows = buildParticipantRows(
    "Approved By",
    "Approved On (Date - Time)",
    revision?.approvers,
    ["approved"],
  );

  return [
    ...preparedRows,
    normalize("Submitted By", "Submitted On (Date - Time)", {
      actionByName: revision?.submittedBy || "-",
      actionOnValue: revision?.submittedOn || "-",
    }),
    ...(reviewedParticipantRows.length > 0
      ? reviewedParticipantRows
      : buildDynamicRows("Reviewed By", "Reviewed On (Date - Time)", reviewedMatches)),
    normalize("Rejected By", "Rejected On (Date - Time)", getSignatureMatches(revision, ["rejected by", "rejected"])[0] ?? null),
    ...(approvedParticipantRows.length > 0
      ? approvedParticipantRows
      : buildDynamicRows("Approved By", "Approved On (Date - Time)", approvedMatches)),
    normalize(
      "Published By",
      "Published On (Date - Time)",
      getSignatureMatches(revision, ["published by", "published"])[0] ?? {
        actionByName: revision?.publishedBy || "-",
        actionOnValue: revision?.publishedOn || "-",
      },
    ),
    normalize("Obsoleted By", "Obsoleted On (Date - Time)", getSignatureMatches(revision, ["obsoleted by", "obsoleted"])[0] ?? null),
    normalize("Cancelled By", "Cancelled On (Date - Time)", getSignatureMatches(revision, ["cancelled by", "cancelled"])[0] ?? null),
  ];
};
