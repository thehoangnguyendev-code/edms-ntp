export type WorkflowParticipantIdentity = {
  id?: string | null;
  username?: string | null;
  fullName?: string | null;
  employeeCode?: string | null;
};

const normalizeIdentity = (value: string | number | null | undefined) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized;
};

const matchesIdentity = (participant: WorkflowParticipantIdentity, candidate: string) => {
  const normalizedCandidate = normalizeIdentity(candidate);
  if (!normalizedCandidate) {
    return false;
  }

  return [
    participant.id,
    participant.username,
    participant.fullName,
    participant.employeeCode,
  ].some((value) => normalizeIdentity(value) === normalizedCandidate);
};

export const collectExcludedWorkflowParticipantIds = (
  participants: WorkflowParticipantIdentity[],
  values: Array<string | number | null | undefined>,
) => {
  const excludedIds = new Set<string>();

  values.forEach((value) => {
    const normalizedValue = String(value ?? "").trim();
    if (!normalizedValue) {
      return;
    }

    const matched = participants.find((participant) => matchesIdentity(participant, normalizedValue));
    const resolvedId = normalizeIdentity(matched?.id || normalizedValue);
    if (resolvedId) {
      excludedIds.add(resolvedId);
    }
  });

  return Array.from(excludedIds);
};

export const filterOutExcludedWorkflowParticipants = <T extends { id: string }>(
  participants: T[],
  excludedIds: Array<string | null | undefined>,
) => {
  const blocked = new Set(excludedIds.map((value) => normalizeIdentity(value)).filter(Boolean));
  if (blocked.size === 0) {
    return participants;
  }

  return participants.filter((participant) => !blocked.has(normalizeIdentity(participant.id)));
};
