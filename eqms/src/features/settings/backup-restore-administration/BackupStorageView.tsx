import { tr as __ariaTr } from "@/i18n";
import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { HardDrive, KeyRound } from "lucide-react";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { DataTable } from "@/components/ui/table";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import { useToast } from "@/components/ui/toast/Toast";
import { usePermissions } from "@/hooks/usePermissions";
import { Fact } from "@/features/backup-restore/components/Fact";
import { backupRestoreApi, type BackupTargetInfo, type EncryptionFacts, type TargetTestResult } from "@/services/api/backupRestore";
import { getApiErrorMessage } from "@/utils/apiError";
import { BackupAdminLivePage } from "./BackupAdminLivePage";
import { ManualCopyPanel } from "./ManualCopyPanel";
import { MEDIUM_LABEL } from "./policyLabels";
import { tr, trFormat } from "@/i18n";

const STEP_LABEL: Record<string, string> = {
  write: "Wrote a test file",
  "read-back": "Read it back, same bytes",
  cleanup: "Removed the test file",
  "delete-refused": "Delete was refused (immutable)",
};

const TABS: TabItem[] = [
  { id: "targets", label: "Targets" },
  { id: "manual-copy", label: tr("Manual Copy") },
  { id: "encryption", label: tr("Encryption") },
];

/** The result of a test run from this page: passed, or failed at the first step that did not work. */
const TestResult: React.FC<{ result: TargetTestResult }> = ({ result }) => {
  const failed = result.steps.find((step) => !step.ok);
  return (
    <span className="inline-flex flex-col gap-0.5">
      <Badge color={result.ok ? "emerald" : "red"}>{result.ok ? tr("Passed") : tr("Failed")}</Badge>
      {failed && <span className="text-2xs text-slate-500">{trFormat("Failed at: {step}", { step: STEP_LABEL[failed.name] ?? failed.name })}</span>}
    </span>
  );
};

/** A part of a tab: its content, with no heading of its own. The tab names what it holds. */
const Part: React.FC<{ children: React.ReactNode }> = ({ children }) => <div className="space-y-3">{children}</div>;

/**
 * Backup Storage & Encryption: where backups are copied to and a test that proves each copy works, how they are protected, and the
 * how they are protected. One tab for each part. Targets and encryption are read from the Backup Agent;
 * nothing here shows a key or a credential.
 */
export const BackupStorageView: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();
  const { hasPermission } = usePermissions();
  const canTest = hasPermission("backup.admin.storage.test");

  const [targets, setTargets] = useState<BackupTargetInfo[] | undefined>();
  const [targetsError, setTargetsError] = useState("");
  const [encryption, setEncryption] = useState<EncryptionFacts | undefined>();
  const [encryptionError, setEncryptionError] = useState("");
  const [results, setResults] = useState<Record<string, TargetTestResult>>({});
  const [testing, setTesting] = useState("");

  const requested = searchParams.get("tab");
  const active = TABS.find((tab) => tab.id === requested)?.id ?? "targets";

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

  const targetsTab = (
    <Part>
      {targetsError && <WarningBanner variant="error" title={tr("The backup targets could not be read")} description={targetsError} />}
      {targets === undefined ? (
        <SectionLoading minHeight="80px" />
      ) : (
        <DataTable
          rows={targets}
          getRowKey={(row) => row.code}
          columns={[
            { id: "code", header: "Target", cell: (row) => <span className="font-medium">{row.code}</span> },
            { id: "kind", header: "Kind", cell: (row) => (row.kind === "S3" ? MEDIUM_LABEL.OBJECT_STORAGE : "Folder") },
            { id: "location", header: "Location", cell: (row) => <span className="break-all font-mono text-xs">{row.location}</span> },
            { id: "immutable", header: tr("Cannot be deleted"), cell: (row) => (row.immutable ? <Badge color="emerald">{tr("Yes")}</Badge> : "No") },
            {
              id: "test",
              header: "Last test",
              cell: (row) => (results[row.code] ? <TestResult result={results[row.code]} /> : <span className="text-slate-400">{tr("Not tested on this page")}</span>),
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
    </Part>
  );

  const encryptionTab = (
    <>
      <Part>
        {encryptionError && <WarningBanner variant="error" title={tr("The encryption details could not be read")} description={encryptionError} />}
        {encryption === undefined && !encryptionError ? (
          <SectionLoading minHeight="80px" />
        ) : (
          encryption && (
            <div className="space-y-3">
              {!encryption.available && <WarningBanner variant="error" title={tr("No encryption key is available")} description={trFormat("Backups cannot be written. {problem}", { problem: encryption.problem ?? "" })} />}
              <Fact label={tr("Are backups encrypted?")}>{trFormat("Yes, {scheme} with {cipher}.", { scheme: encryption.scheme, cipher: encryption.cipher })}</Fact>
              <Fact label={tr("Are backups signed?")}>{trFormat("Yes, with {algorithm}.", { algorithm: encryption.signingAlgorithm })}</Fact>
              <Fact label={tr("Can this system read backups?")}>
                {encryption.agentCanDecrypt ? (
                  <Badge color="red">{tr("Yes")}</Badge>
                ) : (
                  "No. The Backup Agent holds only the public key. The private key is used only by the restore worker, and only for an approved restore."
                )}
              </Fact>
            </div>
          )
        )}
      </Part>

      {encryption && (
        <details className="group">
          <summary className="cursor-pointer select-none text-sm font-medium text-slate-700 hover:text-emerald-700">
              {tr("Technical details")} <span className="text-xs font-normal text-slate-500">· {tr("key identifiers, for an auditor or a support engineer")}</span>
          </summary>
          <div className="mt-3 space-y-3">
            <Fact label={tr("Recipient key")}>{encryption.recipientKeyId ? <span className="font-mono text-xs">{encryption.recipientKeyId}</span> : "—"}</Fact>
            <Fact label={tr("Recipient fingerprint")}>
              {encryption.fingerprint ? <span className="break-all font-mono text-xs font-normal text-slate-500">{encryption.fingerprint}</span> : "—"}
            </Fact>
            <Fact label={tr("Signing key")}>
              <span className="font-mono text-xs">{encryption.signingKeyId}</span>
            </Fact>
          </div>
        </details>
      )}
    </>
  );

  const content = active === "encryption" ? encryptionTab : active === "manual-copy" ? <ManualCopyPanel /> : targetsTab;

  return (
    <BackupAdminLivePage title={tr("Backup Storage & Encryption")}>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <TabNav tabs={TABS} activeTab={active} onChange={(id) => setSearchParams({ tab: id }, { replace: true })} layoutId="backup-storage-tab" ariaLabel={__ariaTr("Backup storage")} />
        <div className="p-4 md:p-5 space-y-6">{content}</div>
      </div>
    </BackupAdminLivePage>
  );
};
