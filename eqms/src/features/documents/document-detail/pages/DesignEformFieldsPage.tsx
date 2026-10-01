import React from "react";
import { useParams } from "react-router-dom";
import { DesignEformFieldsFrame } from "../components/DesignEformFieldsFrame";

/**
 * Standalone, layout-less page hosting the live OnlyOffice Form Creator session -- opened in a
 * NEW BROWSER TAB by "Design eForm Fields" (ExecutedRecordsTab.tsx), mirroring how
 * OnlyOfficeEditorPage.tsx opens "Edit File Online" the same way. Mounted directly under
 * AppRoutes.tsx since a new tab has no app shell to render.
 */
export const DesignEformFieldsPage: React.FC = () => {
  const { formDocumentId = "" } = useParams();

  return (
    <DesignEformFieldsFrame
      formDocumentId={formDocumentId}
      onClose={() => window.close()}
    />
  );
};
