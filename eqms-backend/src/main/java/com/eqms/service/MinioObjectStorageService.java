package com.eqms.service;

import com.fasterxml.jackson.databind.JsonNode;
import io.minio.BucketExistsArgs;
import io.minio.GetBucketVersioningArgs;
import io.minio.GetObjectArgs;
import io.minio.GetObjectLockConfigurationArgs;
import io.minio.ListObjectsArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.ObjectWriteResponse;
import io.minio.PutObjectArgs;
import io.minio.Result;
import io.minio.SetBucketVersioningArgs;
import io.minio.SetObjectLockConfigurationArgs;
import io.minio.messages.Item;
import io.minio.messages.ObjectLockConfiguration;
import io.minio.messages.RetentionDurationYears;
import io.minio.messages.RetentionMode;
import io.minio.messages.VersioningConfiguration;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Map;

@Service
public class MinioObjectStorageService {

    public record StoredObject(
            Path localPath,
            String uri,
            String bucket,
            String objectKey,
            String versionId,
            String sha256
    ) {
    }

    private record MinioConfig(
            String endpoint,
            String accessKey,
            String secretKey,
            String bucket,
            int retentionYears
    ) {
    }

    private record ObjectReference(String bucket, String objectKey, String versionId) {
    }

    private static final long PART_SIZE = 10L * 1024L * 1024L;
    private static final String URI_PREFIX = "minio://";
    private static final Logger log = LoggerFactory.getLogger(MinioObjectStorageService.class);

    private final boolean enabled;
    private final boolean initializeOnStartup;
    private final String defaultEndpoint;
    private final String defaultAccessKey;
    private final String defaultSecretKey;
    private final String defaultBucket;
    private final int defaultRetentionYears;
    private final SystemConfigurationService systemConfigurationService;

    public MinioObjectStorageService(
            @Value("${app.minio.enabled:true}") boolean enabled,
            @Value("${app.minio.initialize-on-startup:false}") boolean initializeOnStartup,
            @Value("${app.minio.endpoint:http://localhost:9000}") String endpoint,
            @Value("${app.minio.access-key:eqms-minio}") String accessKey,
            @Value("${app.minio.secret-key:eqms-minio-secret}") String secretKey,
            @Value("${app.minio.bucket:eqms-gmp-revisions}") String bucket,
            @Value("${app.minio.retention-years:5}") int retentionYears,
            SystemConfigurationService systemConfigurationService
    ) {
        this.enabled = enabled;
        this.initializeOnStartup = initializeOnStartup;
        this.defaultEndpoint = requireValue(endpoint, "MinIO endpoint");
        this.defaultAccessKey = requireValue(accessKey, "MinIO access key");
        this.defaultSecretKey = requireValue(secretKey, "MinIO secret key");
        this.defaultBucket = requireValue(bucket, "MinIO bucket");
        this.defaultRetentionYears = Math.max(retentionYears, 1);
        this.systemConfigurationService = systemConfigurationService;
    }

    public boolean isEnabled() {
        return enabled;
    }

    @PostConstruct
    public void initialize() {
        if (!enabled || !initializeOnStartup) {
            return;
        }
        try {
            ensureBucket(resolveDefaultConfig());
        } catch (Exception ex) {
            log.warn(
                    "MinIO is not ready during startup. The application will remain available so an administrator can configure storage: {}",
                    ex.getMessage()
            );
        }
    }

    public StoredObject store(String relativeObjectKey, InputStream inputStream, String contentType) throws IOException {
        return store(null, relativeObjectKey, inputStream, contentType);
    }

