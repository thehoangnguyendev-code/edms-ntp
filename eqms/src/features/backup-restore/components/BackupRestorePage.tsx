import React from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { backupRestore } from "@/components/ui/breadcrumb/breadcrumbs/core";
import { PreviewBanner } from "./PreviewBanner";

/** Shared frame of every Backup & Restore screen: header, breadcrumb and the preview notice. */
export const BackupRestorePage: React.FC<{
  title: string;
  parent?: { label: string; path: string };
  /** The menu group the screen belongs to; shown in the breadcrumb. */
  group?: "Backup" | "Restore";
  /** False once a screen reads real data from the Backup Agent; the sample-data notice is then wrong and is not shown. */
  preview?: boolean;
  actions?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, parent, group, preview = true, actions, children }) => {
  const navigate = useNavigate();
  return (
    <div className="flex w-full min-w-0 flex-1 flex-col gap-4 md:gap-6">
      <PageHeader title={title} breadcrumbItems={backupRestore(navigate, title, parent, group)} actions={actions} />
      {preview && <PreviewBanner />}
      {children}
    </div>
  );
};
