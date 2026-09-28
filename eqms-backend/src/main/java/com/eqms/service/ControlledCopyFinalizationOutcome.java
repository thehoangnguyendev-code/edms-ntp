package com.eqms.service;

/**
 * Result of a single Controlled Copy background finalization attempt (post-distribution PDF
 * re-render, or the failure-recovery reset). {@code SKIPPED_TERMINAL} means the copy was already
 * moved to a terminal lifecycle state (OBSOLETED/CLOSED_CANCELLED) by a concurrent action -- this is
 * an intentional, completed outcome and must never be treated as a failure: it must not trigger a
 * retry and must never be "restored" back to a non-terminal distribution status.
 */
public enum ControlledCopyFinalizationOutcome {
    SUCCESS,
    SKIPPED_TERMINAL,
    FAILED
}
