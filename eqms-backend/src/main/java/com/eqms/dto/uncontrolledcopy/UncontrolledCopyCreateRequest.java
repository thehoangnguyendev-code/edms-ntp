package com.eqms.dto.uncontrolledcopy;

/**
 * Request an Uncontrolled Copy of the current Effective revision of a document.
 * <p>
 * The copy is always held by a real system user: {@code recipientUserId} (blank = the requester themself). Only that
 * user (plus the requester and Document Control) can open the login-gated download link -- it is never resolved by
 * e-mail address.
 * <p>
 * {@code externalRecipientLabel} is an optional free-text display/audit label (e.g. "J. Smith, ACME Corp auditor")
 * for a copy meant for an outside party. It grants nothing: the internal holder downloads the watermarked copy and
 * hands it over outside the system.
 */
public record UncontrolledCopyCreateRequest(
        String documentId,
        String revisionId,
        String reason,
        String recipientUserId,
        String externalRecipientLabel,
        String signatureToken
) {
}
