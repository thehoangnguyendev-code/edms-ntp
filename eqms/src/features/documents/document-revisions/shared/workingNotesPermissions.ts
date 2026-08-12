type ParticipantLike = {
  id?: string | null;
  username?: string | null;
  fullName?: string | null;
};

const normalize = (value?: string | null) => String(value || "").trim().toLowerCase();

const collectIdentifiers = (participant?: ParticipantLike | null) =>
  [
    participant?.id,
    participant?.username,
    participant?.fullName,
  ]
    .map((value) => normalize(value))
    .filter(Boolean);

export const hasWorkingNotesEditAccess = (
  currentUser: ParticipantLike | string | null | undefined,
  reviewers?: ParticipantLike[] | null,
  approvers?: ParticipantLike[] | null,
  author?: ParticipantLike | string | null,
  coAuthors?: Array<ParticipantLike | string | null> | null,
  workingNotesEditable?: boolean | null,
) => {
  if (!workingNotesEditable) {
    return false;
  }

  const currentUserIdentifiers = Array.isArray(currentUser)
    ? currentUser.map((value) => normalize(value)).filter(Boolean)
    : typeof currentUser === "string"
      ? [normalize(currentUser)].filter(Boolean)
      : collectIdentifiers(currentUser);

  if (currentUserIdentifiers.length === 0) {
    return false;
  }

  const participants = [...(reviewers || []), ...(approvers || [])];
  const authorIdentifiers = Array.isArray(coAuthors)
    ? [
        ...(typeof author === "string" ? [normalize(author)] : collectIdentifiers(author)),
        ...coAuthors.flatMap((item) =>
          typeof item === "string" ? [normalize(item)] : collectIdentifiers(item),
        ),
      ].filter(Boolean)
    : [
        ...(typeof author === "string" ? [normalize(author)] : collectIdentifiers(author)),
      ].filter(Boolean);

  if (authorIdentifiers.some((identifier) => currentUserIdentifiers.includes(identifier))) {
    return false;
  }

  return participants.some((participant) =>
    collectIdentifiers(participant).some((identifier) => currentUserIdentifiers.includes(identifier)),
  );
};
