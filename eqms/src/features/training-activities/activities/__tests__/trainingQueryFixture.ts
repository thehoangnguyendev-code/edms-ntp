type Person = { sessionId: string; personUserId?: string; state: string; result: string; plannedAbsence?: string };
/** Represents the query API's response in workflow UI regression tests. */
export function withParticipantSummary<T extends { participants: Person[] }>(activity: T) {
  const stats = (people: Person[]) => ({
    total: people.length,
    pending: people.filter(p => p.state === "INVITED").length,
    attendancePending: people.filter(p => p.state === "INVITED" && !p.plannedAbsence).length,
    eligible: people.filter(p => p.personUserId && ["ATTENDED", "ONLINE"].includes(p.state)).length,
    unscored: people.filter(p => p.personUserId && ["ATTENDED", "ONLINE"].includes(p.state) && p.result === "PENDING").length,
    present: people.filter(p => ["ATTENDED", "ONLINE", "READ_CONFIRMED"].includes(p.state)).length,
    absent: people.filter(p => p.state === "ABSENT" || (p.state === "INVITED" && p.plannedAbsence)).length,
    actualAbsent: people.filter(p => p.state === "ABSENT").length,
    passed: people.filter(p => p.result === "PASSED").length,
    failed: people.filter(p => p.result === "FAILED").length,
    readPending: people.filter(p => p.state === "READ_CONFIRMED" && p.result === "PENDING").length,
  });
  return { ...activity, sessionParticipants: activity.participants,
    supplementaryCandidates: activity.participants.filter(p => p.state === "ABSENT" || p.result === "FAILED"),
    participantSummary: { all: stats(activity.participants), sessions: Object.fromEntries([...new Set(activity.participants.map(p => p.sessionId))].map(id => [id, stats(activity.participants.filter(p => p.sessionId === id))])) },
  };
}
