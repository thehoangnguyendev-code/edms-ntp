package com.eqms.backup.agent.target;

import io.minio.BucketExistsArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.SetObjectLockConfigurationArgs;
import io.minio.messages.ObjectLockConfiguration;
import io.minio.messages.RetentionDurationDays;
import io.minio.messages.RetentionMode;

/**
 * Operator tool, never called by the agent: creates the backup bucket with Object Lock and a default retention.
 * <pre>
 *   java -cp eqms-backup-agent.jar -Dloader.main=com.eqms.backup.agent.target.ObjectLockBucketProvisioner \
 *        org.springframework.boot.loader.launch.PropertiesLauncher ENDPOINT ACCESS_KEY SECRET_KEY BUCKET MODE DAYS
 * </pre>
 * MODE is GOVERNANCE (an administrator can still lift it; use in DEV and TEST) or COMPLIANCE (nobody can, not even the
 * root user, until the days pass; use in PROD only). The bucket must not already exist, so a bucket in use is never changed.
 */
public final class ObjectLockBucketProvisioner {

    private ObjectLockBucketProvisioner() {
    }

    public static void main(String[] args) throws Exception {
        if (args.length != 6) {
            System.err.println("usage: ENDPOINT ACCESS_KEY SECRET_KEY BUCKET GOVERNANCE|COMPLIANCE DAYS");
            System.exit(2);
        }
        String bucket = args[3];
        RetentionMode mode = RetentionMode.valueOf(args[4].toUpperCase());
        int days = Integer.parseInt(args[5]);
        if (days < 1) throw new IllegalArgumentException("DAYS must be at least 1");
        if (bucket.startsWith("eqms-gmp-") || bucket.equals("eqms-templates")) {
            throw new IllegalArgumentException("Refusing to touch a live eQMS bucket: " + bucket);
        }
        MinioClient client = MinioClient.builder().endpoint(args[0]).credentials(args[1], args[2]).build();
        if (client.bucketExists(BucketExistsArgs.builder().bucket(bucket).build())) {
            throw new IllegalStateException("Bucket " + bucket + " already exists; it is left as it is");
        }
        client.makeBucket(MakeBucketArgs.builder().bucket(bucket).objectLock(true).build());
        client.setObjectLockConfiguration(SetObjectLockConfigurationArgs.builder().bucket(bucket)
                .config(new ObjectLockConfiguration(mode, new RetentionDurationDays(days))).build());
        System.out.println("Created " + bucket + " with Object Lock " + mode + " " + days + " day(s)");
    }
}
