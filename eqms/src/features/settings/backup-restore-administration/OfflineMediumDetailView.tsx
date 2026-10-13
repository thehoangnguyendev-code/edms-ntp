import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Info, Package } from "lucide-react";
import { IconHistory } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { FormSection } from "@/components/ui/form";
import { FormField, Input, Textarea } from "@/components/ui/form/ResponsiveForm";
import { FormModal } from "@/components/ui/modal/FormModal";
import { Select } from "@/components/ui/select/Select";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { DataTable } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast/Toast";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { ROUTES } from "@/app/routes.constants";
import { formatBytes, formatDate, formatDateTime } from "@/features/backup-restore/format";
import { statusLabel } from "@/features/backup-restore/types";
import { backupRestoreApi, type MediaEvent, type MediaPackage, type OfflineMedium } from "@/services/api/backupRestore";
import { getApiErrorMessage } from "@/utils/apiError";
import { BackupAdminLivePage } from "./BackupAdminLivePage";
import { MEDIA_EVENT_LABEL, MEDIA_KIND_LABEL, MEDIA_STATUS_COLOR, MEDIA_STATUS_HINT, exportErrorMessage } from "./mediaLabels";

type Step = "handover" | "readTest" | "recycle" | "retire";

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex flex-col gap-1.5 border-b border-slate-200 pb-3 last:border-b-0 last:pb-0 lg:flex-row lg:items-center lg:gap-2 lg:pb-4 last:lg:pb-0">
    <label className="w-full flex-shrink-0 text-xs font-medium text-slate-700 sm:text-sm lg:w-40">{label}</label>
    <div className="min-w-0 flex-1 break-words text-xs text-slate-900 lg:text-sm">{children}</div>
  </div>
);

const describe = (event: MediaEvent): string => {
  let detail: Record<string, unknown> = {};
  try {
    detail = event.detail ? JSON.parse(event.detail) : {};
  } catch {
    detail = {};
  }
  switch (event.event) {
    case "REGISTERED":
      return `${detail.kind ?? ""}, serial ${detail.serial ?? ""}`;
    case "EXPORTED":
      return `Package ${detail.exportId ?? ""} written and read back`;
    case "HANDED_OVER":
      return `To ${detail.holder ?? ""}, ${detail.location ?? ""}`;
    case "RECEIVED":
      return `Held by ${detail.holder ?? ""}, ${detail.location ?? ""}; delivered by ${detail.deliveredBy ?? ""}`;
    case "READ_TESTED":
      return `${statusLabel(String(detail.result ?? ""))}: ${detail.detail ?? ""}`;
    case "RECYCLED":
      return String(detail.reason ?? "");
    case "RETIRED":
      return String(detail.destructionRecord ?? "");
    default:
      return "";
  }
};

