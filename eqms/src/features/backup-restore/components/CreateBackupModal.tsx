import React, { useState } from "react";
import { FormModal } from "@/components/ui/modal/FormModal";
import { Select } from "@/components/ui/select/Select";
import { FormField, Input, Textarea } from "@/components/ui/form/ResponsiveForm";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { PartCheckbox } from "./PartCheckbox";
import type { BackupPart, CreateBackupPayload } from "@/services/api/backupRestore";
import { tr } from "@/i18n";

export type CreateBackupInput = CreateBackupPayload;

const MAX_REASON = 500;

const PARTS: { value: BackupPart; label: string; hint: string }[] = [
  { value: "DATABASE", label: "Database", get hint() { return tr("All records and the system settings: documents, revisions, workflow, training, audit trail, e-signatures, users, configuration, roles and permissions."); } },
  { value: "OBJECT_STORE", label: "Files", get hint() { return tr("Every stored file: documents, revisions, copies, images, tests, scans and reports. Only what is new since the last backup is copied."); } },
];

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
  const [parts, setParts] = useState<BackupPart[]>(["DATABASE", "OBJECT_STORE"]);

  const preChange = type === "PRE_CHANGE";
  const valid = reason.trim().length > 0 && reason.length <= MAX_REASON && (!preChange || reference.trim().length > 0) && parts.length > 0;
  const toggle = (part: BackupPart) => setParts((current) => (current.includes(part) ? current.filter((p) => p !== part) : [...current, part]));

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={tr("Create Backup")}
      description={tr("Starts a backup now, in addition to the schedule. It is recorded in the audit trail with your name and reason.")}
      confirmText={busy ? "Starting…" : tr("Start Backup")}
      confirmDisabled={!valid || busy}
      onConfirm={() => {
        onConfirm({ type, reason: reason.trim(), changeControlRef: preChange ? reference.trim() : undefined, components: PARTS.map((p) => p.value).filter((v) => parts.includes(v)) });
        setReason("");
        setReference("");
        setType("FULL");
        setParts(["DATABASE", "OBJECT_STORE"]);
      }}
    >
      <div className="space-y-4">
        <WarningBanner variant="info" description={tr("Choose what to back up. It is encrypted before it is written, and it is kept permanently. A backup can be restored in the same parts it was made of.")} />
        <FormField label={tr("What to back up")} required hint={parts.length === 0 ? tr("Choose at least one.") : undefined}>
          <div className="space-y-2">
            {PARTS.map((part) => (
              <PartCheckbox key={part.value} id={`backup-part-${part.value}`} label={part.label} hint={part.hint} checked={parts.includes(part.value)} onChange={() => toggle(part.value)} />
            ))}
          </div>
        </FormField>
        <FormField label={tr("Backup type")}>
          <Select
            value={type}
            onChange={setType}
            options={[
              { label: tr("Full: a complete, self-contained copy"), value: "FULL" },
              { label: tr("Pre-change: a named restore point before a planned change"), value: "PRE_CHANGE" },
            ]}
          />
        </FormField>
        {preChange && (
          <FormField label={tr("Change control reference")} required hint={tr("The change this backup protects, for example CC-2026-0150.")}>
            <Input value={reference} maxLength={120} onChange={(event) => setReference(event.target.value)} />
          </FormField>
        )}
        <FormField label={tr("Reason")} required hint={`${reason.length}/${MAX_REASON}`}>
          <Textarea rows={3} value={reason} maxLength={MAX_REASON} onChange={(event) => setReason(event.target.value)} placeholder={tr("Why is this backup needed now?")} />
        </FormField>
      </div>
    </FormModal>
  );
};
