package com.eqms.service;

/**
 * Sequential/Parallel Review choice frozen on a revision at submit time (see
 * {@code DocumentRevisionRecord#getReviewFlowMode}). Approvers are always sequence-gated.
 */
public final class ReviewFlowMode {

    public static final String SEQUENTIAL = "SEQUENTIAL";
    public static final String PARALLEL = "PARALLEL";

    private ReviewFlowMode() {
    }

    public static String of(boolean parallelReviewEnabled) {
        return parallelReviewEnabled ? PARALLEL : SEQUENTIAL;
    }

    /**
     * Whether Reviewer sequence order is enforced for a revision, or {@code null} when the
     * revision carries no frozen mode (submitted before the mode was recorded) and the caller
     * must fall back to the live Document Properties setting.
     */
    public static Boolean sequenceEnforcedOrNull(String participantType, String frozenMode) {
        if (!"REVIEWER".equalsIgnoreCase(participantType) || frozenMode == null || frozenMode.isBlank()) {
            return null;
        }
        return !PARALLEL.equalsIgnoreCase(frozenMode.trim());
    }
}
