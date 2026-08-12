package com.eqms.dto.publishing;

import com.eqms.dto.document.RevisionDetailResponse;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record PublishingWorkspaceResponse(
        UUID revisionId,
        String revisionStatus,
        RevisionDetailResponse revision,
        List<PublishingTemplateResponse> templates,
        UUID selectedTemplateId,
        Integer selectedTemplateVersion,
        String publishingPreviewPdfPath,
        String publishingPreviewChecksum,
        String publishedPdfPath,
        String conversionEngine,
        boolean previewReady,
        boolean publishReady,
        String publishingTemplateName,
        String publishingTemplateStatus,
        String sourceFileName,
        Integer previewPageCount,
        Instant previewGeneratedAt,
        String previewGeneratedBy,
        String publishedBy,
        String previewChecksum,
        String selectedLayout,
        List<String> availableLayouts,
        List<String> availablePreviewComponents,
        UUID publishingJobId,
        String publishingJobStatus,
        String publishingJobMessage,
        String publishingJobError
) {}
