import React from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { backupRestoreAdministration } from "@/components/ui/breadcrumb/breadcrumbs/settings";

/** Frame of a Backup & Restore Administration screen that reads and changes real data: no sample-data notice, no Save Changes. */
export const BackupAdminLivePage: React.FC<{
  title: string;
  parent?: { label: string; path: string };
  actions?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, parent, actions, children }) => {
  const navigate = useNavigate();
  return (
    <div className="flex w-full min-w-0 flex-1 flex-col gap-4 md:gap-6">
      <PageHeader title={title} breadcrumbItems={backupRestoreAdministration(navigate, title, parent)} actions={actions} />
      {children}
    </div>
  );
};
