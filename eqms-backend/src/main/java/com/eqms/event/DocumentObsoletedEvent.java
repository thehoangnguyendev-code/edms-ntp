package com.eqms.event;

import java.util.UUID;

/**
 * Published only after a Document Obsolete transaction has successfully committed (TBR-DOC-016).
 * Consumed by an after-commit, async listener that dispatches notifications via the existing
 * NotificationDispatcher/EmailNotificationService -- never synchronously inside
 * DocumentService.obsoleteDocument's own transaction, and never at all if that transaction rolls
 * back (Spring's @TransactionalEventListener(AFTER_COMMIT) guarantees this).
 */
public record DocumentObsoletedEvent(UUID documentId, UUID actorUserId) {
}
