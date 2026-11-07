import { useLocation } from "react-router-dom";
import { ROUTES } from "@/app/routes.constants";
import type { useNavigateWithLoading } from "@/hooks";
import { documentApi } from "@/services/api/documents";
import { buildRevisionDetailSnapshotState } from "@/features/documents/shared/detailSnapshotHelpers";
import type { Revision } from "./types";
import type { RevisionRowAction } from "./revisionRowActions";

type Navigation = ReturnType<typeof useNavigateWithLoading>;

interface UseRevisionRowActionsOptions {
  /** The list route the person came from; the opened page returns here. */
  from: string;
  /** The screen's own navigation, so its loading overlay follows the navigation started here. */
  navigateTo: Navigation["navigateTo"];
  navigateToPrepared: Navigation["navigateToPrepared"];
  /** Publishing differs per screen (templates are signed in place); a screen without it never offers Publish. */
  onPublish?: (revision: Revision) => void;
}

/** What every revision list does when a row action is chosen, so the lists do not each carry their own copy. */
export function useRevisionRowActions({ from, navigateTo, navigateToPrepared, onPublish }: UseRevisionRowActionsOptions) {
  const location = useLocation();
  const returnTo = `${location.pathname}${location.search}`;

  const preloadRevisionAndNavigate = async (route: string, revisionId: string, extraState?: Record<string, unknown>) => {
    try {
      await navigateToPrepared(
        route,
        async () => ({
          ...buildRevisionDetailSnapshotState(await documentApi.getRevisionByIdSnapshot(revisionId)),
        }),
        { state: { from, returnTo, ...(extraState ?? {}) } },
      );
    } catch (error) {
      console.error("Failed to preload revision before navigation", error);
      navigateTo(route, { state: { from, returnTo, ...(extraState ?? {}) } });
    }
  };

  const viewRevision = (id: string) => {
    void preloadRevisionAndNavigate(ROUTES.DOCUMENTS.REVISIONS.DETAIL(id), id);
  };

  const requestControlledCopy = (revision: Revision) => {
    const { parentDocumentId: listedParentId } = revision as Revision & { parentDocumentId?: string };
    const parentDocumentId = String(revision.documentId || listedParentId || revision.documentNumber || revision.id);
    const relatedDocuments = revision.hasRelatedDocuments
      ? [
        {
          id: revision.id,
          documentId: parentDocumentId,
          revisionName: revision.revisionName,
          revisionNumber: revision.revisionNumber,
          status: revision.state,
          isParent: true,
        },
      ]
      : [];

    navigateTo(ROUTES.DOCUMENTS.CONTROLLED_COPIES.REQUEST, {
      state: {
        documentId: parentDocumentId,
        revisionName: revision.revisionName,
        documentVersion: revision.revisionNumber,
        revisionId: revision.id,
        parentDocumentId,
        sourceRevisionId: revision.id,
        relatedDocuments,
        from,
        workspaceState: {
          from,
          returnTo: from,
          parentDocumentId,
          sourceRevisionId: revision.id,
        },
      },
    });
  };

  const runRowAction = (action: RevisionRowAction, revision: Revision) => {
    const id = revision.id;
    switch (action) {
      case "edit":
        navigateTo(ROUTES.DOCUMENTS.REVISIONS.EDIT(id), { state: { from, revisionId: id, editMode: true } });
        break;
      case "view":
        viewRevision(id);
        break;
      case "review":
        void preloadRevisionAndNavigate(ROUTES.DOCUMENTS.REVISIONS.REVIEW(id), id);
        break;
      case "approve":
        void preloadRevisionAndNavigate(ROUTES.DOCUMENTS.REVISIONS.APPROVAL(id), id);
        break;
      case "training":
        void preloadRevisionAndNavigate(ROUTES.DOCUMENTS.REVISIONS.TRAINING(id), id, {
          workspaceState: { activeTab: "training" },
        });
        break;
      case "controlledCopy":
        requestControlledCopy(revision);
        break;
      case "publish":
        onPublish?.(revision);
        break;
    }
  };

  return { viewRevision, runRowAction };
}
