package com.eqms.service;

import com.eqms.config.DeploymentEnvironment;
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
import org.springframework.beans.factory.annotation.Autowired;
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
import java.util.Optional;

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
            String templatesBucket,
            int retentionYears
    ) {
    }

    private record ObjectReference(String bucket, String objectKey, String versionId) {
    }

    /** The longest default retention Object Lock accepts (100 years). "Permanent" in the settings means this value. */
    static final int MAX_RETENTION_YEARS = 100;
    private static final long PART_SIZE = 10L * 1024L * 1024L;
    private static final String URI_PREFIX = "minio://";
    private static final Logger log = LoggerFactory.getLogger(MinioObjectStorageService.class);

    private final boolean enabled;
    private final boolean initializeOnStartup;
    private final String defaultEndpoint;
    private final String defaultAccessKey;
    private final String defaultSecretKey;
    private final String defaultBucket;
    private final String defaultTemplatesBucket;
    private final int defaultRetentionYears;
    private final SystemConfigurationService systemConfigurationService;
    private final ClamAvScanService clamAvScanService;

    /** DEV, TEST or PROD; injected as a field so the constructor used by existing tests is unchanged. */
    @Value("${app.environment:DEV}")
    private String environmentName = "DEV";
    /** The alias lookup used after a restore (SDS 11.4.2); null in a test that does not wire it. */
    private ObjectVersionAliases versionAliases;

    public MinioObjectStorageService(
            @Value("${app.minio.enabled:true}") boolean enabled,
            @Value("${app.minio.initialize-on-startup:false}") boolean initializeOnStartup,
            @Value("${app.minio.endpoint:http://localhost:9000}") String endpoint,
            @Value("${app.minio.access-key:eqms-minio}") String accessKey,
            @Value("${app.minio.secret-key:eqms-minio-secret}") String secretKey,
            @Value("${app.minio.bucket:eqms-gmp-records}") String bucket,
            @Value("${app.minio.templates-bucket:eqms-templates}") String templatesBucket,
            @Value("${app.minio.retention-years:100}") int retentionYears,
            SystemConfigurationService systemConfigurationService,
            ClamAvScanService clamAvScanService
    ) {
        this.enabled = enabled;
        this.initializeOnStartup = initializeOnStartup;
        this.defaultEndpoint = requireValue(endpoint, "MinIO endpoint");
        this.defaultAccessKey = requireValue(accessKey, "MinIO access key");
        this.defaultSecretKey = requireValue(secretKey, "MinIO secret key");
        this.defaultBucket = requireValue(bucket, "MinIO bucket");
        this.defaultTemplatesBucket = requireValue(templatesBucket, "MinIO templates bucket");
        this.defaultRetentionYears = clampRetentionYears(retentionYears);
        this.systemConfigurationService = systemConfigurationService;
        this.clamAvScanService = clamAvScanService;
        // #6: these @Value defaults exist only so a fresh dev/test environment boots without any
        // configuration -- an admin can always override them for real via Integration Settings
        // (IntegrationTab.tsx), which SystemConfigurationService-backed config takes precedence
        // over. But if APP_MINIO_ACCESS_KEY/APP_MINIO_SECRET_KEY were never set (env var absent, or
        // still the docker-compose fallback) AND no admin has configured real credentials yet, the
        // application is silently running on a publicly-known default credential pair with no
        // signal to an operator -- warn loudly at startup so this is never mistaken for "already
        // configured".
        if ("eqms-minio".equals(this.defaultAccessKey) && "eqms-minio-secret".equals(this.defaultSecretKey)) {
            log.warn("MinIO is using the built-in default credentials (eqms-minio/eqms-minio-secret) -- "
                    + "this is fine for local development, but MUST be overridden with real credentials "
                    + "(APP_MINIO_ACCESS_KEY/APP_MINIO_SECRET_KEY, or Integration Settings) before this "
                    + "environment stores real data.");
        }
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
            MinioConfig config = resolveDefaultConfig();
            MinioClient client = buildClient(config);
            ensureBucket(client, config.bucket(), config.retentionYears(), true);
            ensureBucket(client, config.templatesBucket(), config.retentionYears(), false);
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
        String objectKey = normalizePath(relativeObjectKey);
        // Reject a key outside the registered domains before anything is staged or scanned: a stray folder in the locked
        // records bucket could never be removed again.
        StorageDomain domain = StorageDomain.of(objectKey).orElseThrow(() -> new IllegalArgumentException(
                "Object key is outside the registered storage domains: " + objectKey));
        String bucket = bucketFor(config.bucket(), config.templatesBucket(), domain);
        // Nothing is written to a bucket until the bytes have passed the virus scan (see scanStaged).
        // A rejected or unscannable file never reaches the locked records bucket.
        Path stagingDirectory = Files.createTempDirectory("eqms-minio-upload-");
        Path stagingFile = stagingDirectory.resolve(fileName(objectKey));
        stagingFile.toFile().deleteOnExit();
        try {
            Files.copy(inputStream, stagingFile, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
            scanStaged(stagingFile, objectKey);
            ensureBucket(client, bucket, config.retentionYears(), bucket.equals(config.bucket()));
            String checksum = sha256(stagingFile);
            try (InputStream stagedInput = Files.newInputStream(stagingFile)) {
                ObjectWriteResponse response = client.putObject(
                        PutObjectArgs.builder()
                                .bucket(bucket)
                                .object(objectKey)
                                .contentType(StringUtils.hasText(contentType) ? contentType : "application/octet-stream")
                                .userMetadata(Map.of("sha256", checksum, "domain", domain.name()))
                                .stream(stagedInput, Files.size(stagingFile), PART_SIZE)
                                .build()
                );
                String versionId = response.versionId();
                return new StoredObject(
                        stagingFile,
                        toUri(bucket, objectKey, versionId),
                        bucket,
                        objectKey,
                        versionId,
                        checksum
                );
            }
        } catch (VirusRejectedException | ClamAvScanService.VirusScanUnavailableException rejected) {
            Files.deleteIfExists(stagingFile);
            throw rejected;
        } catch (Exception ex) {
            Files.deleteIfExists(stagingFile);
            throw storageException("Failed to store object in MinIO", ex);
        }
    }

    /** A file the scanner reported as infected. Nothing is written for it. */
    public static class VirusRejectedException extends IOException {
        public VirusRejectedException(String message) {
            super(message);
        }
    }

    /**
     * Scans the staged bytes before any write. Fails closed: an infected file is rejected, and a scanner that is
     * enabled but unreachable raises {@link ClamAvScanService.VirusScanUnavailableException} (the same behaviour as
     * the upload validators). When scanning is switched off in configuration the scanner returns clean and this is a no-op.
     */
    private void scanStaged(Path stagingFile, String objectKey) throws IOException {
        ClamAvScanService.ScanResult result = clamAvScanService.scan(Files.readAllBytes(stagingFile));
        if (!result.clean()) {
            log.warn("Upload rejected by virus scan: key={} signature={}", objectKey, result.signatureName());
            throw new VirusRejectedException("The file was rejected by the virus scan");
        }
    }

    /** Records and their evidence go to the locked records bucket; templates go to their own unlocked bucket. */
    static String bucketFor(String recordsBucket, String templatesBucket, StorageDomain domain) {
        return domain.bucketClass() == StorageDomain.BucketClass.TEMPLATES ? templatesBucket : recordsBucket;
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
            // SDS 11.4.2: only when MinIO says this version does not exist is the alias table consulted, and the bytes are checked
            // against the recorded SHA-256 before they are returned.
            if (versionAliases != null && StringUtils.hasText(reference.versionId()) && isNoSuchVersion(ex)) {
                Optional<ObjectVersionAliases.Alias> alias = versionAliases.find(reference.bucket(), reference.objectKey(), reference.versionId());
                if (alias.isPresent()) return openAliased(config, reference, alias.get());
            }
            throw storageException("Failed to read object from MinIO", ex);
        }
    }

    @Autowired(required = false)
    public void setVersionAliases(ObjectVersionAliases versionAliases) {
        this.versionAliases = versionAliases;
    }

    private InputStream openAliased(MinioConfig config, ObjectReference reference, ObjectVersionAliases.Alias alias) throws IOException {
        try (InputStream in = buildClient(config).getObject(GetObjectArgs.builder()
                .bucket(alias.currentBucket() == null ? reference.bucket() : alias.currentBucket()).object(reference.objectKey())
                .versionId(alias.currentVersionId()).build())) {
            return Files.newInputStream(verifiedCopy(in, alias.sha256(), reference.objectKey()));
        } catch (IOException ex) {
            throw ex;
        } catch (Exception ex) {
            throw storageException("Failed to read the aliased object from MinIO", ex);
        }
    }

    /** Copies the bytes to a temporary file while hashing them; refuses (and removes the copy) when the SHA-256 is not the recorded one. */
    static Path verifiedCopy(InputStream in, String expectedSha256, String objectKey) throws IOException {
        Path copy = Files.createTempFile("eqms-alias-", ".bin");
        copy.toFile().deleteOnExit();
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            try (java.io.OutputStream out = Files.newOutputStream(copy); java.security.DigestOutputStream hashing = new java.security.DigestOutputStream(out, digest)) {
                in.transferTo(hashing);
            }
            String actual = HexFormat.of().formatHex(digest.digest());
            if (!actual.equals(expectedSha256)) {
                throw new IOException("Object " + objectKey + " does not match its recorded SHA-256 after restore");
            }
            return copy;
        } catch (IOException ex) {
            Files.deleteIfExists(copy);
            throw ex;
        } catch (NoSuchAlgorithmException ex) {
            Files.deleteIfExists(copy);
            throw new IOException("SHA-256 is not available", ex);
        }
    }

    /** True when MinIO answers that the requested version does not exist (its error code is NoSuchVersion). */
    static boolean isNoSuchVersion(Exception ex) {
        return ex instanceof io.minio.errors.ErrorResponseException e && e.errorResponse() != null
                && "NoSuchVersion".equals(e.errorResponse().code());
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
        ensureBucket(client, config.bucket(), config.retentionYears(), true);
        ensureBucket(client, config.templatesBucket(), config.retentionYears(), false);
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

    /** Measures all object versions from the configured buckets; an incomplete scan is never returned. */
    public StorageUsageAccumulator.Usage measureObjectUsage() throws IOException {
        if (!enabled) throw new IOException("MinIO is disabled");
        JsonNode integrations = systemConfigurationService.requireConfiguration().getIntegrationsConfig();
        JsonNode storage = integrations == null ? null : integrations.get("storage");
        MinioConfig config = resolveConfig(storage);
        MinioClient client = buildClient(config);
        Map<String, String> prefixes = new java.util.LinkedHashMap<>();
        for (StorageDomain domain : StorageDomain.values()) {
            prefixes.put(domain.prefix(), domain.prefix());
        }
        var accumulator = new StorageUsageAccumulator(prefixes);
        try {
            for (String bucket : new java.util.LinkedHashSet<>(java.util.List.of(config.bucket(), config.templatesBucket()))) {
                for (Result<Item> result : client.listObjects(ListObjectsArgs.builder().bucket(bucket).recursive(true).includeVersions(true).build())) {
                    Item item = result.get();
                    if (!item.isDir()) accumulator.add(item.objectName(), item.size(), item.isDeleteMarker());
                }
            }
            return accumulator.snapshot();
        } catch (Exception ex) {
            throw storageException("Unable to measure all MinIO object versions", ex);
        }
    }

    public boolean isMinioUri(String value) {
        return StringUtils.hasText(value) && value.trim().toLowerCase().startsWith(URI_PREFIX);
    }

    /** Object Lock can only be switched on when a bucket is created, so the flag is decided per bucket. */
    private synchronized void ensureBucket(MinioClient client, String bucket, int retentionYears, boolean locked) throws IOException {
        try {
            boolean exists = client.bucketExists(BucketExistsArgs.builder().bucket(bucket).build());
            if (!exists) {
                client.makeBucket(MakeBucketArgs.builder().bucket(bucket).objectLock(locked).build());
            }
            if (locked) {
                enableVersioningAndLock(client, bucket, retentionYears);
            } else {
                client.setBucketVersioning(
                        SetBucketVersioningArgs.builder()
                                .bucket(bucket)
                                .config(new VersioningConfiguration(VersioningConfiguration.Status.ENABLED, Boolean.FALSE))
                                .build()
                );
            }
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
        if (OnlyOfficeConfigurationService.SECRET_MASK.equals(secretKey)) {
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
        String templatesBucket = firstText(storageNode, "minioTemplatesBucket", "templatesBucket");
        if (!StringUtils.hasText(templatesBucket)) {
            templatesBucket = defaultTemplatesBucket;
        }
        int retentionYears = resolveRetentionYears(storageNode);

        // The effective bucket can come from the database (Integration Settings), so the environment rule is checked here, on
        // every use, and not only at startup: a database copied from another environment must not write into that
        // environment's store.
        DeploymentEnvironment deploymentEnvironment = DeploymentEnvironment.parse(environmentName);
        deploymentEnvironment.requireBucketAllowed(bucket, "records");
        deploymentEnvironment.requireBucketAllowed(templatesBucket, "templates");

        return new MinioConfig(
                requireValue(endpoint, "MinIO endpoint"),
                requireValue(accessKey, "MinIO access key"),
                requireValue(secretKey, "MinIO secret key"),
                requireValue(bucket, "MinIO bucket"),
                requireValue(templatesBucket, "MinIO templates bucket"),
                retentionYears
        );
    }

    private MinioConfig resolveDefaultConfig() {
        return new MinioConfig(
                defaultEndpoint,
                defaultAccessKey,
                defaultSecretKey,
                defaultBucket,
                defaultTemplatesBucket,
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
        return clampRetentionYears(value.asInt(defaultRetentionYears));
    }

    static int clampRetentionYears(int years) {
        return Math.min(Math.max(years, 1), MAX_RETENTION_YEARS);
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
                                new RetentionDurationYears(clampRetentionYears(retentionYears))
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
                || years.duration() < clampRetentionYears(retentionYears)) {
            throw new IllegalStateException(
                    "Object Lock retention is shorter than the configured " + clampRetentionYears(retentionYears) + " year(s)"
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
