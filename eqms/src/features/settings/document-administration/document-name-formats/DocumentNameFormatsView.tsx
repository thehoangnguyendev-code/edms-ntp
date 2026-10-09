import React from "react";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { documentNameFormats } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { usePermissions } from "@/hooks/usePermissions";
import { ROUTES } from "@/app/routes.constants";
import { DocumentNameFormatsTab } from "./DocumentNameFormatsTab";

/**
 * Document Name Formats administration. Phase 1 of the feature: a catalog of reusable, ordered
 * component compositions (e.g. "Document Type" + "." + "Serial Number" -> "SOP.0007"). New/Edit
 * open the dedicated DocumentNameFormatEditorView page (not a modal -- the ordered component
 * builder needs the room). Underlying API is `/documents/administration/document-name-formats`.
 */
export const DocumentNameFormatsView: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermissionAlias } = usePermissions();
  const canManage = hasPermissionAlias("documents.admin.name_formats.manage");

  return (
    <div className="h-full flex flex-col gap-6">
      <PageHeader
        title="Document Name Formats"
        breadcrumbItems={documentNameFormats(navigate)}
        actions={
          canManage ? (
            <Button
              size="sm"
              onClick={() => navigate(ROUTES.DOCUMENTS.ADMIN.NAME_FORMATS_NEW)}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              New
            </Button>
          ) : undefined
        }
      />

      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex-1 overflow-auto p-4 md:p-5">
            <DocumentNameFormatsTab />
          </div>
        </div>
      </div>
    </div>
  );
};
