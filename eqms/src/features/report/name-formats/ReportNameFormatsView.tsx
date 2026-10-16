import React from "react";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { usePermissions } from "@/hooks/usePermissions";
import { reportBreadcrumbs } from "../shared/reportBreadcrumbs";
import { ReportNameFormatsTab } from "./ReportNameFormatsTab";

/**
 * Report Name Formats administration (REPORT-NAME-FORMAT-2026-10-14): the rules that give report templates their names. Laid out like the Document
 * Name Formats screen; New and Edit open the dedicated page.
 */
export const ReportNameFormatsView: React.FC = () => {
  const navigate = useNavigate();
  const { hasAnyPermission } = usePermissions();
  const canManage = hasAnyPermission(["reports.name_format.manage"]);

  return (
    <div className="h-full flex flex-col gap-6">
      <PageHeader
        title="Report Name Formats"
        breadcrumbItems={reportBreadcrumbs(navigate, "Report Name Formats", true)}
        actions={
          canManage ? (
            <Button size="sm" onClick={() => navigate("/settings/report-name-formats/new")} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4" />
              New Report Name Format
            </Button>
          ) : undefined
        }
      />

      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex-1 overflow-auto p-4 md:p-5">
            <ReportNameFormatsTab />
          </div>
        </div>
      </div>
    </div>
  );
};
