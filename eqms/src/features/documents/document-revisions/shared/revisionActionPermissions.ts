type ParticipantLike = {
  id?: string | null;
  username?: string | null;
  fullName?: string | null;
  email?: string | null;
  actionStatus?: string | null;
  status?: string | null;
};

type CurrentUserLike = {
  id?: string | null;
  username?: string | null;
  fullName?: string | null;
  email?: string | null;
} | null | undefined;

const normalize = (value?: string | null) => String(value || "").trim().toLowerCase();

const collectIdentifiers = (participant?: ParticipantLike | null) =>
  [participant?.id, participant?.username, participant?.fullName, participant?.email]
    .map((value) => normalize(value))
    .filter(Boolean);

const currentUserIdentifiers = (currentUser: CurrentUserLike) =>
  currentUser
    ? collectIdentifiers(currentUser)
    : [];

const isPendingParticipant = (participant?: ParticipantLike | null) => {
  const status = normalize(participant?.actionStatus || participant?.status);
  return !status || status === "pending" || status === "not_started";
};

const isAssignedToCurrentUser = (participant: ParticipantLike | null | undefined, currentUser: CurrentUserLike) => {
  const identifiers = currentUserIdentifiers(currentUser);
  if (identifiers.length === 0 || !participant) return false;
  return collectIdentifiers(participant).some((identifier) => identifiers.includes(identifier));
};

export const getFirstPendingParticipant = (participants?: ParticipantLike[] | null) =>
  (participants || []).find((participant) => isPendingParticipant(participant)) || null;

export const canShowReviewRevisionAction = <T extends { reviewers?: ParticipantLike[] | null }>(
  revision: T | null | undefined,
  currentUser: CurrentUserLike,
) => {
  if ((revision as { canReviewRevision?: boolean } | null | undefined)?.canReviewRevision) {
    return true;
  }
  const firstPendingReviewer = getFirstPendingParticipant(revision?.reviewers);
  return isAssignedToCurrentUser(firstPendingReviewer, currentUser);
};

export const canShowApproveRevisionAction = <T extends { approvers?: ParticipantLike[] | null }>(
  revision: T | null | undefined,
  currentUser: CurrentUserLike,
) => {
  if ((revision as { canApproveRevision?: boolean } | null | undefined)?.canApproveRevision) {
    return true;
  }
  const firstPendingApprover = getFirstPendingParticipant(revision?.approvers);
  return isAssignedToCurrentUser(firstPendingApprover, currentUser);
};
