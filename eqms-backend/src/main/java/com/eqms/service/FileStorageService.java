package com.eqms.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.eqms.entity.ControlledCopyRecord;
import org.codelibs.jcifs.smb.CIFSContext;
import org.codelibs.jcifs.smb.config.PropertyConfiguration;
import org.codelibs.jcifs.smb.context.BaseContext;
import org.codelibs.jcifs.smb.impl.NtlmPasswordAuthenticator;
import org.codelibs.jcifs.smb.impl.SmbFile;
import org.codelibs.jcifs.smb.impl.SmbFileOutputStream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.Properties;
import java.util.UUID;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

@Service
public class FileStorageService {

    public record StorageWriteResult(
            Path localPath,
            String storedPath,
            String provider,
            String bucket,
            String objectKey,
            String versionId,
            String checksum
    ) {
    }

    private record NasCredentials(String domain, String username, String password) {
    }

    private static final Logger log = LoggerFactory.getLogger(FileStorageService.class);
    private static final Path LOCAL_STORAGE_ROOT = Paths.get(System.getProperty("user.dir"), "storage", "revisions");
    private static final Path NAS_STAGE_ROOT = Paths.get(System.getProperty("user.dir"), "storage", "nas-stage");
    private static final Path CONTROLLED_COPY_ROOT = Paths.get(System.getProperty("user.dir"), "storage", "controlled-copies", "files");
    private static final Path CONTROLLED_COPY_STAGE_ROOT = Paths.get(System.getProperty("user.dir"), "storage", "nas-stage", "controlled-copies", "files");
    private static final Path CONTROLLED_COPY_EVIDENCE_ROOT = Paths.get(System.getProperty("user.dir"), "storage", "controlled-copies", "evidence");
    private static final Path CONTROLLED_COPY_EVIDENCE_STAGE_ROOT = Paths.get(System.getProperty("user.dir"), "storage", "nas-stage", "controlled-copies", "evidence");
    private static final Path PERSONNEL_CERTIFICATION_ROOT = Paths.get(System.getProperty("user.dir"), "storage", "personnel", "certifications");

    private final SystemConfigurationService systemConfigurationService;
    private final MinioObjectStorageService minioObjectStorageService;
    private final StoragePathBuilder storagePathBuilder;

    public FileStorageService(
            SystemConfigurationService systemConfigurationService,
            MinioObjectStorageService minioObjectStorageService,
            StoragePathBuilder storagePathBuilder
    ) {
        this.systemConfigurationService = systemConfigurationService;
        this.minioObjectStorageService = minioObjectStorageService;
        this.storagePathBuilder = storagePathBuilder;
    }

    public StorageWriteResult storeFile(UUID revisionId, String originalName, InputStream contentStream) throws IOException {
        return storeFile(revisionId, originalName, contentStream, null, null);
    }

    public StorageWriteResult storeFile(UUID revisionId, String originalName, InputStream contentStream,
                                        String documentNumber, String revisionNumber) throws IOException {
        JsonNode storageConfig = getStorageConfig();
        String provider = storageConfig.path("provider").asText("local");

        if (isMinioProvider(provider)) {
            // Revision files must never use revisionNumber as their physical folder key.
            // The number can be promoted (for example 0.0.1 -> 1.0.0) while the record,
            // checksum chain and Office Online workspace must remain immutable. Keep this
            // overload safe for any older caller that has already supplied a revision ID.
            if (revisionId != null) {
                return storeRevisionSourceFile(revisionId, originalName, contentStream, documentNumber, revisionNumber);
            }
            // Compatibility fallback for retired callers that do not have a revision record.
            // Production revision workflows use storeRevisionSourceFile above.
            String relativeKey = storagePathBuilder.revisionSource(storageConfig, documentNumber, revisionNumber, originalName);
            MinioObjectStorageService.StoredObject stored = minioObjectStorageService.store(
                    storageConfig,
                    relativeKey,
                    contentStream,
                    "application/octet-stream"
            );
            return new StorageWriteResult(
                    stored.localPath(),
                    stored.uri(),
                    "minio",
                    stored.bucket(),
                    stored.objectKey(),
                    stored.versionId(),
                    stored.sha256()
            );
        }

        String storedFileName = UUID.randomUUID() + "_" + storagePathBuilder.sanitizeFileName(originalName);
        if ("nas".equalsIgnoreCase(provider)) {
            return storeNasArtifact(storageConfig, revisionId, storedFileName, contentStream, false, LOCAL_STORAGE_ROOT, NAS_STAGE_ROOT);
        }

        Path targetDir = resolveLocalTargetDirectory(storageConfig, provider, revisionId, LOCAL_STORAGE_ROOT, NAS_STAGE_ROOT, "documents");
        Files.createDirectories(targetDir);
        Path targetFile = targetDir.resolve(storedFileName);
        Files.copy(contentStream, targetFile, StandardCopyOption.REPLACE_EXISTING);
        return localResult(targetFile, provider);
    }

    public StorageWriteResult storeRevisionSourceFile(UUID revisionId, String originalName, InputStream contentStream,
                                                      String documentNumber, String revisionNumber) throws IOException {
        JsonNode storageConfig = getStorageConfig();
        String relativeKey = storagePathBuilder.revisionSourceV2(storageConfig, documentNumber, revisionId, originalName);
        return storeInMinio(storageConfig, relativeKey, contentStream, "application/octet-stream");
    }

    /** Stores a report artifact at a caller-supplied immutable key. Report runs never overwrite this key. */
    public StorageWriteResult storeReportArtifact(String relativeObjectKey, InputStream contentStream, String contentType) throws IOException {
        JsonNode storageConfig = getStorageConfig();
        String provider = storageConfig.path("provider").asText("local");
        String safeKey = relativeObjectKey == null ? UUID.randomUUID().toString() : relativeObjectKey.replace('\\', '/').replace("..", "");
        if (isMinioProvider(provider)) {
            return storeInMinio(storageConfig, safeKey, contentStream, contentType);
        }
        Path target = Paths.get(System.getProperty("user.dir"), "storage", "reports").resolve(safeKey).normalize();
        Path root = Paths.get(System.getProperty("user.dir"), "storage", "reports").normalize();
        if (!target.startsWith(root)) throw new IOException("Invalid report artifact path");
        Files.createDirectories(target.getParent());
        Files.copy(contentStream, target, StandardCopyOption.REPLACE_EXISTING);
        return localResult(target, provider);
    }

    public byte[] readReportArtifact(String provider, String objectKey) throws IOException {
        try (InputStream input = openStoredFile(objectKey)) {
            return input.readAllBytes();
        }
    }

    public void deleteReportArtifact(String objectKey) throws IOException {
        deleteStoredFile(objectKey);
    }

