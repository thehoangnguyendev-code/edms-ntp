package com.eqms.service;

import com.eqms.dto.document.RevisionDetailResponse;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.RevisionPublishingMetadata;
import com.eqms.util.DateTimeFormatUtils;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.LinkedHashSet;
import java.util.Set;

@Service
public class PreviewVersionTokenService {

    public String resolveDocumentPreviewVersionToken(DocumentRecord document, DocumentRevisionRecord activeRevision, RevisionPublishingMetadata metadata) {
        return combineTokens(
                metadata == null ? null : metadata.getPublishedPdfVersionId(),
                metadata == null ? null : metadata.getPublishingPreviewVersionId(),
                activeRevision == null ? null : activeRevision.getSourceStorageVersionId(),
                metadata == null ? null : DateTimeFormatUtils.formatDateTime(metadata.getPublishedAt()),
                metadata == null ? null : DateTimeFormatUtils.formatDateTime(metadata.getPreviewGeneratedAt()),
                activeRevision == null ? null : DateTimeFormatUtils.formatDateTime(activeRevision.getPublishedAt()),
                activeRevision == null ? null : DateTimeFormatUtils.formatDateTime(activeRevision.getStorageLastSyncedAt()),
                document == null ? null : DateTimeFormatUtils.formatDateTime(document.getUpdatedAt()),
                activeRevision == null ? null : DateTimeFormatUtils.formatDateTime(activeRevision.getUpdatedAt())
        );
    }

    public String resolveRevisionPreviewVersionToken(DocumentRevisionRecord revision, RevisionPublishingMetadata metadata) {
        return combineTokens(
                metadata == null ? null : metadata.getPublishedPdfVersionId(),
                metadata == null ? null : metadata.getPublishingPreviewVersionId(),
                revision == null ? null : revision.getSourceStorageVersionId(),
                metadata == null ? null : DateTimeFormatUtils.formatDateTime(metadata.getPublishedAt()),
                metadata == null ? null : DateTimeFormatUtils.formatDateTime(metadata.getPreviewGeneratedAt()),
                revision == null ? null : DateTimeFormatUtils.formatDateTime(revision.getPublishedAt()),
                revision == null ? null : DateTimeFormatUtils.formatDateTime(revision.getStorageLastSyncedAt()),
                revision == null ? null : DateTimeFormatUtils.formatDateTime(revision.getUpdatedAt()),
                revision == null ? null : revision.getSnapshotStatus()
        );
    }

    public String resolveWorkspacePreviewVersionToken(RevisionDetailResponse revision, RevisionPublishingMetadata metadata) {
        return combineTokens(
                metadata == null ? null : metadata.getPublishedPdfVersionId(),
                metadata == null ? null : metadata.getPublishingPreviewVersionId(),
                revision == null ? null : revision.sourceStorageVersionId(),
                revision == null ? null : revision.storageLastSyncedAt(),
                revision == null ? null : revision.publishedOn(),
                metadata == null ? null : DateTimeFormatUtils.formatDateTime(metadata.getPublishedAt()),
                metadata == null ? null : DateTimeFormatUtils.formatDateTime(metadata.getPreviewGeneratedAt()),
                metadata == null ? null : metadata.getSelectedPublishingLayout(),
                metadata == null || metadata.getPublishingTemplateVersion() == null ? null : String.valueOf(metadata.getPublishingTemplateVersion()),
                revision == null ? null : revision.snapshotStatus(),
                revision == null || revision.statusInfo() == null ? null : revision.statusInfo().code()
        );
    }

    public String resolveReviewSnapshotVersionToken(DocumentRevisionRecord revision, RevisionPublishingMetadata metadata) {
        return combineTokens(
                metadata == null ? null : metadata.getPublishingPreviewVersionId(),
                metadata == null ? null : DateTimeFormatUtils.formatDateTime(metadata.getPreviewGeneratedAt()),
                revision == null ? null : revision.getSnapshotStatus(),
                revision == null ? null : revision.getPreviewFilePath()
        );
    }

    public String resolvePublishingPreviewVersionToken(RevisionPublishingMetadata metadata) {
        return combineTokens(
                metadata == null ? null : metadata.getPublishingPreviewVersionId(),
                metadata == null ? null : DateTimeFormatUtils.formatDateTime(metadata.getPreviewGeneratedAt()),
                metadata == null ? null : metadata.getPublishingPreviewPdfPath()
        );
    }

    public String resolvePublishedPdfVersionToken(RevisionPublishingMetadata metadata) {
        return combineTokens(
                metadata == null ? null : metadata.getPublishedPdfVersionId(),
                metadata == null ? null : DateTimeFormatUtils.formatDateTime(metadata.getPublishedAt()),
                metadata == null ? null : metadata.getPublishedPdfPath()
        );
    }

    private String combineTokens(String... parts) {
        Set<String> values = new LinkedHashSet<>();
        for (String part : parts) {
            if (StringUtils.hasText(part)) {
                values.add(part.trim());
            }
        }
        if (values.isEmpty()) {
            return null;
        }
        return String.join("|", values);
    }
}
