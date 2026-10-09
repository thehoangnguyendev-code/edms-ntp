import React, { useState } from "react";
import { FormModal } from "@/components/ui/modal/FormModal";
import { Select } from "@/components/ui/select/Select";
import { FormField, Input, Textarea } from "@/components/ui/form/ResponsiveForm";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import type { CreateBackupPayload } from "@/services/api/backupRestore";

export type CreateBackupInput = CreateBackupPayload;

const MAX_REASON = 500;

/**
 * Starts a backup now, in addition to the schedule. What it covers is set by the running Backup Policy. The request is audited with the person and the reason.
 */
export const CreateBackupModal: React.FC<{
  isOpen: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (input: CreateBackupInput) => void;
}> = ({ isOpen, busy = false, onClose, onConfirm }) => {
  const [type, setType] = useState<CreateBackupPayload["type"]>("FULL");
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");

  const preChange = type === "PRE_CHANGE";
  const valid = reason.trim().length > 0 && reason.length <= MAX_REASON && (!preChange || reference.trim().length > 0);

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Backup"
      description="Starts a backup now, in addition to the schedule. It is recorded in the audit trail with your name and reason."
      confirmText={busy ? "Starting…" : "Start Backup"}
      confirmDisabled={!valid || busy}
      onConfirm={() => {
        onConfirm({ type, reason: reason.trim(), changeControlRef: preChange ? reference.trim() : undefined });
        setReason("");
        setReference("");
        setType("FULL");
      }}
    >
      <div className="space-y-4">
        <WarningBanner variant="info" description="This backup covers what the running Backup Policy includes: the eQMS database and, if the policy says so, the stored documents. It is encrypted before it is written, and it is kept permanently." />
        <FormField label="Backup type">
          <Select
            value={type}
            onChange={setType}
            options={[
              { label: "Full: a complete, self-contained copy", value: "FULL" },
              { label: "Pre-change: a named restore point before a planned change", value: "PRE_CHANGE" },
            ]}
          />
        </FormField>
        {preChange && (
          <FormField label="Change control reference" required hint="The change this backup protects, for example CC-2026-0150.">
            <Input value={reference} maxLength={120} onChange={(event) => setReference(event.target.value)} />
          </FormField>
        )}
        <FormField label="Reason" required hint={`${reason.length}/${MAX_REASON}`}>
          <Textarea rows={3} value={reason} maxLength={MAX_REASON} onChange={(event) => setReason(event.target.value)} placeholder="Why is this backup needed now?" />
        </FormField>
      </div>
    </FormModal>
  );
};
