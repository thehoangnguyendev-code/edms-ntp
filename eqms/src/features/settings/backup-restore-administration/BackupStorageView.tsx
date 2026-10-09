import React, { useCallback, useEffect, useState } from "react";
import { HardDrive, KeyRound } from "lucide-react";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { FormSection } from "@/components/ui/form";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { DataTable } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast/Toast";
import { usePermissions } from "@/hooks/usePermissions";
import { backupRestoreApi, type BackupTargetInfo, type EncryptionFacts, type TargetTestResult } from "@/services/api/backupRestore";
import { getApiErrorMessage } from "@/utils/apiError";
import { BackupAdminLivePage } from "./BackupAdminLivePage";
import { ExportRequestsPanel } from "./ExportRequestsPanel";
import { MediaRegisterPanel } from "./MediaRegisterPanel";
import { MEDIUM_LABEL } from "./policyLabels";

const STEP_LABEL: Record<string, string> = {
  write: "Wrote a test file",
  "read-back": "Read it back, same bytes",
  cleanup: "Removed the test file",
  "delete-refused": "Delete was refused (immutable)",
};

const Fact: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex flex-col gap-1.5 border-b border-slate-200 pb-3 last:border-b-0 last:pb-0 lg:flex-row lg:items-center lg:gap-2">
    <label className="w-full flex-shrink-0 text-xs font-medium text-slate-700 sm:text-sm lg:w-44">{label}</label>
    <div className="min-w-0 flex-1 break-words text-xs text-slate-900 lg:text-sm">{children}</div>
  </div>
);

/**
 * Backup Storage & Encryption: where backups are copied to (and a test that proves each place works), what protects them, the
 * offline media register and the requests to export a backup to one of those media. Targets and encryption are read from the
 * Backup Agent; nothing here shows a key or a credential.
 */
export const BackupStorageView: React.FC = () => {
  const { showToast } = useToast();
  const { hasPermission } = usePermissions();
  const canTest = hasPermission("backup.admin.storage.test");

  const [targets, setTargets] = useState<BackupTargetInfo[] | undefined>();
  const [targetsError, setTargetsError] = useState("");
  const [encryption, setEncryption] = useState<EncryptionFacts | undefined>();
  const [encryptionError, setEncryptionError] = useState("");
  const [results, setResults] = useState<Record<string, TargetTestResult>>({});
  const [testing, setTesting] = useState("");

  useEffect(() => {
    let live = true;
    backupRestoreApi.targets().then((data) => live && setTargets(data)).catch((e) => {
      if (!live) return;
      setTargets([]);
      setTargetsError(getApiErrorMessage(e, "The backup targets could not be read."));
    });
    backupRestoreApi.encryption().then((data) => live && setEncryption(data)).catch((e) => live && setEncryptionError(getApiErrorMessage(e, "The encryption details could not be read.")));
    return () => {
      live = false;
    };
  }, []);

  const test = useCallback(
    async (code: string) => {
      setTesting(code);
      try {
        const result = await backupRestoreApi.testTarget(code);
        setResults((prev) => ({ ...prev, [code]: result }));
        showToast({ type: result.ok ? "success" : "error", title: result.ok ? `${code} passed its test` : `${code} failed its test`, message: result.steps.filter((s) => !s.ok).map((s) => STEP_LABEL[s.name] ?? s.name).join(", ") || "Every step worked." });
      } catch (e) {
        showToast({ type: "error", title: `${code} could not be tested`, message: getApiErrorMessage(e, "The request was refused.") });
      } finally {
        setTesting("");
      }
    },
    [showToast],
  );

  return (
    <BackupAdminLivePage title="Backup Storage & Encryption">
      {targetsError && <WarningBanner variant="error" title="The backup targets could not be read" description={targetsError} />}
      <FormSection
        title="Backup Targets"
        icon={<HardDrive className="h-4 w-4" />}
        description="Where each backup is copied. Which of them the backups use is decided by the running Backup Policy. Credentials are held by the Backup Agent and are never displayed."
      >
        {targets === undefined ? (
          <SectionLoading minHeight="80px" />
        ) : (
          <DataTable
            rows={targets}
            getRowKey={(row) => row.code}
            columns={[
              { id: "code", header: "Target", cell: (row) => <span className="font-medium">{row.code}</span> },
              { id: "kind", header: "Type", cell: (row) => (row.kind === "S3" ? MEDIUM_LABEL.OBJECT_STORAGE : "Folder") },
              { id: "location", header: "Location", cell: (row) => <span className="break-all font-mono text-xs">{row.location}</span> },
              { id: "immutable", header: "Locked against deletion", cell: (row) => (row.immutable ? <Badge color="emerald">Immutable</Badge> : "No") },
              {
                id: "test",
                header: "Last test in this session",
                cell: (row) => {
                  const result = results[row.code];
                  if (!result) return <span className="text-slate-400">Not tested here</span>;
                  return (
                    <span className="inline-flex flex-col gap-1">
                      <Badge color={result.ok ? "emerald" : "red"}>{result.ok ? "Passed" : "Failed"}</Badge>
                      <span className="text-2xs text-slate-500">{result.steps.map((s) => `${s.ok ? "✓" : "✗"} ${STEP_LABEL[s.name] ?? s.name}`).join(" · ")}</span>
                    </span>
                  );
                },
              },
            ]}
            action={
              canTest
                ? {
                    cell: (row) => (
                      <Button size="sm" variant="outline" disabled={!!testing} onClick={() => void test(row.code)}>
                        {testing === row.code ? "Testing…" : "Test"}
                      </Button>
                    ),
                  }
                : undefined
            }
          />
        )}
      </FormSection>

      <FormSection title="Encryption" icon={<KeyRound className="h-4 w-4" />} description="Every backup is encrypted before it is written and signed afterwards. Encryption cannot be switched off.">
        {encryptionError && <WarningBanner variant="error" title="The encryption details could not be read" description={encryptionError} />}
        {encryption === undefined && !encryptionError ? (
          <SectionLoading minHeight="80px" />
        ) : (
          encryption && (
            <div className="space-y-3 lg:space-y-4">
              {!encryption.available && <WarningBanner variant="error" title="No encryption key is available" description={`Backups cannot be written. ${encryption.problem ?? ""}`} />}
              <Fact label="Encryption">{encryption.scheme} with {encryption.cipher}</Fact>
              <Fact label="Recipient key">
                {encryption.recipientKeyId ? <span className="font-mono text-xs">{encryption.recipientKeyId}</span> : "—"}
                {encryption.fingerprint && <span className="mt-1 block break-all font-mono text-2xs text-slate-500">{encryption.fingerprint}</span>}
              </Fact>
              <Fact label="Signing">{encryption.signingAlgorithm}, key <span className="font-mono text-xs">{encryption.signingKeyId}</span></Fact>
              <Fact label="Can the system decrypt?">{encryption.agentCanDecrypt ? <Badge color="red">Yes</Badge> : "No. The Backup Agent holds only the public key; the private key is kept by the key holders."}</Fact>
              <WarningBanner variant="info" title="Key holders are not set up yet" description="Naming the key holders and requiring two of them to decrypt is part of the restore work that has not been built. Until then the private key is held outside the system by whoever installed it." />
            </div>
          )
        )}
      </FormSection>

      <MediaRegisterPanel />
      <ExportRequestsPanel />
    </BackupAdminLivePage>
  );
};