    public StorageWriteResult storePreviewFile(UUID revisionId, String originalName, InputStream contentStream) throws IOException {
        return storePreviewFile(revisionId, originalName, contentStream, null, null);
    }

    public StorageWriteResult storePreviewFile(UUID revisionId, String originalName, InputStream contentStream,
                                               String documentNumber, String revisionNumber) throws IOException {
        JsonNode storageConfig = getStorageConfig();
        String provider = storageConfig.path("provider").asText("local");

        if (isMinioProvider(provider)) {
            String relativeKey = storagePathBuilder.revisionReviewPdfV2(storageConfig, documentNumber, revisionId);
            MinioObjectStorageService.StoredObject stored = minioObjectStorageService.store(
                    storageConfig,
                    relativeKey,
                    contentStream,
                    "application/pdf"
            );
            return new StorageWriteResult(
                    stored.localPath(),
                    stored.uri(),
                    "minio",
                    stored.bucket(),
                    stored.objectKey(),
                    stored.versionId(),
                    stored.sha256()
            );
        }

        if ("nas".equalsIgnoreCase(provider)) {
            return storeNasArtifact(storageConfig, revisionId, originalName, contentStream, true, LOCAL_STORAGE_ROOT, NAS_STAGE_ROOT);
        }

        Path targetDir = resolveLocalTargetDirectory(storageConfig, provider, revisionId, LOCAL_STORAGE_ROOT, NAS_STAGE_ROOT, "documents");
        Files.createDirectories(targetDir);
        Path previewFile = targetDir.resolve("preview.pdf");
        Files.copy(contentStream, previewFile, StandardCopyOption.REPLACE_EXISTING);
        return localResult(previewFile, provider);
    }

    public StorageWriteResult storeRevisionPreviewFile(UUID revisionId, String originalName, InputStream contentStream,
                                                       String documentNumber, String revisionNumber) throws IOException {
        JsonNode storageConfig = getStorageConfig();
        String relativeKey = storagePathBuilder.revisionReviewPdfV2(storageConfig, documentNumber, revisionId);
        return storeInMinio(storageConfig, relativeKey, contentStream, "application/pdf");
    }

    public StorageWriteResult storeRevisionPublishingPreviewFile(UUID revisionId, String originalName, InputStream contentStream,
                                                                 String documentNumber, String revisionNumber) throws IOException {
        JsonNode storageConfig = getStorageConfig();
        String relativeKey = storagePathBuilder.revisionPublishingPreviewPdfV2(storageConfig, documentNumber, revisionId);
        return storeInMinio(storageConfig, relativeKey, contentStream, "application/pdf");
    }

    /**
     * Stores an immutable, per-round review snapshot. Unlike {@link #storeRevisionPublishingPreviewFile(UUID, String, InputStream, String, String)},
     * each call writes to a distinct object key (keyed by review round + snapshot request id) so an
     * earlier round's rendered snapshot is never overwritten — required for the revision_snapshot_history audit trail.
     */
    public StorageWriteResult storeRevisionPublishingPreviewFile(UUID revisionId, String originalName, InputStream contentStream,
                                                                 String documentNumber, String revisionNumber,
                                                                 int reviewRound, UUID snapshotId) throws IOException {
        JsonNode storageConfig = getStorageConfig();
        String baseKey = storagePathBuilder.revisionPublishingPreviewPdfV2(storageConfig, documentNumber, revisionId);
        String suffix = "-round" + reviewRound + "-" + (snapshotId == null ? UUID.randomUUID() : snapshotId);
        String relativeKey = appendSuffixBeforeExtension(baseKey, suffix);
        return storeInMinio(storageConfig, relativeKey, contentStream, "application/pdf");
    }

    private String appendSuffixBeforeExtension(String path, String suffix) {
        if (path == null) {
            return suffix;
        }
        int dot = path.lastIndexOf('.');
        int slash = path.lastIndexOf('/');
        if (dot > slash) {
            return path.substring(0, dot) + suffix + path.substring(dot);
        }
        return path + suffix;
    }

    public StorageWriteResult storeRevisionPublishedPdf(UUID revisionId, String originalName, InputStream contentStream,
                                                        String documentNumber, String revisionNumber) throws IOException {
        JsonNode storageConfig = getStorageConfig();
        String relativeKey = storagePathBuilder.revisionPublishedPdfV2(storageConfig, documentNumber, revisionId);
        return storeInMinio(storageConfig, relativeKey, contentStream, "application/pdf");
    }

    public StorageWriteResult storePublishingTemplateAsset(UUID templateId, int templateVersion, String componentType, String layout, InputStream contentStream, String fileName) throws IOException {
        JsonNode storageConfig = getStorageConfig();
        String relativeKey = storagePathBuilder.publishingComponentTemplateV2(
                storageConfig, templateId, templateVersion, componentType, layout, fileName);
        String normalized = fileName == null ? "" : fileName.toLowerCase();
        String contentType = normalized.endsWith(".pdf") ? "application/pdf"
                : normalized.endsWith(".png") ? "image/png"
                : normalized.endsWith(".jpg") || normalized.endsWith(".jpeg") ? "image/jpeg"
                : normalized.endsWith(".gif") ? "image/gif"
                : normalized.endsWith(".webp") ? "image/webp"
                : normalized.endsWith(".svg") ? "image/svg+xml"
                : "application/octet-stream";
        return storeInMinio(storageConfig, relativeKey, contentStream, contentType);
    }

    public StorageWriteResult storeControlledCopyEvidence(UUID controlledCopyId, String originalName, InputStream contentStream) throws IOException {
        return storeControlledCopyEvidence((ControlledCopyRecord) null, controlledCopyId, originalName, contentStream);
    }

    public StorageWriteResult storeControlledCopyEvidence(ControlledCopyRecord copy, String originalName, InputStream contentStream) throws IOException {
        return storeControlledCopyEvidence(copy, copy == null ? null : copy.getId(), originalName, contentStream);
    }

