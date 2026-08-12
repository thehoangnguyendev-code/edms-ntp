import React, { useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button/Button";
import { DateTimePicker } from "@/components/ui/datetime-picker/DateTimePicker";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { FormModal } from "@/components/ui/modal/FormModal";
import { cn } from "@/components/ui/utils";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";

interface SuspendModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string, suspendedUntil: string, signatureToken: string) => void | Promise<void>;
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
  const [error, setError] = useState("");
  const [eSignOpen, setESignOpen] = useState(false);

  const resetForm = () => {
    setReason("");
    setSuspendedUntil("");
    setError("");
    setESignOpen(false);
  };

  const handleConfirm = () => {
    if (!reason.trim()) {
      setError("Suspension reason is required");
      return;
    }
    setESignOpen(true);
  };

  const handleESignConfirm = async (signatureToken: string) => {
    await onConfirm(reason.trim(), suspendedUntil, signatureToken);
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
        title="Suspend User"
        description={<>Suspending <span className="font-semibold text-slate-700">{userName}</span></>}
        confirmText="Suspend User"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setError("");
              }}
              placeholder="Enter reason for suspension..."
              rows={3}
              className={cn(
                "w-full px-3 py-2.5 text-sm border rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-slate-400",
                error ? "border-red-300 bg-red-50" : "border-slate-200"
              )}
            />
            {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
          </div>

          <div>
            <DateTimePicker
              label="Suspended Until (optional)"
              value={suspendedUntil}
              onChange={setSuspendedUntil}
              placeholder="Leave empty for indefinite"
            />
            <p className="text-[11px] sm:text-xs font-normal text-slate-400 flex items-center gap-1">Leave empty to suspend indefinitely</p>
          </div>

          <WarningBanner
            variant="warning"
            description="The user will be unable to log in while suspended. All data and records will be preserved."
          />
        </div>
      </FormModal>

      <ESignatureModal
        isOpen={eSignOpen}
        onClose={() => setESignOpen(false)}
        onConfirm={(data) => handleESignConfirm(data.signatureToken)}
        actionTitle={`Suspend User: ${userName}`}
      />
    </>
  );
};
