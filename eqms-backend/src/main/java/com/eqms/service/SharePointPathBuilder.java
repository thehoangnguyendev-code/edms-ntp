package com.eqms.service;

import com.eqms.service.OfficeOnlineConfigurationService.OfficeOnlineConfiguration;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.Arrays;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class SharePointPathBuilder {

    private static final String DEFAULT_ROOT_FOLDER = "EQMS";
    private static final String DEFAULT_EDIT_ONLINE_PREFIX = "edit-online";
    private static final String DEFAULT_CONVERSION_PREFIX = "conversion";
    private static final String DEFAULT_PUBLISHING_PREFIX = "publishing";
    private static final String DEFAULT_TEMP_PREFIX = "temp";

    private final StoragePathBuilder storagePathBuilder;

    public SharePointPathBuilder(StoragePathBuilder storagePathBuilder) {
        this.storagePathBuilder = storagePathBuilder;
    }

    public String editOnlineFolder(OfficeOnlineConfiguration config, String documentNumber, String revisionNumber) {
        return buildPath(
                rootFolder(config),
                DEFAULT_EDIT_ONLINE_PREFIX,
                "documents",
                sanitizeSegment(documentNumber),
                "revisions",
                sanitizeSegment(revisionNumber)
        );
    }

    /** Uses the immutable revision ID so a Publish version promotion never changes the workspace key. */
    public String editOnlineFolderV2(OfficeOnlineConfiguration config, String documentNumber, UUID revisionId) {
        return buildPath(
                rootFolder(config),
                "workspaces",
                "documents",
                sanitizeSegment(documentNumber),
                "revisions",
                revisionId == null ? "unassigned" : revisionId.toString()
        );
    }

    public String editOnlineFile(OfficeOnlineConfiguration config, String documentNumber, String revisionNumber, String fileName) {
        return buildPath(
                editOnlineFolder(config, documentNumber, revisionNumber),
                sanitizeFileName(fileName)
        );
    }

    public String conversionFolder(OfficeOnlineConfiguration config, String module, String entityId) {
        return buildPath(
                rootFolder(config),
                DEFAULT_CONVERSION_PREFIX,
                sanitizeSegment(module),
                sanitizeSegment(entityId)
        );
    }

    public String conversionFile(OfficeOnlineConfiguration config, String module, String entityId, String fileName) {
        return buildPath(
                conversionFolder(config, module, entityId),
                sanitizeFileName(fileName)
        );
    }

    public String publishingFolder(OfficeOnlineConfiguration config, String documentNumber, String revisionNumber) {
        return buildPath(
                rootFolder(config),
                DEFAULT_PUBLISHING_PREFIX,
                "documents",
                sanitizeSegment(documentNumber),
                "revisions",
                sanitizeSegment(revisionNumber)
        );
    }

    public String publishingFile(OfficeOnlineConfiguration config, String documentNumber, String revisionNumber, String fileName) {
        return buildPath(
                publishingFolder(config, documentNumber, revisionNumber),
                sanitizeFileName(fileName)
        );
    }

    public String tempFolder(OfficeOnlineConfiguration config, String module, String entityId) {
        return buildPath(
                rootFolder(config),
                DEFAULT_TEMP_PREFIX,
                sanitizeSegment(module),
                sanitizeSegment(entityId)
        );
    }

    public String tempFile(OfficeOnlineConfiguration config, String module, String entityId, String fileName) {
        return buildPath(
                tempFolder(config, module, entityId),
                UUID.randomUUID() + "_" + sanitizeFileName(fileName)
        );
    }

    private String rootFolder(OfficeOnlineConfiguration config) {
        if (config == null || !StringUtils.hasText(config.libraryFolder())) {
            return DEFAULT_ROOT_FOLDER;
        }
        return sanitizeSegment(config.libraryFolder());
    }

    private String sanitizeSegment(String value) {
        return storagePathBuilder.sanitizeSegment(value);
    }

    private String sanitizeFileName(String fileName) {
        return storagePathBuilder.sanitizeFileName(fileName);
    }

    private String buildPath(String... segments) {
        return Arrays.stream(segments)
                .filter(StringUtils::hasText)
                .map(this::normalizePathSegment)
                .filter(StringUtils::hasText)
                .collect(Collectors.joining("/"));
    }

    private String normalizePathSegment(String value) {
        if (!StringUtils.hasText(value)) {
            return "";
        }
        String cleaned = value.trim().replace('\\', '/').replaceAll("/{2,}", "/");
        return Arrays.stream(cleaned.split("/+"))
                .filter(StringUtils::hasText)
                .map(storagePathBuilder::sanitizeSegment)
                .filter(StringUtils::hasText)
                .collect(Collectors.joining("/"));
    }
}
