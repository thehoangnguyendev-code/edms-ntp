import { ROUTES } from "@/app/routes.constants";
import { knowledgeApi, type KnowledgePortalDocument } from "@/services/api/knowledge";

/** Navigation item id of the Knowledge Base menu entry (see app/navigation.ts). */
export const KNOWLEDGE_BASE_NAV_ID = "knowledge-base";

export const openKnowledgeExplorer = (): void => {
  window.open(ROUTES.DOCUMENTS.KNOWLEDGE_EXPLORER, "_blank", "noopener,noreferrer");
};

/** Counts the view, then opens the read-only preview page in its own tab. */
export const openKnowledgePreview = (item: KnowledgePortalDocument): void => {
  const doc = item.document;
  void knowledgeApi.recordView(doc.id).catch(() => undefined);
  const params = new URLSearchParams({ name: doc.documentName });
  if (doc.documentNumber) params.set("number", doc.documentNumber);
  if (doc.revisionNumber) params.set("revision", doc.revisionNumber);
  if (doc.department) params.set("department", doc.department);
  window.open(`${ROUTES.DOCUMENTS.KNOWLEDGE_PREVIEW(doc.id)}?${params.toString()}`, "_blank", "noopener,noreferrer");
};
