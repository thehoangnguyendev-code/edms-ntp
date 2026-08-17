import React, { useState } from "react";
import { createPortal } from "react-dom";
import { UserX, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button/Button";
import { Select } from "@/components/ui/select/Select";
import { DateTimePicker } from "@/components/ui/datetime-picker/DateTimePicker";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { FormModal } from "@/components/ui/modal/FormModal";

const TERMINATION_REASON_OPTIONS = [
  { label: "Resignation", value: "Resignation" },
  { label: "Layoff / Redundancy", value: "Layoff / Redundancy" },
  { label: "Contract Ended", value: "Contract Ended" },
  { label: "Retirement", value: "Retirement" },
  { label: "Dismissal", value: "Dismissal" },
  { label: "Other", value: "Other" },
];

interface TerminateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string, terminationDate: string, signatureToken: string) => void | Promise<void>;
  userName: string;
}

export const TerminateModal: React.FC<TerminateModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  userName,
}) => {
  const [reason, setReason] = useState("");
  const [terminationDate, setTerminationDate] = useState("");
  const [errors, setErrors] = useState<{ reason?: string; date?: string }>({});
  const [eSignOpen, setESignOpen] = useState(false);

  const resetForm = () => {
    setReason("");
    setTerminationDate("");
    setErrors({});
    setESignOpen(false);
  };

  const handleConfirm = () => {
    const newErrors: { reason?: string; date?: string } = {};
    if (!reason) newErrors.reason = "Termination reason is required";
    if (!terminationDate) newErrors.date = "Termination date is required";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setESignOpen(true);
  };

  const handleESignConfirm = async (signatureToken: string) => {
    await onConfirm(reason, terminationDate, signatureToken);
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
        title="Terminate Employee"
        description={<>Terminating <span className="font-semibold text-slate-700">{userName}</span></>}
        confirmText="Terminate Employee"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <Select
              label={<>Reason <span className="text-red-500">*</span></>}
              value={reason}
              onChange={(v) => {
                setReason(v);
                setErrors((e) => ({ ...e, reason: undefined }));
              }}
              options={TERMINATION_REASON_OPTIONS}
              placeholder="Select termination reason"
            />
            {errors.reason && <p className="text-xs text-red-600 mt-1">{errors.reason}</p>}
          </div>

          <div>
            <DateTimePicker
              label={<>Termination Date <span className="text-red-500">*</span></>}
              value={terminationDate}
              onChange={(v) => {
                setTerminationDate(v);
                setErrors((e) => ({ ...e, date: undefined }));
              }}
              placeholder="Select termination date"
            />
            {errors.date && <p className="text-xs text-red-600 mt-1">{errors.date}</p>}
          </div>

          <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-[10px] sm:text-xs text-rose-700 leading-relaxed">
            The user's account will be permanently deactivated. All historical records, documents, and audit trail entries will be preserved.
          </div>
        </div>
      </FormModal>

      <ESignatureModal
        isOpen={eSignOpen}
        onClose={() => setESignOpen(false)}
        onConfirm={(data) => handleESignConfirm(data.signatureToken)}
        actionTitle={`Terminate Employee: ${userName}`}
        meaningDisplayName="User Terminated"
        meaningCode="USER_TERMINATED"
      />
    </>
  );
};
