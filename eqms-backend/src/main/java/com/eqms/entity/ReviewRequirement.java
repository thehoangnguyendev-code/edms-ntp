package com.eqms.entity;

/**
 * Immutable workflow-review requirement selected by the Document Type/Sub-Type
 * dictionary and snapshotted onto every revision.  This is deliberately a
 * business rule, not an authorization role: access still comes from policy and
 * SoD is evaluated separately.
 */
public enum ReviewRequirement {
    /** Review is not required -- no Reviewer may be assigned. */
    NONE,
    /** Review is required -- at least one Reviewer, no fixed/maximum count. Replaces the former
     *  SINGLE (exactly one) / MULTIPLE (at least two) / FLEXIBLE (no Sub-Type selected) split:
     *  the business only ever needed "is a review required at all", not a pinned headcount. A
     *  document with no Sub-Type selected ("None") also resolves to REQUIRED, not NONE --
     *  "unclassified" must not be read as "review waived". */
    REQUIRED
}
