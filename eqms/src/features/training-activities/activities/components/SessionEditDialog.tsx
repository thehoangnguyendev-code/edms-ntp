import { useState } from "react";
import { FormModal } from "@/components/ui/modal/FormModal";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { Select } from "@/components/ui/select/Select";
import { RadioGroup } from "@/components/ui/radio";
import type { TrainingSession } from "@/services/api/trainingActivities";
import { Input, Textarea } from "../../shared/TrainingFields";
import { TrainingDateField } from "../../shared/TrainingDateField";
import { PersonPicker } from "./TrainingActivityPlanning";

export interface SessionChange {
  trainerUserId?: string; externalTrainerName?: string; scheduledOn?: string;
  locationType: "ONSITE" | "ONLINE" | "HYBRID"; venue?: string; onlinePlatform?: string; meetingLink?: string; reason: string;
}

const PLATFORMS = ["Zoom", "Microsoft Teams", "Google Meet", "Other"].map((p) => ({ label: p, value: p }));

/**
 * Change the trainer, the date or the place of a session before the training starts. The fields start from what the session has; a reason is always asked for, and the old and
 * the new values go to the Audit Trail. An external training has no trainer of the company (only an outside name).
 */
export function SessionEditDialog({ session, external, busy, onClose, onSave }: {
  session: TrainingSession; external: boolean; busy: boolean; onClose: () => void; onSave: (change: SessionChange) => void;
}) {
  const [instructor, setInstructor] = useState<"INTERNAL" | "EXTERNAL">(session.trainerUserId ? "INTERNAL" : "EXTERNAL");
  const [trainerUserId, setTrainerUserId] = useState(session.trainerUserId ?? "");
  const [externalName, setExternalName] = useState(session.externalTrainerName ?? "");
  const [scheduledOn, setScheduledOn] = useState(session.scheduledOn ?? "");
  const [locationType, setLocationType] = useState<"ONSITE" | "ONLINE" | "HYBRID">(session.locationType ?? "ONSITE");
  const [venue, setVenue] = useState(session.venue ?? "");
  const [platform, setPlatform] = useState(session.onlinePlatform ?? "Zoom");
  const [link, setLink] = useState(session.meetingLink ?? "");
  const [reason, setReason] = useState("");

  const trainerOk = external || (instructor === "INTERNAL" ? !!trainerUserId : !!externalName.trim());
  const linkOk = !!platform && /^https:\/\/\S+$/i.test(link.trim());
  const placeOk = locationType === "ONSITE" ? !!venue.trim() : locationType === "HYBRID" ? !!venue.trim() && linkOk : linkOk;
  const ready = trainerOk && placeOk && !!reason.trim();

  return (
    <FormModal
      isOpen onClose={onClose} title={`Change Session ${session.sessionNo}`} confirmText="Save" size="xl" isLoading={busy} confirmDisabled={!ready}
      description="The trainer, the date and the place can be changed until the training starts. People already notified must be told again."
      onConfirm={() => onSave({
        trainerUserId: !external && instructor === "INTERNAL" ? trainerUserId : undefined,
        externalTrainerName: external || instructor === "EXTERNAL" ? externalName.trim() || undefined : undefined,
        scheduledOn: scheduledOn || undefined,
        locationType,
        venue: locationType !== "ONLINE" ? venue.trim() : undefined,
        onlinePlatform: locationType !== "ONSITE" ? platform : undefined,
        meetingLink: locationType !== "ONSITE" ? link.trim() : undefined,
        reason: reason.trim(),
      })}
    >
      <div className="space-y-4">
        {external ? (
          <FormField label="Trainer (outside the company, optional)"><Input value={externalName} maxLength={255} onChange={(e) => setExternalName(e.target.value)} /></FormField>
        ) : (
          <div className="space-y-3">
            <RadioGroup label="Instructor" required name="session-edit-instructor" layout="horizontal" value={instructor} onChange={(v) => { setInstructor(String(v) as "INTERNAL" | "EXTERNAL"); setTrainerUserId(""); setExternalName(""); }}
              options={[{ label: "Internal expert", value: "INTERNAL" }, { label: "External expert/consultant", value: "EXTERNAL" }]} />
            {instructor === "INTERNAL"
              ? <PersonPicker value={trainerUserId} onChange={setTrainerUserId} />
              : <Input value={externalName} maxLength={255} placeholder="Name of the external expert or consultant" onChange={(e) => setExternalName(e.target.value)} />}
          </div>
        )}
        <TrainingDateField label="Scheduled date" value={scheduledOn} onChange={setScheduledOn} />
        <div className="space-y-3">
          <RadioGroup label="Location Type" required name="session-edit-location" layout="horizontal" value={locationType} onChange={(v) => setLocationType(String(v) as "ONSITE" | "ONLINE" | "HYBRID")}
            options={[{ label: "On-site (Physical)", value: "ONSITE" }, { label: "Online (Virtual)", value: "ONLINE" }, { label: "Hybrid (On-site and Online)", value: "HYBRID" }]} />
          {locationType !== "ONLINE" && (
            <FormField label="Physical Location" required><Input value={venue} maxLength={255} onChange={(e) => setVenue(e.target.value)} /></FormField>
          )}
          {locationType !== "ONSITE" && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-4">
              <Select label="Platform" value={platform} enableSearch={false} onChange={setPlatform} options={PLATFORMS} />
              <FormField label="Meeting Link" required><Input value={link} placeholder="https://zoom.us/j/..." onChange={(e) => setLink(e.target.value)} /></FormField>
            </div>
          )}
        </div>
        <FormField label="Reason for the change" required><Textarea rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} /></FormField>
      </div>
    </FormModal>
  );
}