    private StorageWriteResult storeControlledCopyEvidence(ControlledCopyRecord copy, UUID controlledCopyId, String originalName, InputStream contentStream) throws IOException {
        JsonNode storageConfig = getStorageConfig();
        String provider = storageConfig.path("provider").asText("local");
        String storedFileName = UUID.randomUUID() + "_" + storagePathBuilder.sanitizeFileName(originalName);
        String batchNumber = copy != null && copy.getDistributionBatch() != null ? copy.getDistributionBatch().getBatchNumber() : null;
        String controlledCopyNumber = copy == null ? null : copy.getControlledCopyNumber();

        if (isMinioProvider(provider)) {
            String legacyControlledCopyId = String.valueOf(controlledCopyId == null ? UUID.randomUUID() : controlledCopyId);
            MinioObjectStorageService.StoredObject stored = minioObjectStorageService.store(
                    storageConfig,
                    StringUtils.hasText(batchNumber) && StringUtils.hasText(controlledCopyNumber)
                            ? storagePathBuilder.controlledCopyEvidenceV2(storageConfig, batchNumber, controlledCopyNumber, controlledCopyId, originalName)
                            : storagePathBuilder.legacyControlledCopyEvidence(legacyControlledCopyId, originalName),
                    contentStream,
                    "application/octet-stream"
            );
            return new StorageWriteResult(
                    stored.localPath(),
                    stored.uri(),
                    "minio",
                    stored.bucket(),
                    stored.objectKey(),
                    stored.versionId(),
                    stored.sha256()
            );
        }

        if ("nas".equalsIgnoreCase(provider)) {
            return storeNasArtifact(storageConfig, controlledCopyId, storedFileName, contentStream, false, CONTROLLED_COPY_EVIDENCE_ROOT, CONTROLLED_COPY_EVIDENCE_STAGE_ROOT);
        }

        Path targetDir = resolveLocalTargetDirectory(storageConfig, provider, controlledCopyId, CONTROLLED_COPY_EVIDENCE_ROOT, CONTROLLED_COPY_EVIDENCE_STAGE_ROOT, "controlled-copies/evidence");
        Files.createDirectories(targetDir);
        Path targetFile = targetDir.resolve(storedFileName);
        Files.copy(contentStream, targetFile, StandardCopyOption.REPLACE_EXISTING);
        return localResult(targetFile, provider);
    }

    /**
     * Personnel certification attachments (e.g. a scanned certificate PDF) are not GMP document
     * revisions, so they deliberately skip the WORM/revision-immutability machinery above — a
     * simple MinIO-or-local store keyed by user+certification is sufficient here.
     */
    public StorageWriteResult storeUserCertificationFile(UUID userId, UUID certificationId, String originalName, InputStream contentStream) throws IOException {
        JsonNode storageConfig = getStorageConfig();
        String provider = storageConfig.path("provider").asText("local");
        String storedFileName = UUID.randomUUID() + "_" + storagePathBuilder.sanitizeFileName(originalName);

        if (isMinioProvider(provider)) {
            String relativeKey = "personnel/certifications/" + userId + "/" + certificationId + "/" + storedFileName;
            MinioObjectStorageService.StoredObject stored = minioObjectStorageService.store(
                    storageConfig, relativeKey, contentStream, "application/octet-stream");
            return new StorageWriteResult(
                    stored.localPath(), stored.uri(), "minio", stored.bucket(), stored.objectKey(), stored.versionId(), stored.sha256());
        }

        Path targetDir = PERSONNEL_CERTIFICATION_ROOT.resolve(userId.toString()).resolve(certificationId.toString());
        Files.createDirectories(targetDir);
        Path targetFile = targetDir.resolve(storedFileName);
        Files.copy(contentStream, targetFile, StandardCopyOption.REPLACE_EXISTING);
        return localResult(targetFile, provider);
    }

    public StorageWriteResult storeControlledCopyPdf(UUID controlledCopyId, InputStream contentStream) throws IOException {
        return storeControlledCopyPdf((ControlledCopyRecord) null, controlledCopyId, contentStream);
    }

    public StorageWriteResult storeControlledCopyPdf(ControlledCopyRecord copy, InputStream contentStream) throws IOException {
        return storeControlledCopyPdf(copy, copy == null ? null : copy.getId(), contentStream);
    }

    private StorageWriteResult storeControlledCopyPdf(ControlledCopyRecord copy, UUID controlledCopyId, InputStream contentStream) throws IOException {
        JsonNode storageConfig = getStorageConfig();
        String provider = storageConfig.path("provider").asText("local");
        String storedFileName = "controlled-copy.pdf";
        String batchNumber = copy != null && copy.getDistributionBatch() != null ? copy.getDistributionBatch().getBatchNumber() : null;
        String controlledCopyNumber = copy == null ? null : copy.getControlledCopyNumber();

        if (isMinioProvider(provider)) {
            String legacyControlledCopyId = String.valueOf(controlledCopyId == null ? UUID.randomUUID() : controlledCopyId);
            MinioObjectStorageService.StoredObject stored = minioObjectStorageService.store(
                    storageConfig,
                    StringUtils.hasText(batchNumber) && StringUtils.hasText(controlledCopyNumber)
                            ? storagePathBuilder.controlledCopyPdfV2(storageConfig, batchNumber, controlledCopyNumber, controlledCopyId)
                            : storagePathBuilder.legacyControlledCopyPdf(legacyControlledCopyId),
                    contentStream,
                    "application/pdf"
            );
            return new StorageWriteResult(
                    stored.localPath(),
                    stored.uri(),
                    "minio",
                    stored.bucket(),
                    stored.objectKey(),
                    stored.versionId(),
                    stored.sha256()
            );
        }

        if ("nas".equalsIgnoreCase(provider)) {
            return storeNasArtifact(storageConfig, controlledCopyId, storedFileName, contentStream, true, CONTROLLED_COPY_ROOT, CONTROLLED_COPY_STAGE_ROOT);
        }

        Path targetDir = resolveLocalTargetDirectory(storageConfig, provider, controlledCopyId, CONTROLLED_COPY_ROOT, CONTROLLED_COPY_STAGE_ROOT, "controlled-copies");
        Files.createDirectories(targetDir);
        Path targetFile = targetDir.resolve(storedFileName);
        Files.copy(contentStream, targetFile, StandardCopyOption.REPLACE_EXISTING);
        return localResult(targetFile, provider);
    }

    private StorageWriteResult storeInMinio(JsonNode storageConfig, String relativeKey, InputStream contentStream, String contentType) throws IOException {
        MinioObjectStorageService.StoredObject stored = minioObjectStorageService.store(
                storageConfig,
                relativeKey,
                contentStream,
                contentType
        );
        return new StorageWriteResult(
                stored.localPath(),
                stored.uri(),
                "minio",
                stored.bucket(),
                stored.objectKey(),
                stored.versionId(),
                stored.sha256()
        );
    }

    public StorageWriteResult storePublishingTemplatePreviewAsset(UUID templateId, int templateVersion, String componentType, String layout, InputStream contentStream) throws IOException {
        JsonNode storageConfig = getStorageConfig();
        String relativeKey = storagePathBuilder.publishingComponentPreviewTemplateV2(
                storageConfig, templateId, templateVersion, componentType, layout);
        return storeInMinio(storageConfig, relativeKey, contentStream, "application/pdf");
    }

