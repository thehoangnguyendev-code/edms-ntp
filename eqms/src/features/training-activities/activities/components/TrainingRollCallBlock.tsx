import { statusChange } from "../../shared/trainingLabels";
import { useState } from "react";
import { Button } from "@/components/ui/button/Button";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { FormModal } from "@/components/ui/modal/FormModal";
import { Select } from "@/components/ui/select/Select";
import { useToast } from "@/components/ui/toast/Toast";
import { trainingError, trainingPaperApi, type TrainingActivityDetail, type TrainingSession } from "@/services/api/trainingActivities";
import { Input } from "../../shared/TrainingFields";
import { TabBlock } from "../../shared/TrainingDetailLayout";

type Mark = { state: "PRESENT" | "ABSENT"; reason: string };

/**
 * Quick roll-call (PLAN-TR-001 17.7): the trainer marks who is present for a whole session and signs once. Each row then shows that the trainer, not the trainee,
 * vouches for it. Only people still invited are listed; the server refuses anyone already recorded.
 */
export function TrainingRollCallBlock({ activity, onChanged }: { activity: TrainingActivityDetail; onChanged: (next: TrainingActivityDetail) => void }) {
  const { showToast } = useToast();
  const [session, setSession] = useState<TrainingSession>();
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [signing, setSigning] = useState(false);

  const held = activity.sessions.filter((s) => s.status === "HELD");
  const invited = (sessionId: string) => activity.participants.filter((p) => p.sessionId === sessionId && p.state === "INVITED");
  const candidates = held.filter((s) => invited(s.id).length > 0);
  if (candidates.length === 0) return null;

  const open = (s: TrainingSession) => {
    setSession(s);
    setMarks(Object.fromEntries(invited(s.id).map((p) => [p.id, { state: "PRESENT", reason: "" } as Mark])));
  };
  const rows = session ? invited(session.id) : [];
  const valid = rows.every((p) => marks[p.id]?.state === "PRESENT" || (marks[p.id]?.reason ?? "").trim().length > 0);

  return (
    <>
      <TabBlock title="Quick roll-call">
        <p className="px-4 py-3 text-xs text-slate-500">Mark everyone of a session at once and sign one time. Use it when the trainer vouches for the attendance of the room.</p>
        <div className="flex flex-wrap gap-2 p-4">
          {candidates.map((s) => <Button key={s.id} size="sm" variant="outline-emerald" onClick={() => open(s)}>Session {s.sessionNo} ({invited(s.id).length} to mark)</Button>)}
        </div>
      </TabBlock>

      {session && !signing && (
        <FormModal isOpen onClose={() => setSession(undefined)} onConfirm={() => setSigning(true)} title={`Roll-call of session ${session.sessionNo}`} description="Everyone starts as present. Change the ones who were absent and say why. Next you sign." confirmText="Continue to sign" confirmDisabled={!valid} size="xl">
          <div className="space-y-2">
            {rows.map((p, i) => {
              const m = marks[p.id];
              return (
                <div key={p.id} className="grid grid-cols-1 items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-12">
                  <div className="md:col-span-5"><span className="mr-2 text-xs text-slate-500">{i + 1}</span><span className="text-sm font-medium text-slate-900">{p.fullName}</span></div>
                  <div className="md:col-span-3"><Select value={m.state} options={[{ value: "PRESENT", label: "Present" }, { value: "ABSENT", label: "Absent" }]} aria-label={`Attendance of ${p.fullName}`} onChange={(v) => setMarks((x) => ({ ...x, [p.id]: { ...x[p.id], state: v as Mark["state"] } }))} /></div>
                  {m.state === "ABSENT" && <div className="md:col-span-4"><Input placeholder="Reason for the absence" aria-label={`Reason of ${p.fullName}`} value={m.reason} onChange={(e) => setMarks((x) => ({ ...x, [p.id]: { ...x[p.id], reason: e.target.value } }))} /></div>}
                </div>
              );
            })}
          </div>
        </FormModal>
      )}

      <ESignatureModal
        isOpen={signing && !!session}
        onClose={() => setSigning(false)}
        onConfirm={async (data: { signatureToken: string }) => {
          if (!session) return;
          try {
            const next = await trainingPaperApi.rollCall(session.id, {
              present: rows.filter((p) => marks[p.id].state === "PRESENT").map((p) => p.id),
              absent: rows.filter((p) => marks[p.id].state === "ABSENT").map((p) => ({ participantId: p.id, reason: marks[p.id].reason.trim() })),
              signatureToken: data.signatureToken,
            });
            setSigning(false);
            setSession(undefined);
            showToast({ type: "success", title: "Roll-call recorded", message: activity.trainingNumber });
            onChanged(next);
          } catch (e) {
            showToast({ type: "error", title: "The action was not done", message: trainingError(e) });
          }
        }}
        actionTitle="Attest the roll-call of the session"
        changes={statusChange("Not attested", "Attested by the trainer", "Roll-call")}
        meaningDisplayName="Attendance Confirmed by Trainer"
        meaningCode="TRAINING_ATTENDANCE_CONFIRMED"
        targetDetails={{ code: activity.trainingNumber, title: activity.trainingTitle, revision: "" }}
      />
    </>
  );
}
