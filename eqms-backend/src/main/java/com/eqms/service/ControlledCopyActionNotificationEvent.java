package com.eqms.service;

import java.util.UUID;

/**
 * Published after a single-copy Controlled Copy action (Distribute, Recall, Cancel, Destroy,
 * Replace Lost/Damaged, Print) transaction commits, so the actual stakeholder notification (both
 * in-app and e-mail) runs in the background instead of synchronously inside that transaction.
 * <p>
 * The synchronous path used to call straight into EmailNotificationService, which retries SMTP
 * failures with blocking sleeps (up to ~90s worst case across attempts) -- inside the same
 * {@code @Transactional} method as the DB write. Under a slow/degraded mail server this held the
 * HTTP request thread AND its Hikari connection open for that whole duration, for an operation
 * (notifying people) that has nothing to do with the write's own correctness -- a real risk of
 * exhausting the connection pool for the whole app under concurrent load, not just this action.
 * <p>
 * Carries IDs (not entities) since the listener runs on a different thread/transaction --
 * mirrors the existing ControlledCopyBatch*Event pattern. previewPassword is only present for
 * DISTRIBUTE (the plaintext preview credential, generated once and never persisted/re-derivable).
 */
public record ControlledCopyActionNotificationEvent(
        UUID copyId,
        UUID actorUserId,
        String action,
        String comment,
        String previewPassword
) {
}
