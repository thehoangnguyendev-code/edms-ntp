package com.eqms.exception;

/**
 * A recall-by-scan batch cannot be committed because some scans are not recallable (any more). Extends
 * IllegalStateException so it is reported as a 409 business conflict like other state conflicts. The commit method keeps the
 * freshly recomputed per-scan status (it is declared {@code noRollbackFor} this exception) so the screen shows the DCO exactly
 * which scans to fix or exclude; nothing else has changed at that point.
 */
public class RecallBatchNotReadyException extends IllegalStateException {
    public RecallBatchNotReadyException(String message) {
        super(message);
    }
}
