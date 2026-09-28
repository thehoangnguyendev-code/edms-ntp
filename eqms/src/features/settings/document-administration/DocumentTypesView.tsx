import React, { useRef } from "react";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { documentTypesAdmin } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { usePermissions } from "@/hooks/usePermissions";
import { DocumentTypesTab } from "@/features/settings/dictionaries/tabs/DocumentTypesTab";

/**
 * Document Types administration. The underlying API
 * is `/documents/administration/document-types`.
 */
export const DocumentTypesView: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermissionAlias } = usePermissions();
  const canManage = hasPermissionAlias("documents.admin.document_types.manage");
  const tabRef = useRef<{ openAddModal: () => void }>(null);

  return (
    <div className="h-full flex flex-col gap-6">
      <PageHeader
        title="Document Types"
        breadcrumbItems={documentTypesAdmin(navigate)}
        actions={
          canManage ? (
            <Button
              size="sm"
              onClick={() => tabRef.current?.openAddModal()}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              Add New Document Type
            </Button>
          ) : undefined
        }
      />

      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex-1 overflow-auto p-4 md:p-5">
            <DocumentTypesTab ref={tabRef} />
          </div>
        </div>
      </div>
    </div>
  );
};