    public Path resolvePath(UUID revisionId, String storedFileName) {
        JsonNode storageConfig = getStorageConfig();
        String provider = storageConfig.path("provider").asText("local");

        if ("nas".equalsIgnoreCase(provider)) {
            String nasPath = resolveNasPath(storageConfig);
            if (StringUtils.hasText(nasPath)) {
                if (isSmbReference(nasPath)) {
                    return NAS_STAGE_ROOT.resolve(revisionId.toString()).resolve(storedFileName);
                }
                return Paths.get(nasPath).resolve(revisionId.toString()).resolve(storedFileName);
            }
            return NAS_STAGE_ROOT.resolve(revisionId.toString()).resolve(storedFileName);
        } else if ("aws-s3".equalsIgnoreCase(provider)) {
            String bucket = storageConfig.path("bucketName").asText("default-bucket");
            String basePath = storageConfig.path("basePath").asText("documents");
            return Paths.get(System.getProperty("user.dir"), "storage", "s3", bucket, basePath, revisionId.toString()).resolve(storedFileName);
        } else if ("azure-blob".equalsIgnoreCase(provider)) {
            String container = storageConfig.path("bucketName").asText("default-container");
            String basePath = storageConfig.path("basePath").asText("documents");
            return Paths.get(System.getProperty("user.dir"), "storage", "azure-blob", container, basePath, revisionId.toString()).resolve(storedFileName);
        } else if ("google-cloud".equalsIgnoreCase(provider)) {
            String bucket = storageConfig.path("bucketName").asText("default-bucket");
            String basePath = storageConfig.path("basePath").asText("documents");
            return Paths.get(System.getProperty("user.dir"), "storage", "gcs", bucket, basePath, revisionId.toString()).resolve(storedFileName);
        } else if ("google-drive".equalsIgnoreCase(provider)) {
            String folderId = storageConfig.path("googleDriveFolderId").asText("default-folder");
            return Paths.get(System.getProperty("user.dir"), "storage", "google-drive", folderId, revisionId.toString()).resolve(storedFileName);
        } else if ("onedrive".equalsIgnoreCase(provider)) {
            String driveId = storageConfig.path("msDriveId").asText("default-drive");
            String libraryFolder = storageConfig.path("msLibraryFolder").asText("documents");
            return Paths.get(System.getProperty("user.dir"), "storage", "onedrive", driveId, libraryFolder, revisionId.toString()).resolve(storedFileName);
        } else if ("sharepoint".equalsIgnoreCase(provider)) {
            String siteId = storageConfig.path("msSiteId").asText("default-site");
            String driveId = storageConfig.path("msDriveId").asText("default-drive");
            String libraryFolder = storageConfig.path("msLibraryFolder").asText("documents");
            return Paths.get(System.getProperty("user.dir"), "storage", "sharepoint", siteId, driveId, libraryFolder, revisionId.toString()).resolve(storedFileName);
        } else if ("dropbox".equalsIgnoreCase(provider)) {
            String folderPath = storageConfig.path("dropboxFolderPath").asText("documents");
            String cleanFolder = sanitizeFolderPath(folderPath);
            return Paths.get(System.getProperty("user.dir"), "storage", "dropbox", cleanFolder, revisionId.toString()).resolve(storedFileName);
        }

        return LOCAL_STORAGE_ROOT.resolve(revisionId.toString()).resolve(storedFileName);
    }

    public byte[] readFile(String pathString) throws IOException {
        return readFile(pathString, null);
    }

    public byte[] readFile(String pathString, String expectedSha256) throws IOException {
        if (!StringUtils.hasText(pathString)) {
            throw new IllegalArgumentException("File path is blank");
        }
        try (InputStream inputStream = openStoredFile(pathString)) {
            byte[] bytes = inputStream.readAllBytes();
            verifyChecksum(bytes, expectedSha256, pathString);
            return bytes;
        }
    }

    public InputStream openStoredFile(String pathString) throws IOException {
        if (!StringUtils.hasText(pathString)) {
            throw new IllegalArgumentException("File path is blank");
        }
        if (minioObjectStorageService.isMinioUri(pathString)) {
            return minioObjectStorageService.open(getStorageConfig(), pathString);
        }
        if (isSmbReference(pathString)) {
            CIFSContext context = createNasContext(getStorageConfig());
            SmbFile smbFile = new SmbFile(normalizeNasReference(pathString), context);
            return smbFile.getInputStream();
        }
        return Files.newInputStream(Paths.get(pathString));
    }

    public Path materializeStoredFile(String pathString) throws IOException {
        if (!StringUtils.hasText(pathString)) {
            throw new IllegalArgumentException("File path is blank");
        }
        if (minioObjectStorageService.isMinioUri(pathString)) {
            return minioObjectStorageService.materialize(getStorageConfig(), pathString);
        }
        if (!isSmbReference(pathString)) {
            return Paths.get(pathString);
        }
        Path tempFile = Files.createTempFile("eqms-nas-", extractSuffix(pathString));
        tempFile.toFile().deleteOnExit();
        try (InputStream inputStream = openStoredFile(pathString)) {
            Files.copy(inputStream, tempFile, StandardCopyOption.REPLACE_EXISTING);
        }
        return tempFile;
    }

    public void cloneFile(String sourcePathString, Path targetPath) throws IOException {
        if (!StringUtils.hasText(sourcePathString)) return;
        Files.createDirectories(targetPath.getParent());
        try (InputStream inputStream = openStoredFile(sourcePathString)) {
            Files.copy(inputStream, targetPath, StandardCopyOption.REPLACE_EXISTING);
        }
    }

    public void uploadLocalFileToNas(Path sourcePath, String remoteReference) throws IOException {
        if (!Files.exists(sourcePath)) {
            throw new IOException("Source file does not exist: " + sourcePath);
        }
        JsonNode storageConfig = getStorageConfig();
        CIFSContext context = createNasContext(storageConfig);
        String normalizedRemote = normalizeNasReference(remoteReference);
        SmbFile remoteFile = new SmbFile(normalizedRemote, context);
        SmbFile remoteParent = new SmbFile(remoteFile.getParent(), context);
        if (!remoteParent.exists()) {
            remoteParent.mkdirs();
        }
        try (InputStream inputStream = Files.newInputStream(sourcePath);
             OutputStream outputStream = new SmbFileOutputStream(remoteFile)) {
            inputStream.transferTo(outputStream);
        }
    }

    public void deleteStoredFile(String pathString) throws IOException {
        if (!StringUtils.hasText(pathString)) {
            return;
        }
        if (minioObjectStorageService.isMinioUri(pathString)) {
            minioObjectStorageService.delete(getStorageConfig(), pathString);
            return;
        }
        if (isSmbReference(pathString)) {
            CIFSContext context = createNasContext(getStorageConfig());
            SmbFile smbFile = new SmbFile(normalizeNasReference(pathString), context);
            if (smbFile.exists()) {
                smbFile.delete();
            }
            return;
        }
        Files.deleteIfExists(Paths.get(pathString));
    }

