package com.eqms.config;

import java.util.Locale;

/**
 * The three separated environments of the SDLC. Each one has its own servers/containers, database, object store, secrets and
 * buckets; the name in the bucket is a second line of defence, so a configuration copied from another environment is
 * rejected instead of writing into the wrong store.
 *
 * <ul>
 *   <li>DEV: development. Disposable data. Buckets must not carry a TEST or PROD name.</li>
 *   <li>TEST: validation/qualification. Buckets start with {@code eqms-test-}.</li>
 *   <li>PROD: official operation. Buckets start with {@code eqms-prod-}.</li>
 * </ul>
 */
public enum DeploymentEnvironment {
    DEV,
    TEST,
    PROD;

    private static final String TEST_BUCKET_PREFIX = "eqms-test-";
    private static final String PROD_BUCKET_PREFIX = "eqms-prod-";

    public static DeploymentEnvironment parse(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalStateException("app.environment must be DEV, TEST or PROD");
        }
        try {
            return valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new IllegalStateException("app.environment must be DEV, TEST or PROD");
        }
    }

    /** True when the environment is subject to the controlled (GMP) configuration rules. */
    public boolean isControlled() {
        return this != DEV;
    }

    /**
     * Fails closed when a bucket does not belong to this environment. Bucket names are never echoed in full to a caller; the
     * message only says which kind of bucket was rejected.
     */
    public void requireBucketAllowed(String bucket, String purpose) {
        if (bucket == null || bucket.isBlank()) {
            throw new IllegalStateException("The " + purpose + " bucket is not configured");
        }
        String name = bucket.trim().toLowerCase(Locale.ROOT);
        boolean testName = name.startsWith(TEST_BUCKET_PREFIX);
        boolean prodName = name.startsWith(PROD_BUCKET_PREFIX);
        boolean allowed = switch (this) {
            case DEV -> !testName && !prodName;
            case TEST -> testName;
            case PROD -> prodName;
        };
        if (!allowed) {
            throw new IllegalStateException("The " + purpose + " bucket does not belong to the " + this + " environment");
        }
    }
}