/** One offline medium: what it is, what it holds, where it is and everything that has happened to it. */
export const OfflineMediumDetailView: React.FC = () => {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("backup.media.manage");

  const [medium, setMedium] = useState<OfflineMedium>();
  const [packages, setPackages] = useState<MediaPackage[]>([]);
  const [events, setEvents] = useState<MediaEvent[]>([]);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [step, setStep] = useState<Step | null>(null);
  const [busy, setBusy] = useState(false);
  const [holder, setHolder] = useState("");
  const [location, setLocation] = useState("");
  const [result, setResult] = useState<"PASSED" | "FAILED">("PASSED");
  const [detail, setDetail] = useState("");
  const [wiped, setWiped] = useState(false);
  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let live = true;
    setError("");
    Promise.all([backupRestoreApi.medium(id), backupRestoreApi.mediumPackages(id), backupRestoreApi.mediumEvents(id)])
      .then(([m, p, e]) => {
        if (!live) return;
        setMedium(m);
        setPackages(p);
        setEvents(e);
      })
      .catch((e) => live && setError(getApiErrorMessage(e, "The medium could not be read.")));
    return () => {
      live = false;
    };
  }, [id, reloadKey]);

  const parent = { label: "Backup Storage & Encryption", path: ROUTES.SETTINGS.BACKUP_ADMINISTRATION.STORAGE };
  const back = () => navigate(parent.path);

  if (error) {
    return (
      <BackupAdminLivePage title="Offline Medium" parent={parent}>
        <WarningBanner variant="error" title="Unable to open the medium" description={error} />
        <div>
          <Button size="sm" variant="outline-emerald" onClick={back}>
            Back to Storage & Encryption
          </Button>
        </div>
      </BackupAdminLivePage>
    );
  }
  if (!medium) {
    return (
      <BackupAdminLivePage title="Offline Medium" parent={parent}>
        <SectionLoading minHeight="40vh" />
      </BackupAdminLivePage>
    );
  }

  const lastMovement = events.find((e) => e.event === "HANDED_OVER" || e.event === "EXPORTED");
  const handedOver = lastMovement?.event === "HANDED_OVER";
  const deliveredByMe = handedOver && !!user?.username && lastMovement!.by.toLowerCase() === user.username.toLowerCase();
  const holdsPackages = ["IN_TRANSIT", "STORED_OFFSITE", "QUARANTINED"].includes(medium.status);

  const run = async (action: () => Promise<unknown>, title: string) => {
    setBusy(true);
    try {
      await action();
      showToast({ type: "success", title, message: medium.label });
      setStep(null);
      setHolder("");
      setLocation("");
      setDetail("");
      setWiped(false);
    } catch (e) {
      showToast({ type: "error", title: "Not done", message: exportErrorMessage(e, "The request was refused.") });
    } finally {
      setBusy(false);
      reload();
    }
  };

  const actions = (
    <>
      <Button variant="outline-emerald" size="sm" onClick={back} className="whitespace-nowrap touch-manipulation">
        Back
      </Button>
      {canManage && medium.status === "IN_TRANSIT" && (
        <Button variant="outline-emerald" size="sm" disabled={busy} onClick={() => setStep("handover")} className="whitespace-nowrap touch-manipulation">
          Record Handover
        </Button>
      )}
      {canManage && medium.status === "IN_TRANSIT" && (
        <Button size="sm" disabled={busy || !handedOver || deliveredByMe} title={deliveredByMe ? "You handed this medium over, so someone else has to confirm receiving it." : undefined} onClick={() => void run(() => backupRestoreApi.receiveMedium(id), "Receipt confirmed")} className="whitespace-nowrap touch-manipulation">
          Confirm Receipt
        </Button>
      )}
      {canManage && holdsPackages && medium.status !== "RETIRED" && (
        <Button variant="outline-emerald" size="sm" disabled={busy} onClick={() => setStep("readTest")} className="whitespace-nowrap touch-manipulation">
          Record Read Test
        </Button>
      )}
      {canManage && ["STORED_OFFSITE", "QUARANTINED"].includes(medium.status) && (
        <Button variant="outline-emerald" size="sm" disabled={busy} onClick={() => setStep("recycle")} className="whitespace-nowrap touch-manipulation">
          Wipe and Reuse
        </Button>
      )}
      {canManage && medium.status !== "RETIRED" && medium.status !== "IN_TRANSIT" && (
        <Button variant="outline-emerald" size="sm" disabled={busy} onClick={() => setStep("retire")} className="whitespace-nowrap touch-manipulation">
          Retire Medium
        </Button>
      )}
    </>
  );

  return (
    <BackupAdminLivePage title={`Offline Medium ${medium.label}`} parent={parent} actions={actions}>
      {medium.status === "QUARANTINED" && <WarningBanner variant="error" title="This medium failed a read test" description="Do not rely on it. The packages it held must be exported again to another medium." />}
      {medium.status === "IN_TRANSIT" && (
        <WarningBanner variant="info" title="Waiting to reach its place" description={handedOver ? "The handover is recorded. A different person must confirm receiving the medium." : "The deliverer records who will hold the medium and where; a different person then confirms receiving it."} />
      )}
      {medium.holdsLegalHold && <WarningBanner variant="warning" title="Holds data under legal hold" description="It cannot be wiped, reused or destroyed until the hold is released." />}

      <FormSection title="Medium Information" icon={<Info className="h-4 w-4" />}>
        <div className="grid grid-cols-1 gap-x-10 gap-y-3 lg:gap-y-4 xl:grid-cols-2">
          <div className="space-y-3 lg:space-y-4">
            <Field label="Label">
              <span className="font-medium">{medium.label}</span>
            </Field>
            <Field label="Status">
              <span className="inline-flex flex-col gap-1">
                <Badge color={MEDIA_STATUS_COLOR[medium.status]}>{statusLabel(medium.status)}</Badge>
                <span className="text-2xs text-slate-500">{MEDIA_STATUS_HINT[medium.status]}</span>
              </span>
            </Field>
            <Field label="Kind">{MEDIA_KIND_LABEL[medium.kind] ?? medium.kind}</Field>
            <Field label="Serial number">{medium.serialNumber}</Field>
            <Field label="Capacity">{formatBytes(medium.capacityBytes)}</Field>
          </div>
          <div className="space-y-3 lg:space-y-4">
            <Field label="Held by">{medium.holder ?? "—"}</Field>
            <Field label="Kept at">{medium.storageLocation ?? "—"}</Field>
            <Field label="Last read test">
              {medium.lastReadTestAt ? `${statusLabel(medium.lastReadTestResult ?? "")}, ${formatDateTime(medium.lastReadTestAt)}` : "Never"}
            </Field>
            <Field label="Expires">{formatDate(medium.expiresOn)}</Field>
            <Field label="Registered by">{medium.registeredBy}</Field>
            {medium.destructionRecord && <Field label="Destruction record">{medium.destructionRecord}</Field>}
          </div>
        </div>
      </FormSection>

      <FormSection title="Packages on This Medium" icon={<Package className="h-4 w-4" />} description="Backups written to this medium since it was last wiped.">
        <DataTable
          rows={packages}
          getRowKey={(row) => row.exportId}
          columns={[
            { id: "export", header: "Export", cell: (row) => <span className="font-medium">{row.exportId}</span> },
            { id: "backup", header: "Backup", cell: (row) => row.backupId },
            { id: "at", header: "Written", cell: (row) => formatDateTime(row.finishedAt) },
            { id: "size", header: "Size", cell: (row) => formatBytes(row.sizeBytes) },
            { id: "receipt", header: "Receipt SHA-256", cell: (row) => <span className="break-all font-mono text-2xs text-slate-500">{row.receiptSha256 ?? "—"}</span> },
          ]}
        />
      </FormSection>

      <FormSection title="History" icon={<IconHistory className="h-4 w-4" />} description="Every step is kept; nothing is edited or removed.">
        <DataTable
          rows={events}
          getRowKey={(row) => `${row.at}-${row.event}`}
          columns={[
            { id: "at", header: "When", cell: (row) => formatDateTime(row.at) },
            { id: "event", header: "Step", cell: (row) => MEDIA_EVENT_LABEL[row.event] ?? statusLabel(row.event) },
            { id: "by", header: "By", cell: (row) => row.by },
            { id: "detail", header: "Detail", cell: (row) => <span className="block max-w-xl whitespace-normal text-slate-600">{describe(row)}</span> },
          ]}
        />
      </FormSection>

      <div className="flex items-center gap-3">{actions}</div>

      <FormModal
        isOpen={step === "handover"}
        onClose={() => setStep(null)}
        title="Record Handover"
        description="Who will hold the medium and where it will be kept. A different person then confirms receiving it."
        confirmText="Record"
        confirmDisabled={!holder.trim() || !location.trim() || busy}
        onConfirm={() => void run(() => backupRestoreApi.handoverMedium(id, holder.trim(), location.trim()), "Handover recorded")}
      >
        <div className="space-y-4">
          <FormField label="Held by" required>
            <Input value={holder} maxLength={120} onChange={(event) => setHolder(event.target.value)} />
          </FormField>
          <FormField label="Kept at" required>
            <Input value={location} maxLength={200} onChange={(event) => setLocation(event.target.value)} />
          </FormField>
        </div>
      </FormModal>

      <FormModal
        isOpen={step === "readTest"}
        onClose={() => setStep(null)}
        title="Record Read Test"
        description="Say what was checked. A failed test quarantines the medium."
        confirmText="Record"
        confirmDisabled={!detail.trim() || busy}
        onConfirm={() => void run(() => backupRestoreApi.readTestMedium(id, result, detail.trim()), "Read test recorded")}
      >
        <div className="space-y-4">
          <FormField label="Result">
            <Select value={result} onChange={(value) => setResult(value as "PASSED" | "FAILED")} options={[{ label: "Passed", value: "PASSED" }, { label: "Failed", value: "FAILED" }]} />
          </FormField>
          <FormField label="What was checked" required hint="For example: brought back, verify-chain.sh run, database decrypted for the check.">
            <Textarea rows={3} value={detail} maxLength={500} onChange={(event) => setDetail(event.target.value)} />
          </FormField>
        </div>
      </FormModal>

      <FormModal
        isOpen={step === "recycle"}
        onClose={() => setStep(null)}
        title="Wipe and Reuse"
        description="The packages on this medium stop counting. Wipe the medium securely first."
        confirmText="Return to Use"
        confirmDisabled={!wiped || !detail.trim() || busy}
        onConfirm={() => void run(() => backupRestoreApi.recycleMedium(id, wiped, detail.trim()), "Medium returned to use")}
      >
        <div className="space-y-4">
          <label className="flex items-start gap-2 text-xs text-slate-700 sm:text-sm">
            <input type="checkbox" className="mt-0.5" checked={wiped} onChange={(event) => setWiped(event.target.checked)} />I confirm the medium was securely wiped.
          </label>
          <FormField label="Reason" required>
            <Textarea rows={3} value={detail} maxLength={500} onChange={(event) => setDetail(event.target.value)} />
          </FormField>
        </div>
      </FormModal>

      <FormModal
        isOpen={step === "retire"}
        onClose={() => setStep(null)}
        title="Retire Medium"
        description="A retired medium can never be used again. Record how it was destroyed."
        confirmText="Retire"
        confirmDisabled={!detail.trim() || busy}
        onConfirm={() => void run(() => backupRestoreApi.retireMedium(id, detail.trim()), "Medium retired")}
      >
        <FormField label="Destruction record" required hint="Method, date, who did it and the certificate number.">
          <Textarea rows={3} value={detail} maxLength={1000} onChange={(event) => setDetail(event.target.value)} />
        </FormField>
      </FormModal>
    </BackupAdminLivePage>
  );
};
