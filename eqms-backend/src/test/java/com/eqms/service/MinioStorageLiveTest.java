package com.eqms.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.minio.ListObjectsArgs;
import io.minio.MinioClient;
import io.minio.RemoveObjectArgs;
import io.minio.StatObjectArgs;
import io.minio.StatObjectResponse;
import io.minio.errors.ErrorResponseException;
import io.minio.errors.MinioException;
import io.minio.messages.Item;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.ByteArrayInputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Live check against the dev docker stack (MinIO on localhost:9000, ClamAV on localhost:3310); skipped when either is not
 * reachable. It writes nothing to the locked records bucket, because everything stored there is kept for the permanent
 * retention period and could never be removed. Writes go to the templates bucket, which is not locked.
 */
class MinioStorageLiveTest {

    private static final String ENDPOINT = "http://localhost:9000";
    private static final String ACCESS = "eqms-minio";
    private static final String SECRET = "eqms-minio-secret";
    private static final String RECORDS = "eqms-gmp-records";
    private static final String TEMPLATES = "eqms-templates";
    // Standard antivirus test signature, not a real virus.
    private static final String EICAR = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";
    private static final byte[] CLEAN_PDF = "%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n%%EOF\n".getBytes(StandardCharsets.US_ASCII);

    @Test
    void storageRulesHoldAgainstRealMinioAndClamAv() throws Exception {
        assumeReachable("localhost", 9000);
        assumeReachable("localhost", 3310);

        ClamAvScanService clam = new ClamAvScanService();
        ReflectionTestUtils.setField(clam, "enabled", true);
        ReflectionTestUtils.setField(clam, "host", "localhost");
        ReflectionTestUtils.setField(clam, "port", 3310);
        ReflectionTestUtils.setField(clam, "timeoutMs", 15000);
        MinioObjectStorageService storage = new MinioObjectStorageService(
                true, false, ENDPOINT, ACCESS, SECRET, RECORDS, TEMPLATES, MinioObjectStorageService.MAX_RETENTION_YEARS, null, clam);
        ObjectNode storageConfig = new ObjectMapper().createObjectNode()
                .put("minioEndpoint", ENDPOINT)
                .put("minioAccessKeyId", ACCESS)
                .put("minioSecretAccessKey", SECRET)
                .put("minioBucket", RECORDS)
                .put("minioTemplatesBucket", TEMPLATES)
                .put("minioRetentionYears", MinioObjectStorageService.MAX_RETENTION_YEARS);
        MinioClient client = MinioClient.builder().endpoint(ENDPOINT).credentials(ACCESS, SECRET).build();
        String run = "verification/" + UUID.randomUUID();

        // 1. A key outside the registered domains is rejected before anything is stored.
        assertThrows(IllegalArgumentException.class, () -> storage.store(storageConfig, run + "/stray.pdf",
                new ByteArrayInputStream(CLEAN_PDF), "application/pdf"));
        assertThrows(IllegalArgumentException.class, () -> storage.store(storageConfig, "temp/" + run + ".pdf",
                new ByteArrayInputStream(CLEAN_PDF), "application/pdf"));

        // 2. A clean template goes to the templates bucket, labelled with its domain.
        String templateKey = "templates/" + run + "/clean.pdf";
        MinioObjectStorageService.StoredObject clean = storage.store(storageConfig, templateKey,
                new ByteArrayInputStream(CLEAN_PDF), "application/pdf");
        assertEquals(TEMPLATES, clean.bucket());
        StatObjectResponse stat = client.statObject(StatObjectArgs.builder().bucket(TEMPLATES).object(templateKey).build());
        assertEquals("TEMPLATES", stat.userMetadata().getOrDefault("domain", stat.userMetadata().get("X-Amz-Meta-Domain")));

        // 3. An infected file is rejected and leaves nothing behind.
        String eicarKey = "templates/" + run + "/eicar.txt";
        assertThrows(MinioObjectStorageService.VirusRejectedException.class, () -> storage.store(storageConfig, eicarKey,
                new ByteArrayInputStream(EICAR.getBytes(StandardCharsets.US_ASCII)), "text/plain"));
        ErrorResponseException missing = assertThrows(ErrorResponseException.class, () -> client.statObject(
                StatObjectArgs.builder().bucket(TEMPLATES).object(eicarKey).build()));
        assertEquals("NoSuchKey", missing.errorResponse().code());

        // 4. The application's own compliance check: records bucket versioned, COMPLIANCE, permanent retention.
        storage.testConnection(storageConfig);

        // 5. Enforcement: an object that already sits in the locked records bucket cannot be removed.
        Item existing = null;
        for (var result : client.listObjects(ListObjectsArgs.builder().bucket(RECORDS).prefix("verification/").recursive(true).includeVersions(true).build())) {
            existing = result.get();
            break;
        }
        assumeTrue(existing != null, "no earlier verification object in the records bucket to test removal against");
        Item locked = existing;
        assertNotNull(locked.versionId());
        assertThrows(MinioException.class, () -> client.removeObject(RemoveObjectArgs.builder()
                .bucket(RECORDS).object(locked.objectName()).versionId(locked.versionId()).build()));
        assertTrue(client.statObject(StatObjectArgs.builder().bucket(RECORDS).object(locked.objectName()).build()).size() > 0);
    }

    private static void assumeReachable(String host, int port) {
        boolean open;
        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress(host, port), 1000);
            open = true;
        } catch (Exception ex) {
            open = false;
        }
        assumeTrue(open, host + ":" + port + " is not reachable; start the dev stack to run this check");
    }
}
