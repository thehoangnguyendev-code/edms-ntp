package com.eqms.entity;

/**
 * Immutable workflow-review requirement selected by the Document Type/Sub-Type
 * dictionary and snapshotted onto every revision.  This is deliberately a
 * business rule, not an authorization role: access still comes from policy and
 * SoD is evaluated separately.
 */
public enum ReviewRequirement {
    NONE,
    SINGLE,
    MULTIPLE,
    /** No Sub-Type selected ("None") on the document -- at least one Reviewer is required, but
     *  the count isn't pinned to exactly one or at least two the way a configured Sub-Type would. */
    FLEXIBLE
}
