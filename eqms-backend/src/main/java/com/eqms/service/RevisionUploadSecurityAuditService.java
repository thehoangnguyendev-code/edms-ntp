package com.eqms.service;

import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.UserAccount;
import com.eqms.exception.RevisionUploadValidationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/** Persists security-relevant rejected upload attempts independently of the caller transaction. */
@Service
public class RevisionUploadSecurityAuditService {

    private final AuditTrailService auditTrailService;

    public RevisionUploadSecurityAuditService(AuditTrailService auditTrailService) {
        this.auditTrailService = auditTrailService;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordRejected(
            UserAccount actor,
            DocumentRecord document,
            DocumentRevisionRecord revision,
            MultipartFile file,
            String reasonCode,
            String reasonMessage
    ) {
        recordRejected(
                actor,
                document,
                revision,
                file == null ? null : file.getOriginalFilename(),
                file == null ? null : file.getContentType(),
                file == null ? 0L : file.getSize(),
                reasonCode,
                reasonMessage
        );
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordRejected(
            UserAccount actor,
            DocumentRecord document,
            DocumentRevisionRecord revision,
            String fileName,
            String clientDeclaredContentType,
            long fileSize,
            String reasonCode,
            String reasonMessage
    ) {
        String entityType = revision == null ? "DOCUMENT" : "REVISION";
        java.util.UUID entityId = revision == null ? document.getId() : revision.getId();
        String entityName = revision == null
                ? document.getDocumentName()
                : revision.getRevisionName();
        String status = revision == null || revision.getStatus() == null ? null : revision.getStatus().getCode();

        auditTrailService.logAs(
                actor,
                entityType,
                entityName,
                entityId,
                "REVISION_SOURCE_FILE_UPLOAD_REJECTED",
                status,
                status,
                reasonMessage,
                List.of(
                        new AuditTrailChangeResponse("validationReasonCode", "-", reasonCode),
                        new AuditTrailChangeResponse("fileName", "-", fileName == null ? "-" : fileName),
                        new AuditTrailChangeResponse("clientDeclaredContentType", "-", clientDeclaredContentType == null ? "-" : clientDeclaredContentType),
                        new AuditTrailChangeResponse("fileSizeBytes", "-", String.valueOf(Math.max(fileSize, 0L)))
                )
        );
    }
}
