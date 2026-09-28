import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { backupRestore as backupRestoreBreadcrumbs } from "@/components/ui/breadcrumb/breadcrumbs/core";
import { ComingSoonView } from "@/features/settings/document-administration/ComingSoonView";
import { useNavigateWithLoading } from "@/hooks/useNavigateWithLoading";
import { backupRestoreApi, type BackupRestoreStatus } from "@/services/api/backupRestore";

/** Backup & Restore entry page. The feature is developed later; the server reports whether it is available yet. */
export const BackupRestoreView: React.FC = () => {
  const { navigateTo } = useNavigateWithLoading();
  const breadcrumbItems = useMemo(() => backupRestoreBreadcrumbs(navigateTo), [navigateTo]);
  const [status, setStatus] = useState<BackupRestoreStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(false);
    backupRestoreApi
      .getStatus()
      .then((data) => { if (alive) setStatus(data); })
      .catch(() => { if (alive) setError(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => {
      alive = false;
    };
  }, [attempt]);

  if (loading) {
    return (
      <div className="space-y-4 md:space-y-6 w-full flex-1 flex flex-col">
        <PageHeader title="Backup & Restore" breadcrumbItems={breadcrumbItems} />
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <SectionLoading text="Loading..." />
        </div>
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className="space-y-4 md:space-y-6 w-full flex-1 flex flex-col">
        <PageHeader title="Backup & Restore" breadcrumbItems={breadcrumbItems} />
        <div className="flex flex-col items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-8 text-center">
          <p className="text-sm font-medium text-amber-800">Unable to load Backup & Restore.</p>
          <Button size="sm" variant="outline" onClick={() => setAttempt((n) => n + 1)}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Only the "not available yet" state exists for now; the real screens replace this once the feature is built.
  return (
    <ComingSoonView
      title="Backup & Restore"
      breadcrumbItems={breadcrumbItems}
      description={status.message}
    />
  );
};
