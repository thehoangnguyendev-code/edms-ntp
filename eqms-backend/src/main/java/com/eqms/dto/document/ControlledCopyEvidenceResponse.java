package com.eqms.dto.document;

public record ControlledCopyEvidenceResponse(
        String id,
        String fileName,
        String contentType,
        Long fileSize,
        String uploadedBy,
        String uploadedAt,
        String downloadUrl,
        String originalFileName,
        String originalContentType,
        Long originalFileSize,
        String originalSha256,
        String watermarkedSha256,
        boolean watermarked
) {
}
