package com.eqms.service;

import java.util.Optional;

/**
 * The registered top-level data domains of object storage: the single source of truth for what may be written, to which
 * bucket class, and which unit a backup or restore works on.
 *
 * <p>Every object key starts with exactly one domain prefix, followed by the entity's own identifiers (see
 * {@link StoragePathBuilder}). A key outside these domains is rejected before anything is stored, so a new code path cannot
 * silently create a folder in the locked records bucket, where it could never be removed again (Object Lock).</p>
 *
 * <p>{@code temp} is deliberately not a domain: scratch files must never be written to a bucket whose objects cannot be
 * deleted.</p>
 */
public enum StorageDomain {

    DOCUMENTS("documents", BucketClass.RECORDS),
    CONTROLLED_COPIES("controlled-copies", BucketClass.RECORDS),
    UNCONTROLLED_COPIES("uncontrolled-copies", BucketClass.RECORDS),
    FORMS("forms", BucketClass.RECORDS),
    PERSONNEL("personnel", BucketClass.RECORDS),
    REPORTS("reports", BucketClass.RECORDS),
    /** Reserved: training materials and assessment evidence are not written yet. */
    TRAINING("training", BucketClass.RECORDS),
    /** Reserved: audit evidence exports are not written yet. */
    AUDIT("audit", BucketClass.RECORDS),
    TEMPLATES("templates", BucketClass.TEMPLATES);

    /** Which bucket a domain lives in. Records are locked (WORM); templates are versioned but may be superseded. */
    public enum BucketClass {
        RECORDS,
        TEMPLATES
    }

    private final String prefix;
    private final BucketClass bucketClass;

    StorageDomain(String prefix, BucketClass bucketClass) {
        this.prefix = prefix;
        this.bucketClass = bucketClass;
    }

    /**
     * The folder name of the domain. It is fixed in code on purpose and is not configurable: a prefix an administrator could
     * rename would let new files land outside the structure that backup, restore and reconciliation rely on, in a bucket whose
     * objects can never be removed.
     */
    public String prefix() {
        return prefix;
    }

    public BucketClass bucketClass() {
        return bucketClass;
    }

    /**
     * The domain an object key belongs to, matched on its first path segment, or empty when the key is outside every
     * registered domain. A key that merely begins with the same letters (for example {@code documents-old/...}) does not match.
     */
    public static Optional<StorageDomain> of(String objectKey) {
        if (objectKey == null || objectKey.isBlank()) {
            return Optional.empty();
        }
        String key = objectKey.replaceAll("^/+", "");
        for (StorageDomain domain : values()) {
            if (key.equals(domain.prefix) || key.startsWith(domain.prefix + "/")) {
                return Optional.of(domain);
            }
        }
        return Optional.empty();
    }
}
