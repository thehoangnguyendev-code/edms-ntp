import React, { useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button/Button";
import { DateTimePicker } from "@/components/ui/datetime-picker/DateTimePicker";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { FormModal } from "@/components/ui/modal/FormModal";
import { Radio } from "@/components/ui/radio";
import { cn } from "@/components/ui/utils";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { tr } from "@/i18n";

interface SuspendModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string, suspendedUntil: string, signatureToken: string, suspensionKind?: "LONG_LEAVE" | "OTHER") => void | Promise<void>;
  userName: string;
}

export const SuspendModal: React.FC<SuspendModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  userName,
}) => {
  const [reason, setReason] = useState("");
  const [suspendedUntil, setSuspendedUntil] = useState("");
  const [kind, setKind] = useState<"LONG_LEAVE" | "OTHER" | "">("");
  const [error, setError] = useState("");
  const [kindError, setKindError] = useState("");
  const [eSignOpen, setESignOpen] = useState(false);

  const resetForm = () => {
    setReason("");
    setSuspendedUntil("");
    setKind("");
    setError("");
    setKindError("");
    setESignOpen(false);
  };

  const handleConfirm = () => {
    if (!reason.trim()) {
      setError(tr("Suspension reason is required"));
      return;
    }
    if (!kind) {
      setKindError(tr("Choose the kind of suspension"));
      return;
    }
    setESignOpen(true);
  };

  const handleESignConfirm = async (signatureToken: string) => {
    await onConfirm(reason.trim(), suspendedUntil, signatureToken, kind || undefined);
    resetForm();
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <>
      <FormModal
        isOpen={isOpen}
        onClose={handleClose}
        onConfirm={handleConfirm}
        title={tr("Suspend User")}
        description={<>{tr("Suspending")} <span className="font-semibold text-slate-700">{userName}</span></>}
        confirmText={tr("Suspend User")}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 capitalize">
              {tr("Reason")} <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setError("");
              }}
              placeholder={tr("Enter reason for suspension...")}
              rows={3}
              className={cn(
                "w-full px-3 py-2.5 text-sm border rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-slate-400",
                error ? "border-red-300 bg-red-50" : "border-slate-200"
              )}
            />
            {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-700 sm:text-sm">{tr("Kind of suspension")} <span className="text-red-500">*</span></p>
            <div role="radiogroup" aria-label={tr("Kind of suspension")} className="space-y-1.5">
              {([["LONG_LEAVE", tr("Long leave: the person is away for a long time (leave, maternity, sickness)")], ["OTHER", tr("Other reason: security or administration")]] as const).map(([value, label]) => (
                <Radio
                  key={value}
                  name="suspension-kind"
                  value={value}
                  checked={kind === value}
                  onChange={() => { setKind(value); setKindError(""); }}
                  label={label}
                  className="items-start [&>input]:mt-0.5"
                />
              ))}
            </div>
            {kindError && <p role="alert" className="mt-1.5 text-xs text-red-600">{kindError}</p>}
            <p className="mt-1.5 text-xs text-slate-500">{tr("When a person returns after a long leave, Training Management is told so that a training review can be opened (SOP.0003 5.1.1).")}</p>
          </div>

          <div>
            <DateTimePicker
              label={tr("Đình chỉ đến ngày (không bắt buộc)")}
              value={suspendedUntil}
              onChange={setSuspendedUntil}
              placeholder={tr("Leave empty for indefinite")}
            />
            <p className="mt-1.5 text-xs text-slate-500 font-normal flex items-center gap-1">{tr("Leave empty to suspend indefinitely")}</p>
          </div>

          <WarningBanner
            variant="warning"
            description={tr("The user will be unable to log in while suspended. All data and records will be preserved.")}
          />
        </div>
      </FormModal>

      <ESignatureModal
        isOpen={eSignOpen}
        onClose={() => setESignOpen(false)}
        onConfirm={(data) => handleESignConfirm(data.signatureToken)}
        actionTitle={`Suspend User: ${userName}`}
        meaningDisplayName="User Suspended"
        meaningCode="USER_SUSPENDED"
      />
    </>
  );
};
