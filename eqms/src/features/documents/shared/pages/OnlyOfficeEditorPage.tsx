import React from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { OnlyOfficeEditorFrame } from "@/features/documents/shared/components/OnlyOfficeEditorFrame";

/**
 * Standalone, layout-less page hosting the OnlyOffice editor -- opened in a NEW BROWSER TAB by
 * "Edit File Online" (RevisionCreateView.tsx) and "Open File to Comment"
 * (useOfficeOnlineReviewLink.ts) when OnlyOffice is the admin-configured default provider, so it
 * behaves like Microsoft Graph's own "opens Word Online in a new tab" flow instead of an in-page
 * overlay. Mounted directly under AppRoutes.tsx (see the Knowledge preview page for the same
 * "authenticated but no MainLayout chrome" pattern) since a new tab has no app shell to render.
 */
export const OnlyOfficeEditorPage: React.FC = () => {
  const { revisionId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const title = searchParams.get("title") || undefined;

  return (
    <OnlyOfficeEditorFrame
      revisionId={revisionId}
      title={title}
      onClose={() => window.close()}
    />
  );
};
