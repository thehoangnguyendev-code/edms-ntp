package com.eqms.service;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.Arrays;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class StoragePathBuilder {

    private static final String DEFAULT_DOCUMENTS_PREFIX = "documents";
    private static final String DEFAULT_CONTROLLED_COPIES_PREFIX = "controlled-copies";
    private static final String DEFAULT_TEMPLATES_PREFIX = "templates";
    private static final String DEFAULT_TRAINING_PREFIX = "training";
    private static final String DEFAULT_AUDIT_PREFIX = "audit";
    private static final String DEFAULT_TEMP_PREFIX = "temp";

    public String revisionSource(String documentNumber, String revisionNumber, String fileName) {
        return revisionSource(null, documentNumber, revisionNumber, fileName);
    }

    public String revisionSource(JsonNode storageConfig, String documentNumber, String revisionNumber, String fileName) {
        return buildPath(
                resolvePrefix(storageConfig, "documentsPrefix", DEFAULT_DOCUMENTS_PREFIX),
                sanitizeSegment(documentNumber),
                "revisions",
                sanitizeSegment(revisionNumber),
                "source",
                sanitizeFileName(fileName)
        );
    }

    /**
     * V2 object keys use the immutable revision ID as the technical boundary. Revision numbers
     * are promoted during publishing (for example 0.0.1 to 1.0.0), so they must not identify the
     * object folder. The document number remains as a human-readable grouping segment.
     */
    public String revisionSourceV2(JsonNode storageConfig, String documentNumber, UUID revisionId, String fileName) {
        return buildPath(revisionV2Root(storageConfig, documentNumber, revisionId), "source", "source" + extensionOf(fileName));
    }

    public String revisionReviewPdfV2(JsonNode storageConfig, String documentNumber, UUID revisionId) {
        return buildPath(revisionV2Root(storageConfig, documentNumber, revisionId), "review", "review-snapshot.pdf");
    }

    public String revisionPublishingPreviewPdfV2(JsonNode storageConfig, String documentNumber, UUID revisionId) {
        return buildPath(revisionV2Root(storageConfig, documentNumber, revisionId), "publishing", "preview.pdf");
    }

    public String revisionPublishedPdfV2(JsonNode storageConfig, String documentNumber, UUID revisionId) {
        return buildPath(revisionV2Root(storageConfig, documentNumber, revisionId), "published", "official.pdf");
    }

    public String sharePointRecordSourceV2(String libraryFolder, String documentNumber, UUID revisionId, String fileName) {
        return buildPath(
                sanitizeSegment(libraryFolder),
                "records",
                "documents",
                sanitizeSegment(documentNumber),
                "revisions",
                safeIdentifier(revisionId),
                "source",
                "source" + extensionOf(fileName)
        );
    }

    public String revisionReviewPdf(String documentNumber, String revisionNumber) {
        return revisionReviewPdf(null, documentNumber, revisionNumber);
    }

    public String revisionReviewPdf(JsonNode storageConfig, String documentNumber, String revisionNumber) {
        return buildPath(
                resolvePrefix(storageConfig, "documentsPrefix", DEFAULT_DOCUMENTS_PREFIX),
                sanitizeSegment(documentNumber),
                "revisions",
                sanitizeSegment(revisionNumber),
                "review",
                "review-snapshot.pdf"
        );
    }

    public String revisionPublishedPdf(String documentNumber, String revisionNumber) {
        return revisionPublishedPdf(null, documentNumber, revisionNumber);
    }

    public String revisionPublishedPdf(JsonNode storageConfig, String documentNumber, String revisionNumber) {
        return buildPath(
                resolvePrefix(storageConfig, "documentsPrefix", DEFAULT_DOCUMENTS_PREFIX),
                sanitizeSegment(documentNumber),
                "revisions",
                sanitizeSegment(revisionNumber),
                "published",
                "published.pdf"
        );
    }

    public String revisionPublishingPreviewPdf(String documentNumber, String revisionNumber) {
        return revisionPublishingPreviewPdf(null, documentNumber, revisionNumber);
    }

    public String revisionPublishingPreviewPdf(JsonNode storageConfig, String documentNumber, String revisionNumber) {
        return revisionReviewPdf(storageConfig, documentNumber, revisionNumber);
    }

    public String revisionPublishingWorkingFile(String documentNumber, String revisionNumber, String fileName) {
        return revisionPublishingWorkingFile(null, documentNumber, revisionNumber, fileName);
    }

    public String revisionPublishingWorkingFile(JsonNode storageConfig, String documentNumber, String revisionNumber, String fileName) {
        return buildPath(
                resolvePrefix(storageConfig, "documentsPrefix", DEFAULT_DOCUMENTS_PREFIX),
                sanitizeSegment(documentNumber),
                "revisions",
                sanitizeSegment(revisionNumber),
                "published",
                "working",
                sanitizeFileName(fileName)
        );
    }

    public String controlledCopyPdf(String batchNumber, String controlledCopyNumber) {
        return controlledCopyPdf(null, batchNumber, controlledCopyNumber);
    }

    public String controlledCopyPdf(JsonNode storageConfig, String batchNumber, String controlledCopyNumber) {
        return buildPath(
                resolvePrefix(storageConfig, "controlledCopiesPrefix", DEFAULT_CONTROLLED_COPIES_PREFIX),
                sanitizeSegment(batchNumber),
                "copies",
                sanitizeFileName(controlledCopyNumber + ".pdf")
        );
    }

    public String controlledCopyPdfV2(JsonNode storageConfig, String batchNumber, String controlledCopyNumber, UUID controlledCopyId) {
        return buildPath(
                resolvePrefix(storageConfig, "controlledCopiesPrefix", DEFAULT_CONTROLLED_COPIES_PREFIX),
                sanitizeSegment(batchNumber),
                "copies",
                controlledCopyFolder(controlledCopyNumber, controlledCopyId),
                "issued.pdf"
        );
    }

    public String controlledCopyEvidence(String batchNumber, String controlledCopyNumber, String fileName) {
        return controlledCopyEvidence(null, batchNumber, controlledCopyNumber, fileName);
    }

    public String controlledCopyEvidence(JsonNode storageConfig, String batchNumber, String controlledCopyNumber, String fileName) {
        return buildPath(
                resolvePrefix(storageConfig, "controlledCopiesPrefix", DEFAULT_CONTROLLED_COPIES_PREFIX),
                sanitizeSegment(batchNumber),
                "evidence",
                sanitizeSegment(controlledCopyNumber),
                prefixedUniqueFileName(fileName)
        );
    }

    public String controlledCopyEvidenceV2(JsonNode storageConfig, String batchNumber, String controlledCopyNumber, UUID controlledCopyId, String fileName) {
        return buildPath(
                resolvePrefix(storageConfig, "controlledCopiesPrefix", DEFAULT_CONTROLLED_COPIES_PREFIX),
                sanitizeSegment(batchNumber),
                "copies",
                controlledCopyFolder(controlledCopyNumber, controlledCopyId),
                "evidence",
                prefixedUniqueFileName(fileName)
        );
    }

    public String documentContentTemplate(String documentType, String templateDocumentNumber, String revisionNumber, String fileName) {
        return documentContentTemplate(null, documentType, templateDocumentNumber, revisionNumber, fileName);
    }

    public String documentContentTemplate(JsonNode storageConfig, String documentType, String templateDocumentNumber, String revisionNumber, String fileName) {
        return buildPath(
                resolvePrefix(storageConfig, "templatesPrefix", DEFAULT_TEMPLATES_PREFIX),
                "document-content",
                sanitizeSegment(documentType),
                sanitizeSegment(templateDocumentNumber),
                "revisions",
                sanitizeSegment(revisionNumber),
                "source",
                sanitizeFileName(fileName)
        );
    }

    public String publishingCoverTemplate(String documentType, String templateName) {
        return publishingCoverTemplate(null, documentType, templateName);
    }

    public String publishingCoverTemplate(JsonNode storageConfig, String documentType, String templateName) {
        return buildPath(
                resolvePrefix(storageConfig, "templatesPrefix", DEFAULT_TEMPLATES_PREFIX),
                "publishing",
                sanitizeSegment(documentType),
                "cover",
                sanitizeFileName(templateName)
        );
    }

    public String publishingComponentTemplate(String documentType, String templateName, String componentType, String layout) {
        return publishingComponentTemplate(null, documentType, templateName, componentType, layout);
    }

    public String publishingComponentTemplate(JsonNode storageConfig, String documentType, String templateName, String componentType, String layout) {
        return buildPath(
                resolvePrefix(storageConfig, "templatesPrefix", DEFAULT_TEMPLATES_PREFIX),
                "publishing",
                sanitizeSegment(documentType),
                sanitizeSegment(componentType),
                sanitizeSegment(layout),
                sanitizeFileName(templateName)
        );
    }

    public String publishingComponentTemplateV2(JsonNode storageConfig, UUID templateId, int templateVersion, String componentType, String layout, String fileName) {
        return buildPath(
                resolvePrefix(storageConfig, "templatesPrefix", DEFAULT_TEMPLATES_PREFIX),
                "publishing",
                "templates",
                safeIdentifier(templateId),
                "v" + Math.max(templateVersion, 1),
                sanitizeSegment(componentType),
                sanitizeSegment(layout),
                "source" + extensionOf(fileName)
        );
    }

    public String publishingComponentPreviewTemplate(String documentType, String templateName, String componentType, String layout) {
        return publishingComponentPreviewTemplate(null, documentType, templateName, componentType, layout);
    }

    public String publishingComponentPreviewTemplate(JsonNode storageConfig, String documentType, String templateName, String componentType, String layout) {
        return buildPath(
                resolvePrefix(storageConfig, "templatesPrefix", DEFAULT_TEMPLATES_PREFIX),
                "publishing",
                sanitizeSegment(documentType),
                sanitizeSegment(componentType),
                sanitizeSegment(layout),
                "preview.pdf"
        );
    }

    public String publishingComponentPreviewTemplateV2(JsonNode storageConfig, UUID templateId, int templateVersion, String componentType, String layout) {
        return buildPath(
                resolvePrefix(storageConfig, "templatesPrefix", DEFAULT_TEMPLATES_PREFIX),
                "publishing",
                "templates",
                safeIdentifier(templateId),
                "v" + Math.max(templateVersion, 1),
                sanitizeSegment(componentType),
                sanitizeSegment(layout),
                "preview.pdf"
        );
    }

    public String publishingHeaderTemplate(String documentType, String templateName) {
        return publishingHeaderTemplate(null, documentType, templateName);
    }

    public String publishingHeaderTemplate(JsonNode storageConfig, String documentType, String templateName) {
        return buildPath(
                resolvePrefix(storageConfig, "templatesPrefix", DEFAULT_TEMPLATES_PREFIX),
                "publishing",
                sanitizeSegment(documentType),
                "header",
                sanitizeFileName(templateName)
        );
    }

    public String publishingBodyTemplate(String documentType, String templateName) {
        return publishingBodyTemplate(null, documentType, templateName);
    }

    public String publishingBodyTemplate(JsonNode storageConfig, String documentType, String templateName) {
        return buildPath(
                resolvePrefix(storageConfig, "templatesPrefix", DEFAULT_TEMPLATES_PREFIX),
                "publishing",
                sanitizeSegment(documentType),
                "body",
                sanitizeFileName(templateName)
        );
    }

    public String publishingFooterTemplate(String documentType, String templateName) {
        return publishingFooterTemplate(null, documentType, templateName);
    }

    public String publishingFooterTemplate(JsonNode storageConfig, String documentType, String templateName) {
        return buildPath(
                resolvePrefix(storageConfig, "templatesPrefix", DEFAULT_TEMPLATES_PREFIX),
                "publishing",
                sanitizeSegment(documentType),
                "footer",
                sanitizeFileName(templateName)
        );
    }

    public String publishingLogoTemplate(String documentType, String templateName) {
        return publishingLogoTemplate(null, documentType, templateName);
    }

    public String publishingLogoTemplate(JsonNode storageConfig, String documentType, String templateName) {
        return buildPath(
                resolvePrefix(storageConfig, "templatesPrefix", DEFAULT_TEMPLATES_PREFIX),
                "publishing",
                sanitizeSegment(documentType),
                "logo",
                sanitizeFileName(templateName)
        );
    }

    public String trainingFile(String documentNumber, String revisionNumber, String fileType, String fileName) {
        return trainingFile(null, documentNumber, revisionNumber, fileType, fileName);
    }

    public String trainingFile(JsonNode storageConfig, String documentNumber, String revisionNumber, String fileType, String fileName) {
        return buildPath(
                resolvePrefix(storageConfig, "trainingPrefix", DEFAULT_TRAINING_PREFIX),
                sanitizeSegment(documentNumber),
                "revisions",
                sanitizeSegment(revisionNumber),
                sanitizeSegment(fileType),
                sanitizeFileName(fileName)
        );
    }

    public String auditEvidence(String module, String entityId, String fileName) {
        return auditEvidence(null, module, entityId, fileName);
    }

    public String auditEvidence(JsonNode storageConfig, String module, String entityId, String fileName) {
        return buildPath(
                resolvePrefix(storageConfig, "auditPrefix", DEFAULT_AUDIT_PREFIX),
                sanitizeSegment(module),
                sanitizeSegment(entityId),
                prefixedUniqueFileName(fileName)
        );
    }

    public String tempFile(String module, String entityId, String fileName) {
        return tempFile(null, module, entityId, fileName);
    }

    public String tempFile(JsonNode storageConfig, String module, String entityId, String fileName) {
        return buildPath(
                resolvePrefix(storageConfig, "tempPrefix", DEFAULT_TEMP_PREFIX),
                sanitizeSegment(module),
                sanitizeSegment(entityId),
                prefixedUniqueFileName(fileName)
        );
    }

    public String legacyControlledCopyPdf(String controlledCopyId) {
        return buildPath(DEFAULT_CONTROLLED_COPIES_PREFIX, sanitizeSegment(controlledCopyId), "controlled-copy.pdf");
    }

    public String legacyControlledCopyEvidence(String controlledCopyId, String fileName) {
        return buildPath(DEFAULT_CONTROLLED_COPIES_PREFIX, sanitizeSegment(controlledCopyId), "evidence", prefixedUniqueFileName(fileName));
    }

    public String sanitizeFileName(String fileName) {
        if (!StringUtils.hasText(fileName)) {
            return "file.bin";
        }
        String trimmed = fileName.trim().replace('\\', '/');
        int slashIndex = trimmed.lastIndexOf('/');
        String leaf = slashIndex >= 0 ? trimmed.substring(slashIndex + 1) : trimmed;
        if (!StringUtils.hasText(leaf)) {
            return "file.bin";
        }
        int dotIndex = leaf.lastIndexOf('.');
        String base = dotIndex > 0 ? leaf.substring(0, dotIndex) : leaf;
        String extension = dotIndex > 0 ? leaf.substring(dotIndex) : "";
        String sanitizedBase = sanitizeSegment(base);
        if (!StringUtils.hasText(sanitizedBase)) {
            sanitizedBase = "file";
        }
        String sanitizedExtension = extension.replaceAll("[^A-Za-z0-9.]+", "");
        return sanitizedBase + (StringUtils.hasText(sanitizedExtension) ? sanitizedExtension : "");
    }

    public String sanitizeSegment(String value) {
        if (!StringUtils.hasText(value)) {
            return "";
        }
        String cleaned = value.trim()
                .replace('\\', '/')
                .replaceAll("^/+", "")
                .replaceAll("/+$", "")
                .replaceAll("/{2,}", "/");
        return Arrays.stream(cleaned.split("/+"))
                .filter(StringUtils::hasText)
                .map(part -> part.trim()
                        .replaceAll("[\\s]+", "_")
                        .replaceAll("[/\\\\:*?\"<>|]+", "-")
                        .replaceAll("-{2,}", "-")
                        .replaceAll("^[._-]+", "")
                        .replaceAll("[._-]+$", ""))
                .filter(StringUtils::hasText)
                .collect(Collectors.joining("/"));
    }

    private String uniqueFileName(String fileName) {
        String sanitized = sanitizeFileName(fileName);
        return StringUtils.hasText(sanitized) ? sanitized : "file.bin";
    }

    private String revisionV2Root(JsonNode storageConfig, String documentNumber, UUID revisionId) {
        return buildPath(
                resolvePrefix(storageConfig, "documentsPrefix", DEFAULT_DOCUMENTS_PREFIX),
                sanitizeSegment(documentNumber),
                "revisions",
                safeIdentifier(revisionId)
        );
    }

    private String controlledCopyFolder(String controlledCopyNumber, UUID controlledCopyId) {
        String number = sanitizeSegment(controlledCopyNumber);
        String identifier = safeIdentifier(controlledCopyId);
        return StringUtils.hasText(number) ? number + "_" + identifier : identifier;
    }

    private String safeIdentifier(UUID identifier) {
        return identifier == null ? "unassigned" : identifier.toString();
    }

    private String extensionOf(String fileName) {
        String sanitized = sanitizeFileName(fileName);
        int dot = sanitized.lastIndexOf('.');
        return dot >= 0 ? sanitized.substring(dot).toLowerCase(java.util.Locale.ROOT) : ".bin";
    }

    private String prefixedUniqueFileName(String fileName) {
        return java.util.UUID.randomUUID() + "_" + uniqueFileName(fileName);
    }

    private String buildPath(String... segments) {
        return Arrays.stream(segments)
                .filter(StringUtils::hasText)
                .map(this::normalizeKeySegment)
                .filter(StringUtils::hasText)
                .collect(Collectors.joining("/"));
    }

    private String normalizeKeySegment(String segment) {
        if (!StringUtils.hasText(segment)) {
            return "";
        }
        String cleaned = segment.trim().replace('\\', '/').replaceAll("/{2,}", "/");
        return Arrays.stream(cleaned.split("/+"))
                .filter(StringUtils::hasText)
                .map(this::sanitizeLeafSegment)
                .filter(StringUtils::hasText)
                .collect(Collectors.joining("/"));
    }

    private String sanitizeLeafSegment(String value) {
        if (!StringUtils.hasText(value)) {
            return "";
        }
        return value.trim()
                .replaceAll("[\\s]+", "_")
                .replaceAll("[/\\\\:*?\"<>|]+", "-")
                .replaceAll("-{2,}", "-")
                .replaceAll("^[._-]+", "")
                .replaceAll("[._-]+$", "");
    }

    private String resolvePrefix(JsonNode storageConfig, String field, String defaultValue) {
        String resolved = text(storageConfig, field);
        if (!StringUtils.hasText(resolved)) {
            return defaultValue;
        }
        return normalizeKeySegment(resolved);
    }

    private String text(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        return value == null || value.isNull() ? null : value.asText();
    }
}