    public void deleteRevisionStorageDirectory(UUID revisionId) throws IOException {
        if (revisionId == null) {
            return;
        }
        minioObjectStorageService.deletePrefix(getStorageConfig(), revisionId.toString() + "/");
        deleteDirectoryIfExists(LOCAL_STORAGE_ROOT.resolve(revisionId.toString()));
        deleteDirectoryIfExists(NAS_STAGE_ROOT.resolve(revisionId.toString()));
    }

    public boolean isSmbReference(String pathString) {
        if (!StringUtils.hasText(pathString)) {
            return false;
        }
        String normalized = pathString.trim().toLowerCase(Locale.ROOT);
        return normalized.startsWith("smb://") || normalized.startsWith("\\\\") || normalized.startsWith("//");
    }

    private boolean isMinioProvider(String provider) {
        return "minio".equalsIgnoreCase(provider);
    }

    public boolean isMinioReference(String pathString) {
        return minioObjectStorageService.isMinioUri(pathString);
    }

    public void testConnection(JsonNode storageConfig) throws IOException {
        String provider = storageConfig.path("provider").asText("local");

        if ("nas".equalsIgnoreCase(provider)) {
            String nasPath = resolveNasPath(storageConfig);
            if (!StringUtils.hasText(nasPath)) {
                throw new IllegalArgumentException("NAS Host / IP and Shared Folder Name are required");
            }

            if (isSmbReference(nasPath)) {
                String normalizedNasPath = normalizeNasReference(nasPath);
                try {
                    CIFSContext context = createNasContext(storageConfig);
                    SmbFile path = new SmbFile(normalizedNasPath, context);
                    if (!path.exists()) {
                        path.mkdirs();
                    }
                    Path tempFile = Files.createTempFile("eqms-nas-test-", ".tmp");
                    try {
                        Files.writeString(tempFile, "test-connection");
                        String remoteReference = buildNasFolderReference(nasPath, UUID.randomUUID()) + tempFile.getFileName();
                        uploadLocalFileToNas(tempFile, remoteReference);
                    } finally {
                        Files.deleteIfExists(tempFile);
                    }
                } catch (IOException e) {
                    throw explainNasTestFailure(nasPath, storageConfig, e);
                } catch (RuntimeException e) {
                    throw explainNasTestFailure(nasPath, storageConfig, e);
                }
                return;
            }

            Path path = Paths.get(nasPath);
            try {
                if (!Files.exists(path)) {
                    Files.createDirectories(path);
                }
            } catch (Exception e) {
                throw new IOException("Failed to access or create NAS path: " + e.getMessage(), e);
            }
            Path testFile = path.resolve("test_connection_" + UUID.randomUUID() + ".tmp");
            try {
                Files.writeString(testFile, "test-connection");
                Files.deleteIfExists(testFile);
            } catch (Exception e) {
                throw new IOException(buildNasLocalFailureMessage(nasPath, e), e);
            }
            return;
        }

        if (isMinioProvider(provider)) {
            minioObjectStorageService.testConnection(storageConfig);
            return;
        }

        if ("aws-s3".equalsIgnoreCase(provider)) {
            String bucket = storageConfig.path("bucketName").asText("");
            String region = storageConfig.path("region").asText("");
            String accessKeyId = storageConfig.path("accessKeyId").asText("");
            String secretAccessKey = storageConfig.path("secretAccessKey").asText("");
            if (!StringUtils.hasText(bucket)) {
                throw new IllegalArgumentException("Bucket Name is required");
            }
            if (!StringUtils.hasText(region)) {
                throw new IllegalArgumentException("Region is required");
            }
            if (!StringUtils.hasText(accessKeyId)) {
                throw new IllegalArgumentException("Access Key ID is required");
            }
            if (!StringUtils.hasText(secretAccessKey)) {
                throw new IllegalArgumentException("Secret Access Key is required");
            }
            log.info("Testing connection to AWS S3: bucket={}, region={}", bucket, region);
            Path simulatedDir = Paths.get(System.getProperty("user.dir"), "storage", "s3", bucket);
            Files.createDirectories(simulatedDir);
        } else if ("azure-blob".equalsIgnoreCase(provider)) {
            String container = storageConfig.path("bucketName").asText("");
            String accessKeyId = storageConfig.path("accessKeyId").asText("");
            String secretAccessKey = storageConfig.path("secretAccessKey").asText("");
            if (!StringUtils.hasText(container)) {
                throw new IllegalArgumentException("Container Name is required");
            }
            if (!StringUtils.hasText(accessKeyId)) {
                throw new IllegalArgumentException("Storage Account Name (Access Key ID) is required");
            }
            if (!StringUtils.hasText(secretAccessKey)) {
                throw new IllegalArgumentException("Access Key (Secret Access Key) is required");
            }
            log.info("Testing connection to Azure Blob Storage: container={}", container);
            Path simulatedDir = Paths.get(System.getProperty("user.dir"), "storage", "azure-blob", container);
            Files.createDirectories(simulatedDir);
        } else if ("google-cloud".equalsIgnoreCase(provider)) {
            String bucket = storageConfig.path("bucketName").asText("");
            String accessKeyId = storageConfig.path("accessKeyId").asText("");
            String secretAccessKey = storageConfig.path("secretAccessKey").asText("");
            if (!StringUtils.hasText(bucket)) {
                throw new IllegalArgumentException("Bucket Name is required");
            }
            if (!StringUtils.hasText(accessKeyId)) {
                throw new IllegalArgumentException("Client Email (Access Key ID) is required");
            }
            if (!StringUtils.hasText(secretAccessKey)) {
                throw new IllegalArgumentException("Private Key (Secret Access Key) is required");
            }
            log.info("Testing connection to Google Cloud Storage: bucket={}", bucket);
            Path simulatedDir = Paths.get(System.getProperty("user.dir"), "storage", "gcs", bucket);
            Files.createDirectories(simulatedDir);
        } else if ("google-drive".equalsIgnoreCase(provider)) {
            String clientId = storageConfig.path("googleDriveClientId").asText("");
            String clientSecret = storageConfig.path("googleDriveClientSecret").asText("");
            String folderId = storageConfig.path("googleDriveFolderId").asText("");
            if (!StringUtils.hasText(clientId)) {
                throw new IllegalArgumentException("Client ID is required");
            }
            if (!StringUtils.hasText(clientSecret)) {
                throw new IllegalArgumentException("Client Secret is required");
            }
            if (!StringUtils.hasText(folderId)) {
                throw new IllegalArgumentException("Google Drive Folder ID is required");
            }
            log.info("Testing connection to Google Drive: folderId={}", folderId);
            Path simulatedDir = Paths.get(System.getProperty("user.dir"), "storage", "google-drive", folderId);
            Files.createDirectories(simulatedDir);
        } else if ("onedrive".equalsIgnoreCase(provider)) {
            String tenantId = storageConfig.path("msTenantId").asText("");
            String clientId = storageConfig.path("msClientId").asText("");
            String clientSecret = storageConfig.path("msClientSecret").asText("");
            String driveId = storageConfig.path("msDriveId").asText("");
            if (!StringUtils.hasText(tenantId)) {
                throw new IllegalArgumentException("Tenant ID is required");
            }
            if (!StringUtils.hasText(clientId)) {
                throw new IllegalArgumentException("Client ID is required");
            }
            if (!StringUtils.hasText(clientSecret)) {
                throw new IllegalArgumentException("Client Secret is required");
            }
            if (!StringUtils.hasText(driveId)) {
                throw new IllegalArgumentException("Drive ID is required");
            }
            log.info("Testing connection to Microsoft OneDrive: driveId={}", driveId);
            Path simulatedDir = Paths.get(System.getProperty("user.dir"), "storage", "onedrive", driveId);
            Files.createDirectories(simulatedDir);
        } else if ("sharepoint".equalsIgnoreCase(provider)) {
            String tenantId = storageConfig.path("msTenantId").asText("");
            String clientId = storageConfig.path("msClientId").asText("");
            String clientSecret = storageConfig.path("msClientSecret").asText("");
            String siteId = storageConfig.path("msSiteId").asText("");
            String driveId = storageConfig.path("msDriveId").asText("");
            if (!StringUtils.hasText(tenantId)) {
                throw new IllegalArgumentException("Tenant ID is required");
            }
            if (!StringUtils.hasText(clientId)) {
                throw new IllegalArgumentException("Client ID is required");
            }
            if (!StringUtils.hasText(clientSecret)) {
                throw new IllegalArgumentException("Client Secret is required");
            }
            if (!StringUtils.hasText(siteId)) {
                throw new IllegalArgumentException("SharePoint Site ID is required");
            }
            if (!StringUtils.hasText(driveId)) {
                throw new IllegalArgumentException("Drive ID is required");
            }
            log.info("Testing connection to Microsoft SharePoint: siteId={}, driveId={}", siteId, driveId);
            Path simulatedDir = Paths.get(System.getProperty("user.dir"), "storage", "sharepoint", siteId, driveId);
            Files.createDirectories(simulatedDir);
        } else if ("dropbox".equalsIgnoreCase(provider)) {
            String appKey = storageConfig.path("dropboxAppKey").asText("");
            String appSecret = storageConfig.path("dropboxAppSecret").asText("");
            String accessToken = storageConfig.path("dropboxAccessToken").asText("");
            String folderPath = storageConfig.path("dropboxFolderPath").asText("");
            if (!StringUtils.hasText(appKey)) {
                throw new IllegalArgumentException("App Key is required");
            }
            if (!StringUtils.hasText(appSecret)) {
                throw new IllegalArgumentException("App Secret is required");
            }
            if (!StringUtils.hasText(accessToken)) {
                throw new IllegalArgumentException("Access Token is required");
            }
            if (!StringUtils.hasText(folderPath)) {
                throw new IllegalArgumentException("Folder Path is required");
            }
            log.info("Testing connection to Dropbox: folderPath={}", folderPath);
            String cleanFolder = sanitizeFolderPath(folderPath);
            Path simulatedDir = Paths.get(System.getProperty("user.dir"), "storage", "dropbox", cleanFolder);
            Files.createDirectories(simulatedDir);
        } else {
            Path path = LOCAL_STORAGE_ROOT;
            try {
                if (!Files.exists(path)) {
                    Files.createDirectories(path);
                }
            } catch (Exception e) {
                throw new IOException("Failed to access or create local storage root: " + e.getMessage(), e);
            }
            Path testFile = path.resolve("test_connection_" + UUID.randomUUID() + ".tmp");
            try {
                Files.writeString(testFile, "test-connection");
                Files.deleteIfExists(testFile);
            } catch (Exception e) {
                throw new IOException("Local storage directory is read-only or permission denied: " + e.getMessage(), e);
            }
        }
    }

