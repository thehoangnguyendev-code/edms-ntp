import React, { useEffect, useState } from "react";
import { FormModal } from "@/components/ui/modal/FormModal";
import { Select } from "@/components/ui/select/Select";
import { FormField, Textarea } from "@/components/ui/form/ResponsiveForm";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { backupRestoreApi, type OfflineMedium } from "@/services/api/backupRestore";
import { getApiErrorMessage } from "@/utils/apiError";
import { formatBytes } from "../format";

const MAX_REASON = 500;

/**
 * Asks for a verified backup, with everything it depends on, to be written to a registered offline medium so a copy can be kept
 * somewhere else. Nothing is written yet: a second person has to approve the request first, and nothing is ever downloaded through
 * the browser.
 */
export const ExportBackupModal: React.FC<{
  backupNumber: string;
  isOpen: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (mediaId: string, reason: string) => void;
}> = ({ backupNumber, isOpen, busy = false, onClose, onConfirm }) => {
  const [media, setMedia] = useState<OfflineMedium[] | undefined>();
  const [estimate, setEstimate] = useState<number | undefined>();
  const [error, setError] = useState("");
  const [mediaId, setMediaId] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    let live = true;
    setError("");
    setMedia(undefined);
    Promise.all([backupRestoreApi.media({ status: "AVAILABLE", limit: 100, sortBy: "label", sortDirection: "asc" }), backupRestoreApi.exportEstimate(backupNumber)])
      .then(([list, size]) => {
        if (!live) return;
        setMedia(list.data);
        setEstimate(size.estimatedBytes);
        const fitting = list.data.filter((m) => m.capacityBytes >= size.estimatedBytes * 1.1);
        setMediaId((current) => (fitting.some((m) => m.id === current) ? current : (fitting[0]?.id ?? "")));
      })
      .catch((e) => live && setError(getApiErrorMessage(e, "The media and the size of the package could not be read.")));
    return () => {
      live = false;
    };
  }, [isOpen, backupNumber]);

  const fits = (medium: OfflineMedium) => estimate === undefined || medium.capacityBytes >= estimate * 1.1;
  const usable = (media ?? []).filter(fits);
  const valid = !!mediaId && usable.some((m) => m.id === mediaId) && reason.trim().length > 0 && reason.length <= MAX_REASON;

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title="Export Backup Set"
      description={`Write ${backupNumber}, with every stored document it depends on, to an offline medium. Another person must approve before anything is written.`}
      confirmText={busy ? "Requesting…" : "Request Export"}
      confirmDisabled={!valid || busy}
      onConfirm={() => {
        onConfirm(mediaId, reason.trim());
        setReason("");
      }}
    >
      <div className="space-y-4">
        {error && <WarningBanner variant="error" description={error} />}
        {media && media.length === 0 && (
          <WarningBanner variant="warning" title="No medium is available" description="Register an empty medium in Backup Storage & Encryption first. Only a registered, empty medium can receive a package." />
        )}
        {media && media.length > 0 && usable.length === 0 && <WarningBanner variant="warning" description="No available medium is big enough for this package." />}
        <FormField label="Medium" required hint={estimate === undefined ? undefined : `The package is about ${formatBytes(estimate)}. Media that are too small are not offered.`}>
          <Select value={mediaId} onChange={setMediaId} options={usable.map((m) => ({ label: `${m.label} (${formatBytes(m.capacityBytes)})`, value: m.id }))} placeholder="Choose a medium" />
        </FormField>
        <FormField label="Reason" required hint="For example: weekly off-site copy.">
          <Textarea rows={3} value={reason} maxLength={MAX_REASON} onChange={(event) => setReason(event.target.value)} />
        </FormField>
      </div>
    </FormModal>
  );
};
