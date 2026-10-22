import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button/Button";
import { useToast } from "@/components/ui/toast/Toast";
import {
  trainingActivitiesApi,
  trainingCheckInApi,
  trainingError,
  type TrainingActivityDetail,
  type TrainingCheckInStatus,
} from "@/services/api/trainingActivities";
import { TabBlock } from "../../shared/TrainingDetailLayout";

/**
 * Self check-in (PLAN-TR-001 17.7): the trainer opens the door for a held session and shows the code or the QR on the room screen. Trainees enter it and sign on their own device.
 * The quick roll-call below stays for anyone without a device. The code changes every few minutes, so a photo of it soon stops working.
 */
export function TrainingCheckInBlock({
  activity,
  onChanged,
}: {
  activity: TrainingActivityDetail;
  onChanged: (next: TrainingActivityDetail) => void;
}) {
  const held = activity.sessions.filter((s) => s.status === "HELD");
  const [sessionId, setSessionId] = useState(held[0]?.id ?? "");
  const [state, setState] = useState<TrainingCheckInStatus>();
  const [busy, setBusy] = useState(false);
  const [deadline, setDeadline] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const { showToast } = useToast();
  const lastCount = useRef<number | undefined>(undefined);
  const refresh = useCallback(async () => {
    if (!sessionId) return;
    try {
      const next = await trainingCheckInApi.status(sessionId);
      setState(next);
      setDeadline(
        next.secondsLeft != null ? Date.now() + next.secondsLeft * 1000 : 0,
      );
      if (
        lastCount.current !== undefined &&
        lastCount.current !== next.checkedIn
      )
        onChanged(await trainingActivitiesApi.get(activity.id));
      lastCount.current = next.checkedIn;
    } catch {
      /* the next poll tries again */
    }
  }, [sessionId, activity.id, onChanged]);
  useEffect(() => {
    lastCount.current = undefined;
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (!state?.open) return;
    const id = setInterval(() => void refresh(), 5000);
    return () => clearInterval(id);
  }, [state?.open, refresh]);
  // The clock runs here every second, so it never waits for the next poll; when it reaches zero the new code is fetched at once.
  useEffect(() => {
    if (!state?.open) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [state?.open]);
  const left =
    state?.open && deadline
      ? Math.max(0, Math.ceil((deadline - now) / 1000))
      : null;
  useEffect(() => {
    if (left === 0) void refresh();
  }, [left, refresh]);

  if (held.length === 0) return null;
  const act = async (fn: (id: string) => Promise<TrainingCheckInStatus>) => {
    setBusy(true);
    try {
      setState(await fn(sessionId));
      lastCount.current = undefined;
    } catch (e) {
      showToast({
        type: "error",
        title: "The action was not done",
        message: trainingError(e),
      });
    } finally {
      setBusy(false);
    }
  };
  const url = state?.code
    ? `${window.location.origin}/training-management/check-in?code=${state.code}`
    : "";
  const mins =
    left != null
      ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`
      : "";
  // Green while there is time, amber in the last minute, red and blinking in the last 15 seconds.
  const urgent = left != null && left <= 15;
  const clockColor = urgent
    ? (left ?? 0) % 2 === 0
      ? "text-red-600"
      : "text-red-300"
    : left != null && left <= 60
      ? "text-amber-600"
      : "text-emerald-700";

  return (
    <TabBlock title="Self check-in">
      <p className="px-4 py-3 text-xs text-slate-500">
        Open the check-in and show the code to the room. Each trainee enters it
        on their own phone or computer and signs. Anyone without a device is
        marked in the quick roll-call.
      </p>
      <div className="space-y-4 p-4">
        {held.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {held.map((s) => (
              <Button
                key={s.id}
                size="sm"
                variant={s.id === sessionId ? "default" : "outline"}
                onClick={() => setSessionId(s.id)}
              >
                Session {s.sessionNo}
              </Button>
            ))}
          </div>
        )}
        {state?.open ? (
          <div className="flex flex-wrap items-center gap-6">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <QRCodeSVG
                value={url}
                size={160}
                includeMargin
                aria-label="Check-in QR code"
              />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-semibold text-slate-700">
                Code changes in{" "}
                <span
                  role="timer"
                  aria-live="off"
                  className={`ml-1 text-2xl font-extrabold tabular-nums ${clockColor}`}
                >
                  {mins}
                </span>
              </div>
              <div
                className="text-5xl font-extrabold tracking-widest text-slate-900"
                aria-label="Check-in code"
              >
                {state.code}
              </div>
              <div className="text-sm text-slate-600">
                {state.checkedIn} checked in, {state.invited} still to mark
              </div>
              <div className="pt-2">
                <Button
                  size="sm"
                  variant="default"
                  loading={busy}
                  onClick={() => void act(trainingCheckInApi.close)}
                >
                  Close the check-in
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline-emerald"
              loading={busy}
              onClick={() => void act(trainingCheckInApi.open)}
            >
              Open the check-in
            </Button>
            {state && state.checkedIn > 0 && (
              <span className="text-sm text-slate-600">
                {state.checkedIn} checked in by themselves
              </span>
            )}
          </div>
        )}
      </div>
    </TabBlock>
  );
}
