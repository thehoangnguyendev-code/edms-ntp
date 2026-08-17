package com.eqms.service;

import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.RevisionSnapshotHistory;
import com.eqms.entity.UserAccount;
import com.eqms.repository.DocumentRevisionRepository;
import com.eqms.repository.RevisionSnapshotHistoryRepository;
import com.eqms.repository.UserAccountRepository;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/** Creates the immutable, source-only PDF used by the Review and Approval workflow. */
@Service
@RequiredArgsConstructor
public class RevisionSnapshotAsyncService {
    private static final Logger log = LoggerFactory.getLogger(RevisionSnapshotAsyncService.class);
    private final DocumentRevisionRepository revisionRepository;
    private final RevisionService revisionService;
    private final FileStorageService fileStorageService;
    private final AuditTrailService auditTrailService;
    private final UserAccountRepository userAccountRepository;
    private final RevisionSnapshotHistoryRepository revisionSnapshotHistoryRepository;

    @Async("fileProcessingExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onRevisionSnapshotRequested(RevisionSnapshotEvent event) {
        DocumentRevisionRecord revision = revisionRepository.findById(event.revisionId()).orElse(null);
        if (revision == null) return;

        // A revision can be completed more than once after rejection. Do not render or
        // publish a snapshot that belongs to an earlier completed source.
        if (!isCurrentRequest(revision, event)) {
            log.info("Ignoring stale review snapshot request {} for revision {}", event.requestId(), event.revisionId());
            return;
        }

        try {
            byte[] pdfBytes = revisionService.renderReviewSnapshotSource(event.revisionId());
            if (pdfBytes == null || pdfBytes.length == 0) {
                throw new IllegalStateException("Source conversion returned an empty review snapshot");
            }
            UserAccount actor = event.userId() == null ? null : userAccountRepository.findById(event.userId()).orElse(null);
            int reviewRound = Math.max(1, event.reviewRound());
            UUID snapshotId = UUID.randomUUID();
            FileStorageService.StorageWriteResult stored;
            try (InputStream input = new ByteArrayInputStream(pdfBytes)) {
                stored = fileStorageService.storeRevisionPublishingPreviewFile(
                        revision.getId(), "review-snapshot.pdf", input,
                        revision.getDocumentNumber(), revision.getRevisionNumber(), reviewRound, snapshotId);
            }

            // Reload to avoid restoring stale workflow state if a later action finished while
            // the conversion was running.
            DocumentRevisionRecord latest = revisionRepository.findById(event.revisionId()).orElse(null);
            if (latest == null) return;
            if (!isCurrentRequest(latest, event)) {
                log.info("Discarding stale rendered review snapshot {} for revision {}", event.requestId(), event.revisionId());
                return;
            }
            latest.setPreviewFilePath(stored.storedPath());
            latest.setStoragePdfUrl(stored.storedPath());
            latest.setSnapshotStatus("READY");
            latest.setSnapshotSourceChecksum(event.sourceChecksum());
            latest.setSnapshotError(null);
            revisionRepository.save(latest);

            RevisionSnapshotHistory history = new RevisionSnapshotHistory();
            history.setId(snapshotId);
            history.setRevision(latest);
            history.setReviewRound(reviewRound);
            history.setObjectKey(stored.objectKey());
            history.setVersionId(stored.versionId());
            history.setChecksum(stored.checksum());
            history.setSourceChecksum(event.sourceChecksum());
            history.setGenerationRequestId(event.requestId());
            history.setTriggerAction(event.actionLabel() == null ? "REVIEW_SNAPSHOT_GENERATED" : event.actionLabel());
            history.setGeneratedAt(Instant.now());
            history.setGeneratedBy(actor);
            revisionSnapshotHistoryRepository.save(history);

            if (actor != null) {
                auditTrailService.logAs(actor, "REVISION", latest.getRevisionName(), latest.getId(),
                        "REVIEW_SNAPSHOT_GENERATED", status(latest), status(latest),
                        "Generated an immutable review snapshot from the locked source file.",
                        List.of(new AuditTrailChangeResponse("Review Snapshot", "Generating", "Ready")));
            }
        } catch (Exception ex) {
            log.warn("Review snapshot generation failed for revision {}", event.revisionId(), ex);
            markFailed(event, ex.getMessage());
        }
    }

    private boolean isCurrentRequest(DocumentRevisionRecord revision, RevisionSnapshotEvent event) {
        return event.requestId() != null
                && event.sourceChecksum() != null
                && event.requestId().equals(revision.getSnapshotRequestId())
                && event.sourceChecksum().equals(revision.getSourceFileChecksum())
                && "GENERATING".equalsIgnoreCase(revision.getSnapshotStatus());
    }

    private void markFailed(RevisionSnapshotEvent event, String error) {
        DocumentRevisionRecord revision = revisionRepository.findById(event.revisionId()).orElse(null);
        // A stale task must never turn a newer snapshot request into FAILED.
        if (revision == null || !isCurrentRequest(revision, event)) return;
        revision.setSnapshotStatus("FAILED");
        revision.setSnapshotError(error == null ? "Review snapshot generation failed" : error.substring(0, Math.min(error.length(), 1000)));
        revisionRepository.save(revision);
    }

    private String status(DocumentRevisionRecord revision) {
        return revision.getStatus() == null ? null : revision.getStatus().getCode();
    }
}
