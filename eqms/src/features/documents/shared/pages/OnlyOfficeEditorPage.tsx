import React from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { OnlyOfficeEditorFrame } from "@/features/documents/shared/components/OnlyOfficeEditorFrame";

/** Ordinary online authoring; legacy electronic-Form links cannot start a session. */
export const OnlyOfficeEditorPage: React.FC = () => {
  const { revisionId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const format = searchParams.get("format");
  if (format && format !== "docx") {
    return <div className="flex min-h-screen items-center justify-center bg-white p-6">
      <p role="alert" className="text-sm text-slate-700">Electronic Forms have been retired. Open Edit File Online from the revision to edit the DOCX document.</p>
    </div>;
  }
  return <OnlyOfficeEditorFrame revisionId={revisionId} title={searchParams.get("title") || undefined} onClose={() => window.close()} />;
};