    private StorageWriteResult storeNasArtifact(JsonNode storageConfig, UUID revisionId, String storedFileName, InputStream contentStream, boolean preview, Path localRoot, Path nasStageRoot) throws IOException {
        String nasPath = resolveNasPath(storageConfig);
        if (!StringUtils.hasText(nasPath)) {
            log.warn("NAS storage selected but nasPath is blank. Falling back to local storage.");
            Path targetDir = localRoot.resolve(revisionId.toString());
            Files.createDirectories(targetDir);
            Path fallbackTarget = targetDir.resolve(preview ? "preview.pdf" : storedFileName);
            Files.copy(contentStream, fallbackTarget, StandardCopyOption.REPLACE_EXISTING);
            return localResult(fallbackTarget, "local");
        }

        if (!isSmbReference(nasPath)) {
            Path targetDir = Paths.get(nasPath).resolve(revisionId.toString());
            Files.createDirectories(targetDir);
            Path targetFile = targetDir.resolve(preview ? "preview.pdf" : storedFileName);
            Files.copy(contentStream, targetFile, StandardCopyOption.REPLACE_EXISTING);
            return localResult(targetFile, "nas");
        }

        String folderReference = buildNasFolderReference(nasPath, revisionId);
        String remoteReference = folderReference + (preview ? "preview.pdf" : storedFileName);

        Path stagingDir = nasStageRoot.resolve(revisionId.toString());
        Files.createDirectories(stagingDir);
        Path stagingFile = stagingDir.resolve(preview ? "preview.pdf" : storedFileName);
        Files.copy(contentStream, stagingFile, StandardCopyOption.REPLACE_EXISTING);

        log.info("Uploading {} to NAS path: {}", preview ? "preview" : "file", remoteReference);
        uploadLocalFileToNas(stagingFile, remoteReference);
        return new StorageWriteResult(
                stagingFile.toAbsolutePath(),
                remoteReference,
                "nas",
                null,
                null,
                null,
                null
        );
    }

    private StorageWriteResult localResult(Path path, String provider) {
        Path absolutePath = path.toAbsolutePath();
        return new StorageWriteResult(
                absolutePath,
                absolutePath.toString(),
                StringUtils.hasText(provider) ? provider : "local",
                null,
                null,
                null,
                checksumOfFile(absolutePath)
        );
    }

    private static void verifyChecksum(byte[] bytes, String expectedSha256, String pathString) throws IOException {
        if (!StringUtils.hasText(expectedSha256) || bytes == null) {
            return;
        }
        String actual = sha256(bytes);
        if (!expectedSha256.trim().equalsIgnoreCase(actual)) {
            throw new IOException("Data integrity breach detected for " + pathString);
        }
    }

