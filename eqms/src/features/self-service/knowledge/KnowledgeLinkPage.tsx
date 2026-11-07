import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Link2Off } from "lucide-react";
import { ROUTES } from "@/app/routes.constants";
import { Button } from "@/components/ui/button";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { knowledgeApi, type SharingLinkTarget } from "@/services/api/knowledge";

const errorMessage = (error: unknown) =>
  (error as { response?: { data?: { error?: { message?: string }; message?: string } } })?.response?.data?.error?.message
  ?? "This link could not be opened.";

/** The address the explorer is opened at for a folder a link points to. */
export const explorerAddressFor = (target: SharingLinkTarget): string => {
  const params = new URLSearchParams();
  if (target.hierarchyId) params.set("hierarchyId", target.hierarchyId);
  if (target.knowledgeBaseKey) params.set("kb", target.knowledgeBaseKey);
  if (target.knowledgeBaseLabel) params.set("kbLabel", target.knowledgeBaseLabel);
  if (target.path.length > 0) params.set("path", target.path.join(","));
  const query = params.toString();
  return query ? `${ROUTES.DOCUMENTS.KNOWLEDGE_EXPLORER}?${query}` : ROUTES.DOCUMENTS.KNOWLEDGE_EXPLORER;
};

/** The address of the preview page for the document a link points to. */
export const previewAddressFor = (target: SharingLinkTarget): string => {
  const params = new URLSearchParams({ name: target.documentName ?? "" });
  if (target.documentNumber) params.set("number", target.documentNumber);
  if (target.revisionNumber) params.set("revision", target.revisionNumber);
  if (target.department) params.set("department", target.department);
  return `${ROUTES.DOCUMENTS.KNOWLEDGE_PREVIEW(target.documentId ?? "")}?${params.toString()}`;
};

/**
 * Where a link made by a Head leads. The person opens it signed in; the server checks the token (it must exist, not be revoked, not have
 * expired), gives them what the link points to, and says where to go: a document opens in the read-only preview, a folder opens in the
 * Knowledge explorer. A link that no longer works says so, and says nothing about why.
 */
export const KnowledgeLinkPage: React.FC = () => {
  const { token = "" } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [folder, setFolder] = useState<SharingLinkTarget | null>(null);
  const asked = useRef(false);

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    knowledgeApi.openLink(token)
      .then((target) => {
        if (target.kind === "DOCUMENT" && target.documentId) {
          navigate(previewAddressFor(target), { replace: true });
        } else if (target.knowledgeBaseKey) {
          navigate(explorerAddressFor(target), { replace: true });
        } else {
          // the link was accepted, but the hierarchy cannot point at this folder: the person still has it, and finds it in the explorer
          setFolder(target);
        }
      })
      .catch((e) => setError(errorMessage(e)));
  }, [token, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        {!error && !folder && <SectionLoading text="Opening the link..." minHeight="120px" />}
        {error && (
          <>
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-600">
              <Link2Off className="h-5 w-5" />
            </div>
            <h1 className="text-base font-semibold text-slate-900">This link cannot be opened</h1>
            <p className="mt-1.5 text-sm text-slate-600">{error}</p>
            <p className="mt-1 text-xs text-slate-500">Ask the person who sent it for a new link.</p>
            <Button className="mt-4" onClick={() => navigate(ROUTES.DOCUMENTS.KNOWLEDGE_EXPLORER, { replace: true })}>Go to the Knowledge Base</Button>
          </>
        )}
        {folder && (
          <>
            <h1 className="text-base font-semibold text-slate-900">You can now open {folder.label}</h1>
            <p className="mt-1.5 text-sm text-slate-600">Find it in the Knowledge Base.</p>
            <Button className="mt-4" onClick={() => navigate(ROUTES.DOCUMENTS.KNOWLEDGE_EXPLORER, { replace: true })}>Go to the Knowledge Base</Button>
          </>
        )}
      </div>
    </div>
  );
};
