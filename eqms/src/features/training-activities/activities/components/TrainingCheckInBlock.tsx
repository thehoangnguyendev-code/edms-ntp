import { sessionStarted } from "@/services/api/trainingActivities";
import { CheckInReveal } from "./CheckInReveal";
import { useCountdown } from "./useCountdown";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { Drawer } from "@/components/ui/drawer";
import { cn } from "@/components/ui/utils";
import { SlidingNumber } from "@/components/ui/sliding-number";
import { useToast } from "@/components/ui/toast/Toast";
import {
  trainingActivitiesApi,
  trainingCheckInApi,
  trainingError,
  type TrainingActivityDetail,
  type TrainingCheckInStatus,
} from "@/services/api/trainingActivities";

/**
 * Self check-in (PLAN-TR-001 17.7): the trainer opens the door for a held session and shows the code or the QR on the room screen. Trainees enter it and sign on their own device.
 * The quick roll-call below stays for anyone without a device. The code changes every few minutes, so a photo of it soon stops working.
 */
export function TrainingCheckInBlock({
  activity,
  onChanged,
  footer,
}: {
  activity: TrainingActivityDetail;
  onChanged: (next: TrainingActivityDetail) => void;
  /** The buttons that go under the check-in (the quick roll-call), in the same panel. */
  footer?: ReactNode;
}) {
  const held = activity.sessions.filter(sessionStarted);
  const [sessionId, setSessionId] = useState(held[0]?.id ?? "");
  const [state, setState] = useState<TrainingCheckInStatus>();
  const [busy, setBusy] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [deadline, setDeadline] = useState(0);
  const { showToast } = useToast();
  const lastCount = useRef<number | undefined>(undefined);
  const anchor = useRef<{ code?: string; deadline: number }>({ deadline: 0 });
  // One place sets the status and the moment the code ends. The server says the seconds left as a whole number, and every reading is a little late, so a reading of the same code
  // within a second and a half of the moment already kept is only that rounding: it is ignored, and the countdown is never moved back and forth by a poll. A new code, or a reading
  // that is far from the kept moment, sets the moment again.
  const apply = useCallback((next: TrainingCheckInStatus) => {
    setState(next);
    const candidate = next.open && next.secondsLeft != null ? Date.now() + next.secondsLeft * 1000 : 0;
    const kept = anchor.current;
    if (candidate && kept.deadline && kept.code === next.code && Math.abs(candidate - kept.deadline) < 1500) return;
    anchor.current = { code: next.code, deadline: candidate };
    setDeadline(candidate);
  }, []);
  const refresh = useCallback(async () => {
    if (!sessionId) return;
    try {
      const next = await trainingCheckInApi.status(sessionId);
      apply(next);
      if (
        lastCount.current !== undefined &&
        lastCount.current !== next.checkedIn
      )
        onChanged(await trainingActivitiesApi.get(activity.id));
      lastCount.current = next.checkedIn;
    } catch {
      /* the next poll tries again */
    }
  }, [sessionId, activity.id, onChanged, apply]);
  useEffect(() => {
    lastCount.current = undefined;
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (!state?.open) return;
    const id = setInterval(() => void refresh(), 5000);
    return () => clearInterval(id);
  }, [state?.open, refresh]);
  // The clock is read from the time, not counted; when it reaches zero the new code is fetched at once.
  const left = useCountdown(state?.open ? deadline : 0);
  useEffect(() => {
    if (left === 0) void refresh();
  }, [left, refresh]);

  if (held.length === 0) return null;
  const act = async (fn: (id: string) => Promise<TrainingCheckInStatus>) => {
    setBusy(true);
    try {
      apply(await fn(sessionId));
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

  // Who is where in the chosen session: the meter and its legend are written out, so the colour is never the only carrier.
  const people = activity.participants.filter((p) => p.sessionId === sessionId);
  const present = people.filter((p) => p.state === "ATTENDED" || p.state === "ONLINE").length;
  const absent = people.filter((p) => p.state === "ABSENT").length;
  const toMark = people.filter((p) => p.state === "INVITED").length;
  const open = !!state?.open;
  const codeBlock = (
    <>
      <div data-reveal="code" className="text-xs text-slate-500">
        Code changes in{" "}
        <span role="timer" aria-live="off" className={cn("font-semibold tabular-nums", clockColor, urgent && "text-sm")}>
          {mins}
        </span>
      </div>
      <div data-reveal="code" className="text-3xl font-bold text-slate-900" aria-label="Check-in code">
        {/^[0-9]+$/.test(state?.code ?? "") ? (
          <SlidingNumber number={Number(state?.code)} minDigits={state?.code?.length} initiallyStable className="gap-1.5 lg:gap-2" />
        ) : (
          <span className="tracking-[0.2em]">{state?.code}</span>
        )}
      </div>
    </>
  );

  return (
    <section aria-label="Self check-in" className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-2 px-4 pt-4">
        <h3 className="text-sm font-semibold text-slate-900">Self check-in</h3>
        <Badge color={open ? "emerald" : "slate"} showDot>{open ? "Open" : "Closed"}</Badge>
      </div>
      <div className="flex flex-col gap-4 p-4">
        {held.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {held.map((s) => (
              <Button key={s.id} size="sm" variant={s.id === sessionId ? "default" : "outline"} onClick={() => setSessionId(s.id)}>
                Session {s.sessionNo}
              </Button>
            ))}
          </div>
        )}
        <CheckInReveal
          open={open}
          shown={
            <div className="flex flex-col gap-4">
              <div data-reveal="qr" className="relative mx-auto hidden w-fit overflow-hidden rounded-lg border border-slate-200 bg-white p-2.5 lg:block">
                <QRCodeSVG value={url} size={176} aria-label="Check-in QR code" />
                <span data-reveal="scan" aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-0 shadow-[0_0_14px_3px_rgba(16,185,129,0.55)]" />
              </div>
              <div className="lg:text-center">{codeBlock}</div>
            </div>
          }
          closed={
            <p className="text-xs text-slate-500">
              Open the check-in and show the code to the room. Each trainee enters it on their own phone or computer and signs with their password. Anyone without a device is marked in the quick roll-call.
            </p>
          }
        />
        <div className="rounded-lg bg-slate-50 p-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-2xl font-semibold leading-none text-slate-900">
              {present}
              <span className="text-sm font-normal text-slate-500"> / {people.length}</span>
            </span>
            <span className="text-xs text-slate-500">present</span>
          </div>
          <div
            className="mt-2 flex gap-0.5 overflow-hidden rounded-full bg-slate-200"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={people.length}
            aria-valuenow={present}
            aria-label="People present in the session"
          >
            {present > 0 && <span className="h-1.5 bg-emerald-500" style={{ flexGrow: present }} />}
            {toMark > 0 && <span className="h-1.5 bg-slate-200" style={{ flexGrow: toMark }} />}
            {absent > 0 && <span className="h-1.5 bg-red-400" style={{ flexGrow: absent }} />}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-emerald-500" />{present} present</span>
            <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-slate-300" />{toMark} still to mark</span>
            <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-red-400" />{absent} absent</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-1 [&>button]:w-full">
          {open ? (
            <>
              <Button variant="default" size="sm" className="lg:hidden" onClick={() => setQrOpen(true)}>Show QR</Button>
              <Button variant="outline" size="sm" className="hidden lg:inline-flex" loading={busy} onClick={() => void act(trainingCheckInApi.close)}>Close the check-in</Button>
            </>
          ) : (
            <Button variant="default" size="sm" loading={busy} onClick={() => void act(trainingCheckInApi.open)}>Open the check-in</Button>
          )}
          {footer}
        </div>
        {footer && <p className="hidden text-xs text-slate-500 lg:block">Mark the whole room at once and sign one time, for people without a device.</p>}
      </div>
      {qrOpen && open && (
        <Drawer
          title="Self check-in"
          onClose={() => setQrOpen(false)}
          footer={
            <Button variant="outline" size="sm" loading={busy} onClick={() => { setQrOpen(false); void act(trainingCheckInApi.close); }}>
              Close the check-in
            </Button>
          }
        >
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <QRCodeSVG value={url} size={220} aria-label="Check-in QR code" />
            </div>
            <div>{codeBlock}</div>
          </div>
        </Drawer>
      )}
    </section>
  );
}