    private static String checksumOfFile(Path path) {
        if (path == null || !Files.exists(path)) {
            return null;
        }
        try {
            return sha256(Files.readAllBytes(path));
        } catch (IOException ex) {
            return null;
        }
    }

    private static String sha256(byte[] bytes) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(bytes));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is unavailable", ex);
        }
    }

    private Path resolveLocalTargetDirectory(JsonNode storageConfig, String provider, UUID revisionId, Path localRoot, Path nasStageRoot, String defaultBasePath) {
        if ("nas".equalsIgnoreCase(provider)) {
            String nasPath = resolveNasPath(storageConfig);
            if (StringUtils.hasText(nasPath) && !isSmbReference(nasPath)) {
                return Paths.get(nasPath).resolve(revisionId.toString());
            }
            return nasStageRoot.resolve(revisionId.toString());
        }
        if ("aws-s3".equalsIgnoreCase(provider)) {
            String bucket = storageConfig.path("bucketName").asText("default-bucket");
            String basePath = storageConfig.path("basePath").asText(defaultBasePath);
            log.info("Simulating AWS S3 Upload to bucket: {}, base path: {}", bucket, basePath);
            return Paths.get(System.getProperty("user.dir"), "storage", "s3", bucket, basePath, revisionId.toString());
        }
        if ("azure-blob".equalsIgnoreCase(provider)) {
            String container = storageConfig.path("bucketName").asText("default-container");
            String basePath = storageConfig.path("basePath").asText(defaultBasePath);
            log.info("Simulating Azure Blob Upload to container: {}, base path: {}", container, basePath);
            return Paths.get(System.getProperty("user.dir"), "storage", "azure-blob", container, basePath, revisionId.toString());
        }
        if ("google-cloud".equalsIgnoreCase(provider)) {
            String bucket = storageConfig.path("bucketName").asText("default-bucket");
            String basePath = storageConfig.path("basePath").asText(defaultBasePath);
            log.info("Simulating Google Cloud Storage Upload to bucket: {}, base path: {}", bucket, basePath);
            return Paths.get(System.getProperty("user.dir"), "storage", "gcs", bucket, basePath, revisionId.toString());
        }
        if ("google-drive".equalsIgnoreCase(provider)) {
            String folderId = storageConfig.path("googleDriveFolderId").asText("default-folder");
            log.info("Simulating Google Drive Upload to folder: {}", folderId);
            return Paths.get(System.getProperty("user.dir"), "storage", "google-drive", folderId, revisionId.toString());
        }
        if ("onedrive".equalsIgnoreCase(provider)) {
            String driveId = storageConfig.path("msDriveId").asText("default-drive");
            String libraryFolder = storageConfig.path("msLibraryFolder").asText("documents");
            log.info("Simulating Microsoft OneDrive Upload to drive: {}, library folder: {}", driveId, libraryFolder);
            return Paths.get(System.getProperty("user.dir"), "storage", "onedrive", driveId, libraryFolder, revisionId.toString());
        }
        if ("sharepoint".equalsIgnoreCase(provider)) {
            String siteId = storageConfig.path("msSiteId").asText("default-site");
            String driveId = storageConfig.path("msDriveId").asText("default-drive");
            String libraryFolder = storageConfig.path("msLibraryFolder").asText("documents");
            log.info("Simulating Microsoft SharePoint Upload to site: {}, drive: {}, library folder: {}", siteId, driveId, libraryFolder);
            return Paths.get(System.getProperty("user.dir"), "storage", "sharepoint", siteId, driveId, libraryFolder, revisionId.toString());
        }
        if ("dropbox".equalsIgnoreCase(provider)) {
            String folderPath = storageConfig.path("dropboxFolderPath").asText("documents");
            String cleanFolder = sanitizeFolderPath(folderPath);
            log.info("Simulating Dropbox Upload to folder path: {}", folderPath);
            return Paths.get(System.getProperty("user.dir"), "storage", "dropbox", cleanFolder, revisionId.toString());
        }
        return localRoot.resolve(revisionId.toString());
    }

    private CIFSContext createNasContext(JsonNode storageConfig) throws IOException {
        Properties props = new Properties();
        props.setProperty("jcifs.smb.client.minVersion", "SMB202");
        props.setProperty("jcifs.smb.client.maxVersion", "SMB311");
        CIFSContext baseContext = new BaseContext(new PropertyConfiguration(props));
        NasCredentials credentials = resolveNasCredentials(storageConfig);
        if (credentials == null || (!StringUtils.hasText(credentials.username()) && !StringUtils.hasText(credentials.password()))) {
            return baseContext;
        }
        return baseContext.withCredentials(new NtlmPasswordAuthenticator(
                StringUtils.hasText(credentials.domain()) ? credentials.domain() : "",
                StringUtils.hasText(credentials.username()) ? credentials.username() : "",
                StringUtils.hasText(credentials.password()) ? credentials.password() : ""
        ));
    }

    private IOException explainNasTestFailure(String nasPath, JsonNode storageConfig, Exception exception) {
        String message = buildNasConnectionFailureMessage(nasPath, storageConfig, exception);
        return new IOException(message, exception);
    }

    private String buildNasConnectionFailureMessage(String nasPath, JsonNode storageConfig, Throwable throwable) {
        String normalizedMessage = extractRootMessage(throwable);
        String credentialHint = buildNasCredentialHint(storageConfig);
        String smbHint = "For SMB paths, verify that the share is reachable from the backend host and that the user has Read/Write access.";

        String lower = normalizedMessage.toLowerCase(Locale.ROOT);
        if (lower.contains("access is denied") || lower.contains("status_access_denied") || lower.contains("logon failure")) {
            return "Access is denied. Check the username/password, domain format, and share permissions. "
                    + smbHint + credentialHint + " Share path: " + nasPath;
        }
        if (lower.contains("network name cannot be found") || lower.contains("host is down") || lower.contains("connection refused")
                || lower.contains("unable to reach") || lower.contains("no route to host") || lower.contains("timeout")) {
            return "Network error while reaching the SMB share. Verify the NAS IP/hostname, SMB service, firewall, and port 445 accessibility. "
                    + smbHint + " Share path: " + nasPath;
        }
        if (lower.contains("bad network name") || lower.contains("not found") || lower.contains("path not found")) {
            return "The share path was not found. Verify the share name and path format (for example, \\\\server\\share). "
                    + smbHint + " Share path: " + nasPath;
        }
        if (lower.contains("unsupported") || lower.contains("protocol") || lower.contains("smb1")) {
            return "SMB protocol mismatch. Verify the NAS SMB version settings and allowed client protocol range. "
                    + smbHint + " Share path: " + nasPath;
        }
        return normalizedMessage + ". " + smbHint + credentialHint + " Share path: " + nasPath;
    }

    private String buildNasLocalFailureMessage(String nasPath, Throwable throwable) {
        String normalizedMessage = extractRootMessage(throwable);
        String lower = normalizedMessage.toLowerCase(Locale.ROOT);
        if (lower.contains("access is denied") || lower.contains("permission denied")) {
            return "NAS directory is read-only or permission denied. Verify folder ACLs and the SMB user permissions. Share path: " + nasPath;
        }
        if (lower.contains("not found")) {
            return "NAS directory was not found. Verify the share path. Share path: " + nasPath;
        }
        return normalizedMessage + ". Share path: " + nasPath;
    }

    private String buildNasCredentialHint(JsonNode storageConfig) {
        String username = storageConfig.path("nasUsername").asText("");
        String domain = storageConfig.path("nasDomain").asText("");
        if (!StringUtils.hasText(username) && !StringUtils.hasText(domain)) {
            return " No SMB credentials were provided.";
        }
        if (StringUtils.hasText(domain)) {
            return " Current domain: " + domain.trim() + ".";
        }
        return " Username format can be DOMAIN\\\\user, user@domain, or a local NAS account.";
    }

    private String extractRootMessage(Throwable throwable) {
        Throwable current = throwable;
        String lastMessage = throwable.getMessage();
        while (current.getCause() != null && current.getCause() != current) {
            current = current.getCause();
            if (current.getMessage() != null && !current.getMessage().isBlank()) {
                lastMessage = current.getMessage();
            }
        }
        if (lastMessage == null || lastMessage.isBlank()) {
            return throwable.getClass().getSimpleName();
        }
        return lastMessage.trim();
    }

    private NasCredentials resolveNasCredentials(JsonNode storageConfig) {
        String rawUsername = storageConfig.path("nasUsername").asText("");
        String password = storageConfig.path("nasPassword").asText("");
        if (!StringUtils.hasText(rawUsername) && !StringUtils.hasText(password)) {
            return null;
        }

        String domain = "";
        String username = rawUsername;
        String normalized = rawUsername.trim();

        if (normalized.contains("\\")) {
            String[] parts = normalized.split("\\\\", 2);
            if (parts.length == 2) {
                domain = parts[0].trim();
                username = parts[1].trim();
            }
        } else if (normalized.contains("/")) {
            String[] parts = normalized.split("/", 2);
            if (parts.length == 2) {
                domain = parts[0].trim();
                username = parts[1].trim();
            }
        } else if (normalized.contains("@")) {
            String[] parts = normalized.split("@", 2);
            if (parts.length == 2) {
                username = parts[0].trim();
                domain = parts[1].trim();
            }
        }

        String explicitDomain = storageConfig.path("nasDomain").asText("");
        if (StringUtils.hasText(explicitDomain)) {
            domain = explicitDomain.trim();
        }

        return new NasCredentials(domain, username, password);
    }

    private String resolveNasPath(JsonNode storageConfig) {
        String host = storageConfig.path("nasHost").asText("");
        String shareName = storageConfig.path("nasShareName").asText("");
        String resolvedFromParts = buildNasUncPath(host, shareName);
        if (StringUtils.hasText(resolvedFromParts)) {
            return resolvedFromParts;
        }

        String nasPath = storageConfig.path("nasPath").asText("");
        if (StringUtils.hasText(nasPath)) {
            return nasPath.trim();
        }
        return "";
    }

    private String buildNasUncPath(String host, String shareName) {
        if (!StringUtils.hasText(host) || !StringUtils.hasText(shareName)) {
            return "";
        }
        String cleanedHost = host.trim().replaceAll("^\\\\+", "").replaceAll("^smb://", "").replaceAll("[\\\\/]+$", "");
        String cleanedShare = shareName.trim().replaceAll("^[\\\\/]+", "").replaceAll("[\\\\/]+$", "");
        if (!StringUtils.hasText(cleanedHost) || !StringUtils.hasText(cleanedShare)) {
            return "";
        }
        return "\\\\" + cleanedHost + "\\" + cleanedShare;
    }

    private String buildNasFolderReference(String nasPath, UUID revisionId) {
        String base = normalizeNasReference(nasPath);
        if (!base.endsWith("/")) {
            base = base + "/";
        }
        return base + revisionId + "/";
    }

    private String normalizeNasReference(String pathString) {
        String trimmed = pathString.trim();
        if (trimmed.toLowerCase(Locale.ROOT).startsWith("smb://")) {
            return trimmed.endsWith("/") ? trimmed : trimmed + "/";
        }
        if (trimmed.startsWith("\\\\")) {
            String converted = trimmed.substring(2).replace('\\', '/');
            return "smb://" + converted.replaceAll("/+", "/") + (converted.endsWith("/") ? "" : "/");
        }
        if (trimmed.startsWith("//")) {
            String converted = trimmed.substring(2).replace('\\', '/');
            return "smb://" + converted.replaceAll("/+", "/") + (converted.endsWith("/") ? "" : "/");
        }
        return trimmed;
    }

    private String sanitizeFolderPath(String folderPath) {
        return folderPath.replace("/", "_").replace("\\", "_").replace(":", "_");
    }

    private void deleteDirectoryIfExists(Path directory) throws IOException {
        if (directory == null || !Files.exists(directory)) {
            return;
        }
        try (var walk = Files.walk(directory)) {
            walk.sorted((left, right) -> right.compareTo(left))
                    .forEach(path -> {
                        try {
                            Files.deleteIfExists(path);
                        } catch (IOException ex) {
                            throw new IllegalStateException("Failed to delete path " + path, ex);
                        }
                    });
        }
    }

    private String extractSuffix(String pathString) {
        String normalized = pathString.replace('\\', '/');
        int slashIndex = normalized.lastIndexOf('/');
        String fileName = slashIndex >= 0 ? normalized.substring(slashIndex + 1) : normalized;
        int dotIndex = fileName.lastIndexOf('.');
        if (dotIndex >= 0 && dotIndex < fileName.length() - 1) {
            return fileName.substring(dotIndex);
        }
        return ".tmp";
    }

    /** Uses the raw, unmasked config — {@link SystemConfigurationService#getConfiguration()}
     *  returns secrets replaced with "********" for API responses, which would otherwise break
     *  real MinIO/NAS authentication here. */
    private JsonNode getStorageConfig() {
        JsonNode response = systemConfigurationService.requireConfiguration().getIntegrationsConfig();
        if (response != null && response.has("storage")) {
            return response.get("storage");
        }
        return com.fasterxml.jackson.databind.node.JsonNodeFactory.instance.objectNode();
    }
}
