import React from "react";
import { Button } from "@/components/ui/button/Button";
import { cn } from "@/components/ui/utils";
import { getApiErrorMessage } from "@/utils/apiError";

/** What the server said about the number being typed. A warning is valid but worth a second look. */
export interface ManualNumberCheck {
  valid: boolean;
  message?: string | null;
  warning?: boolean;
  suggestion?: string | null;
}

interface ManualNumberFieldProps {
  label: string;
  /** The shape the number must have, shown under the box (for example "SOP.NNNN"). */
  formatHint?: string | null;
  placeholder?: string;
  /** The number already saved on the record; empty before the first save. */
  savedNumber?: string | null;
  /** Why the box cannot be used yet (for example the Document Type is not chosen); the box is disabled while it is set. */
  blockedReason?: string | null;
  /** The live check. It is called after the person stops typing. */
  runCheck: (typed: string) => Promise<ManualNumberCheck>;
  /** Before the first save: the typed value and whether the server accepts it. */
  onValueChange?: (typed: string, accepted: boolean) => void;
  /** After the first save: whether the number may still be changed. */
  loadChangeState?: () => Promise<{ editable: boolean; message?: string | null }>;
  /** After the first save: makes the change, with the reason, and returns the number now saved. */
  applyChange?: (typed: string, reason: string) => Promise<string>;
  onChanged?: (newNumber: string) => void;
  /** Number of characters the number is shown as (the box is upper case). */
  className?: string;
}

const BOX =
  "w-full h-9 px-3.5 text-sm border rounded-lg focus:outline-none focus:ring-1 disabled:bg-slate-50 disabled:text-slate-500";

/**
 * A number typed by hand (Document Number, Training Number). Before the record is saved the box is always open and is checked as the person types;
 * once saved, the number is shown and, while the server still allows it, can be changed with a reason.
 */
