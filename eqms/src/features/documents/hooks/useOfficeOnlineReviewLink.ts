import { useState } from "react";

/**
 * "Open File to Comment" for a Reviewer/Approver -- opens the revision's file in comment-only
 * review mode via the standalone OnlyOfficeEditorPage route, in a new tab. Shared by
 * RevisionReviewView and RevisionApprovalView, which previously had this handler copy-pasted
 * between them; keep it here as the single source of truth so a future fix only needs to land
 * once. The backend-resolved mode (see `RevisionService#getOnlyOfficeEditConfig`) already comes
 * back as REVIEW/COMMENT_ONLY for a Reviewer/Approver at this workflow stage.
 */
export const useOfficeOnlineReviewLink = (revisionId: string | null | undefined) => {
  const [isOpeningWordReview, setIsOpeningWordReview] = useState(false);

  const handleOpenWordReview = () => {
    if (isOpeningWordReview || !revisionId) return;
    window.open(`/documents/revisions/${revisionId}/onlyoffice-editor`, "_blank");
  };

  return { isOpeningWordReview, handleOpenWordReview };
};