    public StoredObject store(JsonNode storageConfig, String relativeObjectKey, InputStream inputStream, String contentType) throws IOException {
        MinioConfig config = resolveConfig(storageConfig);
        MinioClient client = buildClient(config);
        ensureBucket(client, config.bucket(), config.retentionYears());
        String objectKey = normalizePath(relativeObjectKey);
        Path stagingDirectory = Files.createTempDirectory("eqms-minio-upload-");
        Path stagingFile = stagingDirectory.resolve(fileName(objectKey));
        stagingFile.toFile().deleteOnExit();
        try {
            Files.copy(inputStream, stagingFile, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
            String checksum = sha256(stagingFile);
            try (InputStream stagedInput = Files.newInputStream(stagingFile)) {
                ObjectWriteResponse response = client.putObject(
                        PutObjectArgs.builder()
                                .bucket(config.bucket())
                                .object(objectKey)
                                .contentType(StringUtils.hasText(contentType) ? contentType : "application/octet-stream")
                                .userMetadata(Map.of("sha256", checksum))
                                .stream(stagedInput, Files.size(stagingFile), PART_SIZE)
                                .build()
                );
                String versionId = response.versionId();
                return new StoredObject(
                        stagingFile,
                        toUri(config.bucket(), objectKey, versionId),
                        config.bucket(),
                        objectKey,
                        versionId,
                        checksum
                );
            }
        } catch (Exception ex) {
            Files.deleteIfExists(stagingFile);
            throw storageException("Failed to store object in MinIO", ex);
        }
    }

    public InputStream open(String uri) throws IOException {
        return open(null, uri);
    }

    public InputStream open(JsonNode storageConfig, String uri) throws IOException {
        MinioConfig config = resolveConfig(storageConfig);
        ObjectReference reference = parse(uri);
        try {
            GetObjectArgs.Builder builder = GetObjectArgs.builder()
                    .bucket(reference.bucket())
                    .object(reference.objectKey());
            if (StringUtils.hasText(reference.versionId())) {
                builder.versionId(reference.versionId());
            }
            return buildClient(config).getObject(builder.build());
        } catch (Exception ex) {
            throw storageException("Failed to read object from MinIO", ex);
        }
    }

    public Path materialize(String uri) throws IOException {
        return materialize(null, uri);
    }

    public Path materialize(JsonNode storageConfig, String uri) throws IOException {
        ObjectReference reference = parse(uri);
        Path stagingDirectory = Files.createTempDirectory("eqms-minio-download-");
        Path tempFile = stagingDirectory.resolve(fileName(reference.objectKey()));
        tempFile.toFile().deleteOnExit();
        try (InputStream inputStream = open(storageConfig, uri)) {
            Files.copy(inputStream, tempFile, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
            return tempFile;
        } catch (Exception ex) {
            Files.deleteIfExists(tempFile);
            throw storageException("Failed to materialize MinIO object", ex);
        }
    }

    public void delete(String uri) throws IOException {
        delete(null, uri);
    }

    public void delete(JsonNode storageConfig, String uri) throws IOException {
        throw new IOException("MinIO object deletion is disabled because GMP/WORM retention is enabled");
    }

    public void deletePrefix(String relativePrefix) throws IOException {
        deletePrefix(null, relativePrefix);
    }

    public void deletePrefix(JsonNode storageConfig, String relativePrefix) throws IOException {
        throw new IOException("MinIO prefix deletion is disabled because GMP/WORM retention is enabled");
    }

    public void testConnection(JsonNode storageConfig) throws IOException {
        MinioConfig config = resolveConfig(storageConfig);
        MinioClient client = buildClient(config);
        ensureBucket(client, config.bucket(), config.retentionYears());
        try {
            validateComplianceConfiguration(client, config.bucket(), config.retentionYears());
            Iterable<Result<Item>> objects = client.listObjects(
                    ListObjectsArgs.builder()
                            .bucket(config.bucket())
                            .maxKeys(1)
                            .build()
            );
            objects.iterator().hasNext();
        } catch (Exception ex) {
            throw storageException("MinIO compliance connection test failed", ex);
        }
    }

    public boolean isMinioUri(String value) {
        return StringUtils.hasText(value) && value.trim().toLowerCase().startsWith(URI_PREFIX);
    }

    private synchronized void ensureBucket(MinioConfig config) throws IOException {
        ensureBucket(buildClient(config), config.bucket(), config.retentionYears());
    }

    private synchronized void ensureBucket(MinioClient client, String bucket, int retentionYears) throws IOException {
        try {
            boolean exists = client.bucketExists(BucketExistsArgs.builder().bucket(bucket).build());
            if (!exists) {
                client.makeBucket(MakeBucketArgs.builder().bucket(bucket).objectLock(true).build());
            }
            enableVersioningAndLock(client, bucket, retentionYears);
        } catch (Exception ex) {
            throw storageException("Failed to initialize MinIO bucket " + bucket, ex);
        }
    }

    /** Falls back to the raw, unmasked config when no caller-supplied {@code storageConfig} is
     *  given — {@link SystemConfigurationService#getConfiguration()} masks secrets to
     *  "********" for API responses, which would break real MinIO authentication here. */
    private MinioConfig resolveConfig(JsonNode storageConfig) {
        JsonNode storageNode = storageConfig;
        if (storageNode == null || storageNode.isNull()) {
            JsonNode integrations = systemConfigurationService.requireConfiguration().getIntegrationsConfig();
            storageNode = integrations == null ? null : integrations.get("storage");
        }

        String endpoint = resolveEndpoint(text(storageNode, "minioEndpoint"));
        String accessKey = firstText(storageNode, "minioAccessKeyId", "accessKeyId");
        if (!StringUtils.hasText(accessKey)) {
            accessKey = defaultAccessKey;
        }
        String secretKey = firstText(storageNode, "minioSecretAccessKey", "secretAccessKey");
        // The configuration API masks an unchanged secret as "********". Never use that
        // display value for request signing; resolve the raw persisted secret on the server.
        if (OfficeOnlineConfigurationService.SECRET_MASK.equals(secretKey)) {
            JsonNode persistedStorage = systemConfigurationService.requireConfiguration()
                    .getIntegrationsConfig()
                    .path("storage");
            secretKey = firstText(persistedStorage, "minioSecretAccessKey", "secretAccessKey");
        }
        if (!StringUtils.hasText(secretKey)) {
            secretKey = defaultSecretKey;
        }
        String bucket = firstText(storageNode, "minioBucket", "bucketName");
        if (!StringUtils.hasText(bucket)) {
            bucket = defaultBucket;
        }
        int retentionYears = resolveRetentionYears(storageNode);

        return new MinioConfig(
                requireValue(endpoint, "MinIO endpoint"),
                requireValue(accessKey, "MinIO access key"),
                requireValue(secretKey, "MinIO secret key"),
                requireValue(bucket, "MinIO bucket"),
                retentionYears
        );
    }

    private MinioConfig resolveDefaultConfig() {
        return new MinioConfig(
                defaultEndpoint,
                defaultAccessKey,
                defaultSecretKey,
                defaultBucket,
                defaultRetentionYears
        );
    }

    private String resolveEndpoint(String configuredEndpoint) {
        if (!StringUtils.hasText(configuredEndpoint)) {
            return defaultEndpoint;
        }
        if (isLoopbackEndpoint(configuredEndpoint) && !isLoopbackEndpoint(defaultEndpoint)) {
            return defaultEndpoint;
        }
        return configuredEndpoint;
    }

    private static boolean isLoopbackEndpoint(String endpoint) {
        if (!StringUtils.hasText(endpoint)) {
            return false;
        }
        try {
            String host = URI.create(endpoint.trim()).getHost();
            return "localhost".equalsIgnoreCase(host)
                    || "127.0.0.1".equals(host)
                    || "::1".equals(host);
        } catch (IllegalArgumentException ex) {
            return false;
        }
    }

    private int resolveRetentionYears(JsonNode storageNode) {
        JsonNode value = storageNode == null ? null : storageNode.get("minioRetentionYears");
        if (value == null || value.isNull() || !value.canConvertToInt()) {
            return defaultRetentionYears;
        }
        return Math.max(value.asInt(defaultRetentionYears), 1);
    }

    private MinioClient buildClient(MinioConfig config) {
        return MinioClient.builder()
                .endpoint(config.endpoint())
                .credentials(config.accessKey(), config.secretKey())
                .build();
    }

    private void enableVersioningAndLock(MinioClient client, String bucket, int retentionYears) throws Exception {
        client.setBucketVersioning(
                SetBucketVersioningArgs.builder()
                        .bucket(bucket)
                        .config(new VersioningConfiguration(VersioningConfiguration.Status.ENABLED, Boolean.FALSE))
                        .build()
        );
        client.setObjectLockConfiguration(
                SetObjectLockConfigurationArgs.builder()
                        .bucket(bucket)
                        .config(new ObjectLockConfiguration(
                                RetentionMode.COMPLIANCE,
                                new RetentionDurationYears(Math.max(retentionYears, 1))
                        ))
                        .build()
        );
    }

    private void validateComplianceConfiguration(MinioClient client, String bucket, int retentionYears) throws Exception {
        VersioningConfiguration versioning = client.getBucketVersioning(
                GetBucketVersioningArgs.builder().bucket(bucket).build()
        );
        if (versioning == null || versioning.status() != VersioningConfiguration.Status.ENABLED) {
            throw new IllegalStateException("Bucket Versioning is not enabled");
        }

        ObjectLockConfiguration objectLock = client.getObjectLockConfiguration(
                GetObjectLockConfigurationArgs.builder().bucket(bucket).build()
        );
        if (objectLock == null || objectLock.mode() != RetentionMode.COMPLIANCE || objectLock.duration() == null) {
            throw new IllegalStateException("Object Lock Compliance Mode is not enabled");
        }
        if (!(objectLock.duration() instanceof RetentionDurationYears years)
                || years.duration() < Math.max(retentionYears, 1)) {
            throw new IllegalStateException(
                    "Object Lock retention is shorter than the configured " + Math.max(retentionYears, 1) + " year(s)"
            );
        }
    }

    private ObjectReference parse(String uri) {
        if (!isMinioUri(uri)) {
            throw new IllegalArgumentException("Invalid MinIO URI");
        }
        String value = uri.substring(URI_PREFIX.length());
        String versionId = null;
        int queryIndex = value.indexOf("?versionId=");
        if (queryIndex >= 0) {
            versionId = URLDecoder.decode(value.substring(queryIndex + 11), StandardCharsets.UTF_8);
            value = value.substring(0, queryIndex);
        }
        int separator = value.indexOf('/');
        if (separator <= 0 || separator == value.length() - 1) {
            throw new IllegalArgumentException("Invalid MinIO URI");
        }
        String bucket = value.substring(0, separator);
        String objectKey = URLDecoder.decode(value.substring(separator + 1), StandardCharsets.UTF_8);
        return new ObjectReference(bucket, objectKey, versionId);
    }

    private static String toUri(String bucket, String objectKey, String versionId) {
        String uri = URI_PREFIX + bucket + "/" + objectKey;
        return StringUtils.hasText(versionId)
                ? uri + "?versionId=" + URLEncoder.encode(versionId, StandardCharsets.UTF_8)
                : uri;
    }

    private static String normalizePath(String value) {
        if (!StringUtils.hasText(value)) {
            return "";
        }
        return value.trim()
                .replace('\\', '/')
                .replaceAll("^/+", "")
                .replaceAll("/+$", "")
                .replaceAll("/{2,}", "/");
    }

    private static String fileName(String objectKey) {
        int separator = objectKey.lastIndexOf('/');
        String value = separator >= 0 ? objectKey.substring(separator + 1) : objectKey;
        return StringUtils.hasText(value) ? value : "object.bin";
    }

    private static String sha256(Path path) throws IOException {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            try (InputStream input = Files.newInputStream(path)) {
                byte[] buffer = new byte[8192];
                int read;
                while ((read = input.read(buffer)) != -1) {
                    digest.update(buffer, 0, read);
                }
            }
            return HexFormat.of().formatHex(digest.digest());
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is unavailable", ex);
        }
    }

    private static String requireValue(String value, String label) {
        if (!StringUtils.hasText(value)) {
            throw new IllegalArgumentException(label + " is required");
        }
        return value.trim();
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        return value == null || value.isNull() ? null : value.asText();
    }

    private static String firstText(JsonNode node, String primaryField, String fallbackField) {
        String primary = text(node, primaryField);
        if (StringUtils.hasText(primary)) {
            return primary;
        }
        return text(node, fallbackField);
    }

    private static IOException storageException(String message, Exception cause) {
        return cause instanceof IOException ioException
                ? new IOException(message + ": " + ioException.getMessage(), ioException)
                : new IOException(message + ": " + cause.getMessage(), cause);
    }
}