export const ManualNumberField: React.FC<ManualNumberFieldProps> = ({
  label,
  formatHint,
  placeholder,
  savedNumber,
  blockedReason,
  runCheck,
  onValueChange,
  loadChangeState,
  applyChange,
  onChanged,
  className,
}) => {
  const isSaved = Boolean(savedNumber);
  const [typed, setTyped] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [editing, setEditing] = React.useState(false);
  const [result, setResult] = React.useState<ManualNumberCheck | null>(null);
  const [checking, setChecking] = React.useState(false);
  const [changeState, setChangeState] = React.useState<{ editable: boolean; message?: string | null } | null>(null);
  const [suggestion, setSuggestion] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const requestId = React.useRef(0);

  const open = !isSaved || editing;

  // Whether a saved number may be changed.
  React.useEffect(() => {
    if (!isSaved || !loadChangeState) {
      setChangeState(null);
      return;
    }
    let cancelled = false;
    loadChangeState()
      .then((state) => !cancelled && setChangeState(state))
      .catch(() => !cancelled && setChangeState({ editable: false }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSaved, savedNumber]);

  // The live check, after the person stops typing. An answer that arrives after a newer keystroke is dropped.
  React.useEffect(() => {
    if (!open || blockedReason) {
      setResult(null);
      return;
    }
    const value = typed.trim();
    if (!value) {
      // Nothing typed yet: ask once for the suggestion (the next number), without showing an error.
      setResult(null);
      setChecking(false);
      const id = ++requestId.current;
      runCheck("")
        .then((answer) => {
          if (id === requestId.current) setSuggestion(answer.suggestion ?? null);
        })
        .catch(() => undefined);
      return;
    }
    setChecking(true);
    const id = ++requestId.current;
    const timer = window.setTimeout(() => {
      runCheck(value)
        .then((answer) => {
          if (id === requestId.current) setResult(answer);
        })
        .catch(() => {
          if (id === requestId.current) setResult({ valid: false, message: "The number could not be checked. Try again." });
        })
        .finally(() => {
          if (id === requestId.current) setChecking(false);
        });
    }, 400);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typed, open, blockedReason]);

  // Before the first save the parent needs the value and whether it is accepted.
  React.useEffect(() => {
    if (isSaved) return;
    onValueChange?.(typed.trim(), Boolean(result?.valid) && !checking && typed.trim().length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typed, result, checking, isSaved]);

  const tone = !result ? "neutral" : !result.valid ? "error" : result.warning ? "warning" : "ok";
  const borderClass =
    tone === "error"
      ? "border-red-400 focus:ring-red-500 focus:border-red-500"
      : tone === "warning"
        ? "border-amber-400 focus:ring-amber-500 focus:border-amber-500"
        : tone === "ok"
          ? "border-emerald-400 focus:ring-emerald-500 focus:border-emerald-500"
          : "border-slate-200 focus:ring-emerald-500 focus:border-emerald-500";
  const messageClass = tone === "error" ? "text-red-600" : tone === "warning" ? "text-amber-700" : "text-emerald-700";

  const startEditing = () => {
    setTyped(savedNumber ?? "");
    setReason("");
    setSaveError(null);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setTyped("");
    setResult(null);
    setSaveError(null);
  };

  const saveChange = async () => {
    if (!applyChange) return;
    setSaving(true);
    setSaveError(null);
    try {
      const now = await applyChange(typed.trim(), reason.trim());
      setEditing(false);
      setTyped("");
      setResult(null);
      onChanged?.(now);
    } catch (error) {
      setSaveError(getApiErrorMessage(error, "The number could not be changed."));
    } finally {
      setSaving(false);
    }
  };

  const canSaveChange =
    editing &&
    Boolean(result?.valid) &&
    !checking &&
    reason.trim().length > 0 &&
    typed.trim().toUpperCase() !== (savedNumber ?? "").toUpperCase();

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label className="text-xs sm:text-sm font-medium text-slate-700 capitalize">{label}</label>

      {isSaved && !editing && (
        <div className="flex items-center gap-2">
          <input type="text" value={savedNumber ?? ""} readOnly className={cn(BOX, "border-slate-200 bg-slate-50 text-slate-700")} />
          {changeState?.editable && applyChange && (
            <Button type="button" size="sm" variant="outline-emerald" className="whitespace-nowrap" onClick={startEditing}>
              Change
            </Button>
          )}
        </div>
      )}
      {isSaved && !editing && changeState && !changeState.editable && changeState.message && (
        <p className="text-xs text-slate-500">{changeState.message}</p>
      )}

      {open && (
        <>
          <input
            type="text"
            value={typed}
            disabled={Boolean(blockedReason)}
            onChange={(e) => setTyped(e.target.value.toUpperCase())}
            placeholder={placeholder}
            aria-invalid={tone === "error"}
            className={cn(BOX, borderClass)}
          />
          {blockedReason && <p className="text-xs text-slate-500">{blockedReason}</p>}
          {!blockedReason && !typed.trim() && formatHint && <p className="text-xs text-slate-500">Format: {formatHint}</p>}
          {!blockedReason && !typed.trim() && suggestion && (
            <button
              type="button"
              className="self-start text-xs font-medium text-emerald-700 underline underline-offset-2"
              onClick={() => setTyped(suggestion)}
            >
              Use {suggestion}
            </button>
          )}
          {!blockedReason && typed.trim() && checking && <p className="text-xs text-slate-500">Checking...</p>}
          {!blockedReason && typed.trim() && !checking && result && (
            <p className={cn("text-xs", messageClass)}>
              {result.message ?? (result.valid ? "This number is free to use." : "This number cannot be used.")}
            </p>
          )}
        </>
      )}

      {editing && (
        <div className="flex flex-col gap-2">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for the change (recorded in the Audit Trail)"
            rows={2}
            className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
          />
          {saveError && <p className="text-xs text-red-600">{saveError}</p>}
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={cancelEditing} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" size="sm" variant="outline-emerald" onClick={saveChange} disabled={!canSaveChange || saving}>
              {saving ? "Saving..." : "Save number"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
