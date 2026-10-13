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
import { MediaRegisterPanel } from "./MediaRegisterPanel";
import { MEDIUM_LABEL } from "./policyLabels";

const STEP_LABEL: Record<string, string> = {
  write: "Wrote a test file",
  "read-back": "Read it back, same bytes",
  cleanup: "Removed the test file",
  "delete-refused": "Delete was refused (immutable)",
};

const TABS: TabItem[] = [
  { id: "targets", label: "Targets" },
  { id: "encryption", label: "Encryption" },
  { id: "media", label: "Offline Media" },
];

/** The result of a test run from this page: passed, or failed at the first step that did not work. */
const TestResult: React.FC<{ result: TargetTestResult }> = ({ result }) => {
  const failed = result.steps.find((step) => !step.ok);
  return (
    <span className="inline-flex flex-col gap-0.5">
      <Badge color={result.ok ? "emerald" : "red"}>{result.ok ? "Passed" : "Failed"}</Badge>
      {failed && <span className="text-2xs text-slate-500">Failed at: {STEP_LABEL[failed.name] ?? failed.name}</span>}
    </span>
  );
};

/** A part of a tab: its content, with no heading of its own. The tab names what it holds. */
const Part: React.FC<{ children: React.ReactNode }> = ({ children }) => <div className="space-y-3">{children}</div>;

/**
 * Backup Storage & Encryption: where backups are copied to and a test that proves each copy works, how they are protected, and the
 * offline media that a backup package can be written to. One tab for each part. Targets and encryption are read from the Backup Agent;
 * nothing here shows a key or a credential. Export requests are not here: they are in Backup > Export Requests.
 */
export const BackupStorageView: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();
  const { hasPermission } = usePermissions();
  const canTest = hasPermission("backup.admin.storage.test");
  const canManage = hasPermission("backup.media.manage");

  const [targets, setTargets] = useState<BackupTargetInfo[] | undefined>();
  const [targetsError, setTargetsError] = useState("");
  const [encryption, setEncryption] = useState<EncryptionFacts | undefined>();
  const [encryptionError, setEncryptionError] = useState("");
  const [results, setResults] = useState<Record<string, TargetTestResult>>({});
  const [testing, setTesting] = useState("");
  const [registering, setRegistering] = useState(false);

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
      {targetsError && <WarningBanner variant="error" title="The backup targets could not be read" description={targetsError} />}
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
            { id: "immutable", header: "Cannot be deleted", cell: (row) => (row.immutable ? <Badge color="emerald">Yes</Badge> : "No") },
            {
              id: "test",
              header: "Last test",
              cell: (row) => (results[row.code] ? <TestResult result={results[row.code]} /> : <span className="text-slate-400">Not tested on this page</span>),
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
        {encryptionError && <WarningBanner variant="error" title="The encryption details could not be read" description={encryptionError} />}
        {encryption === undefined && !encryptionError ? (
          <SectionLoading minHeight="80px" />
        ) : (
          encryption && (
            <div className="space-y-3">
              {!encryption.available && <WarningBanner variant="error" title="No encryption key is available" description={`Backups cannot be written. ${encryption.problem ?? ""}`} />}
              <Fact label="Are backups encrypted?">Yes, {encryption.scheme} with {encryption.cipher}.</Fact>
              <Fact label="Are backups signed?">Yes, with {encryption.signingAlgorithm}.</Fact>
              <Fact label="Can this system read backups?">
                {encryption.agentCanDecrypt ? (
                  <Badge color="red">Yes</Badge>
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
            Technical details <span className="text-xs font-normal text-slate-500">· key identifiers, for an auditor or a support engineer</span>
          </summary>
          <div className="mt-3 space-y-3">
            <Fact label="Recipient key">{encryption.recipientKeyId ? <span className="font-mono text-xs">{encryption.recipientKeyId}</span> : "—"}</Fact>
            <Fact label="Recipient fingerprint">
              {encryption.fingerprint ? <span className="break-all font-mono text-xs font-normal text-slate-500">{encryption.fingerprint}</span> : "—"}
            </Fact>
            <Fact label="Signing key">
              <span className="font-mono text-xs">{encryption.signingKeyId}</span>
            </Fact>
          </div>
        </details>
      )}
    </>
  );

  const mediaTab = <MediaRegisterPanel registering={registering} onRegisterClose={() => setRegistering(false)} />;

  const content = active === "encryption" ? encryptionTab : active === "media" ? mediaTab : targetsTab;

  // The Register Medium action sits in the page header, on the same row as the title, as on the other screens.
  const headerActions =
    active === "media" && canManage ? (
      <Button size="sm" variant="default" onClick={() => setRegistering(true)} className="whitespace-nowrap">
        Register Medium
      </Button>
    ) : undefined;

  return (
    <BackupAdminLivePage title="Backup Storage & Encryption" actions={headerActions}>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <TabNav tabs={TABS} activeTab={active} onChange={(id) => setSearchParams({ tab: id }, { replace: true })} layoutId="backup-storage-tab" ariaLabel="Backup storage" />
        <div className="p-4 md:p-5 space-y-6">{content}</div>
      </div>
    </BackupAdminLivePage>
  );
};
