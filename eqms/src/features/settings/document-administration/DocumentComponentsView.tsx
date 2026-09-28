import React from "react";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { documentComponentsAdmin } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { usePermissions } from "@/hooks/usePermissions";
import { ROUTES } from "@/app/routes.constants";
import { DocumentComponentsTab } from "./DocumentComponentsTab";

/**
 * Document Components administration — the reusable token catalog a Document Name Format
 * composes (see DocumentNameFormatsView). Admins may only add FREE_TEXT components here; every
 * system-defined (field-bound) component is seeded by the backend and its Table/Field mapping is
 * read-only, by design (see DocumentComponent's class javadoc for the GMP/security rationale).
 * Underlying API is `/documents/administration/document-components`.
 */
export const DocumentComponentsView: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermissionAlias } = usePermissions();
  const canManage = hasPermissionAlias("documents.admin.name_formats.manage");

  return (
    <div className="h-full flex flex-col gap-6">
      <PageHeader
        title="Document Components"
        breadcrumbItems={documentComponentsAdmin(navigate)}
        actions={
          canManage ? (
            <Button
              size="sm"
              onClick={() => navigate(ROUTES.DOCUMENTS.ADMIN.DOCUMENT_COMPONENTS_NEW)}
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
            <DocumentComponentsTab />
          </div>
        </div>
      </div>
    </div>
  );
};
