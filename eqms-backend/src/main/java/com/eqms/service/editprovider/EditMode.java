package com.eqms.service.editprovider;

/**
 * Lifecycle-driven editing mode passed to a {@link DocumentEditProvider}. Mapped 1:1 from
 * Revision status by the caller (Draft -> EDIT, Pending Review -> REVIEW, Pending Approval ->
 * COMMENT_ONLY) so both Microsoft Graph and OnlyOffice read the same source of truth instead of
 * each provider inventing its own status-to-permission mapping.
 */
public enum EditMode {
    /** Full edit access -- Draft, Author/Co-Author only (see DocumentAuthorizationService#canEditRevisionFileOnline). */
    EDIT,
    /** Track-changes is forced on; the actor cannot accept/reject or type outside tracked revisions. */
    REVIEW,
    /** Comment-only -- no content edits, no track-changes, matching Pending Approval's approver role. */
    COMMENT_ONLY,
    /** Read-only viewer (Document tab): no edit/review/comment, no download or print, no save callback. */
    VIEW
}
