package com.eqms.backup.agent;

import com.eqms.backup.agent.objects.MinioLiveStore;
import io.minio.BucketExistsArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.RemoveBucketArgs;
import io.minio.RemoveObjectArgs;
import io.minio.SetBucketVersioningArgs;
import io.minio.messages.VersioningConfiguration;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Runs only when TEST_MINIO_ENDPOINT, TEST_MINIO_ACCESS and TEST_MINIO_SECRET name an account that may make eqms-test-* buckets.
 * It creates and removes its own throw-away bucket; it never touches the records or templates buckets.
 */
class MinioLiveStoreIT {

    @Test
    void addsVersionsAnswersByVersionAndRefusesOtherBuckets() throws Exception {
        String endpoint = System.getenv("TEST_MINIO_ENDPOINT"), access = System.getenv("TEST_MINIO_ACCESS"), secret = System.getenv("TEST_MINIO_SECRET");
        Assumptions.assumeTrue(endpoint != null && access != null && secret != null, "no MinIO test account in the environment");
        String bucket = "eqms-test-live-" + UUID.randomUUID().toString().substring(0, 8);
        MinioClient admin = MinioClient.builder().endpoint(endpoint).credentials(access, secret).build();
        admin.makeBucket(MakeBucketArgs.builder().bucket(bucket).build());
        admin.setBucketVersioning(SetBucketVersioningArgs.builder().bucket(bucket).config(new VersioningConfiguration(VersioningConfiguration.Status.ENABLED, null)).build());
        Path file = Files.createTempFile("live-", ".bin");
        String v1 = null, v2 = null;
        try {
            MinioLiveStore store = new MinioLiveStore(endpoint, access, secret, Set.of(bucket));
            Files.writeString(file, "one");
            v1 = store.put(bucket, "docs/a.txt", file);
            Files.writeString(file, "two");
            v2 = store.put(bucket, "docs/a.txt", file);
            assertThat(v1).isNotBlank().isNotEqualTo(v2);
            assertThat(store.hasVersion(bucket, "docs/a.txt", v1)).isTrue();
            assertThat(store.hasVersion(bucket, "docs/a.txt", v2)).isTrue();
            assertThat(store.hasVersion(bucket, "docs/a.txt", "not-a-version")).isFalse();
            assertThat(store.hasVersion(bucket, "docs/a.txt", null)).isTrue();
            assertThat(store.hasVersion(bucket, "docs/missing.txt", null)).isFalse();
            assertThatThrownBy(() -> store.put("eqms-gmp-records", "x", file)).isInstanceOf(IOException.class).hasMessageContaining("Refusing");
        } finally {
            Files.deleteIfExists(file);
            for (String v : new String[]{v1, v2}) {
                if (v != null) admin.removeObject(RemoveObjectArgs.builder().bucket(bucket).object("docs/a.txt").versionId(v).build());
            }
            if (admin.bucketExists(BucketExistsArgs.builder().bucket(bucket).build())) admin.removeBucket(RemoveBucketArgs.builder().bucket(bucket).build());
        }
    }
}
