package com.eqms.service;

import com.eqms.auth.AuthenticatedUser;
import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.RevisionPublishingMetadata;
import com.eqms.entity.UserAccount;
import com.eqms.repository.DocumentRevisionRepository;
import com.eqms.repository.RevisionPublishingMetadataRepository;
import com.eqms.repository.UserAccountRepository;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.util.StringUtils;

/**
 * Regenerates the Publishing preview PDF (RevisionService#regenerateSnapshot and its three
 * fire-and-forget callers after a review/approval workflow transition) off the request thread.
 * Mirrors {@link RevisionSnapshotAsyncService}'s AFTER_COMMIT + REQUIRES_NEW + stale-request-guard
 * shape for the separate pre-publish review-snapshot pipeline -- see that class for the same
 * rationale (the composition round trip is a multi-minute-capable Microsoft Graph call that must
 * never hold the triggering transaction's DB connection open for its duration).
 */
@Service
public class RevisionPublishingSnapshotAsyncService {
    private static final Logger log = LoggerFactory.getLogger(RevisionPublishingSnapshotAsyncService.class);

    private final DocumentRevisionRepository revisionRepository;
    private final RevisionPublishingMetadataRepository publishingMetadataRepository;
    private final PublishingPdfComposerService publishingPdfComposerService;
    private final FileStorageService fileStorageService;
    private final AuditTrailService auditTrailService;
    private final UserAccountRepository userAccountRepository;
    private final SystemActorProvider systemActorProvider;

    public RevisionPublishingSnapshotAsyncService(
            DocumentRevisionRepository revisionRepository,
            RevisionPublishingMetadataRepository publishingMetadataRepository,
            PublishingPdfComposerService publishingPdfComposerService,
            FileStorageService fileStorageService,
            AuditTrailService auditTrailService,
            UserAccountRepository userAccountRepository,
            SystemActorProvider systemActorProvider
    ) {
        this.revisionRepository = revisionRepository;
        this.publishingMetadataRepository = publishingMetadataRepository;
        this.publishingPdfComposerService = publishingPdfComposerService;
        this.fileStorageService = fileStorageService;
        this.auditTrailService = auditTrailService;
        this.userAccountRepository = userAccountRepository;
        this.systemActorProvider = systemActorProvider;
    }

    @Async("fileProcessingExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onPublishingSnapshotRegenerationRequested(PublishingSnapshotRegenerationEvent event) {
        DocumentRevisionRecord revision = revisionRepository.findById(event.revisionId()).orElse(null);
        if (revision == null) return;

        RevisionPublishingMetadata metadata = publishingMetadataRepository.findByRevision_Id(event.revisionId()).orElse(null);
        if (!isCurrentRequest(metadata, event)) {
            log.info("Ignoring stale publishing snapshot regeneration request {} for revision {}", event.requestId(), event.revisionId());
            return;
        }

        UUID triggeringActorId = event.userId();
        Authentication previousAuthentication = SecurityContextHolder.getContext().getAuthentication();
        try {
            // composePreview() -> RevisionService.buildDetailResponse() -> toDetailResponse()
            // needs an authenticated CurrentUserService principal purely to compute viewer-facing
            // "canX" capability flags on the DTO it builds (irrelevant to -- and never read by --
            // the placeholder mapping this call actually needs the DTO's data fields for); there is
            // no live HTTP request/principal on this background thread otherwise. Impersonate the
            // user who triggered this regeneration (falling back to the reserved SYSTEM actor if
            // that's unknown) for the duration of this one call only -- always cleared in `finally`
            // so a pooled fileProcessingExecutor thread never carries an identity into unrelated work.
            UserAccount actingAs = triggeringActorId == null ? null : userAccountRepository.findById(triggeringActorId).orElse(null);
            if (actingAs == null) {
                actingAs = systemActorProvider.get();
            }
            SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                    new AuthenticatedUser(actingAs.getId(), null, actingAs.getUsername(), actingAs.getRoleName(), java.util.Set.of()),
                    null,
                    List.of()
            ));

            PublishingPdfComposerService.PublishingCompositionResult composition =
                    publishingPdfComposerService.composePreview(revision, PublishingWorkspaceService.effectiveTemplate(metadata), metadata.getSelectedPublishingLayout());
            byte[] previewBytes = composition.pdfBytes();
            if (previewBytes == null || previewBytes.length == 0) {
                throw new IllegalStateException("Publishing composer returned an empty PDF");
            }

            FileStorageService.StorageWriteResult stored;
            try (InputStream previewInput = new ByteArrayInputStream(previewBytes)) {
                stored = fileStorageService.storeRevisionPublishingPreviewFile(
                        revision.getId(), "preview.pdf", previewInput,
                        revision.getDocumentNumber(), revision.getRevisionNumber());
            }

            // Reload to avoid restoring stale state if a later request finished (or the revision
            // moved on) while the conversion was running.
            RevisionPublishingMetadata latest = publishingMetadataRepository.findByRevision_Id(event.revisionId()).orElse(null);
            if (!isCurrentRequest(latest, event)) {
                log.info("Discarding stale rendered publishing snapshot {} for revision {}", event.requestId(), event.revisionId());
                return;
            }
            DocumentRevisionRecord latestRevision = revisionRepository.findById(event.revisionId()).orElse(revision);

            latest.setPublishingPreviewPdfPath(stored.storedPath());
            latest.setPublishingPreviewChecksum(stored.checksum());
            latest.setPublishingPreviewVersionId(stored.versionId());
            latest.setConversionEngine("MICROSOFT_GRAPH");
            latest.setPreviewGeneratedAt(Instant.now());
            UserAccount actor = event.userId() == null ? null : userAccountRepository.findById(event.userId()).orElse(null);
            latest.setPreviewGeneratedBy(actor);
            latest.setPreviewGenerationStatus("READY");
            latest.setPreviewGenerationError(null);
            publishingMetadataRepository.save(latest);

            revisionRepository.updatePreviewPath(event.revisionId(), stored.storedPath());

            if (actor != null) {
                auditTrailService.logAs(
                        actor,
                        "REVISION",
                        latestRevision.getRevisionName(),
                        latestRevision.getId(),
                        StringUtils.hasText(event.actionLabel()) ? event.actionLabel() : "REVIEW_SNAPSHOT_REGENERATED",
                        status(latestRevision),
                        status(latestRevision),
                        "Review snapshot PDF regenerated from the latest workflow state.",
                        List.of(
                                new AuditTrailChangeResponse("Selected Template ID", "-", latest.getPublishingTemplate().getId() == null ? "-" : latest.getPublishingTemplate().getId().toString()),
                                new AuditTrailChangeResponse("Selected Layout", "-", latest.getSelectedPublishingLayout()),
                                new AuditTrailChangeResponse("Review Snapshot PDF", "-", latest.getPublishingPreviewPdfPath() == null ? "-" : latest.getPublishingPreviewPdfPath())
                        )
                );
            }
        } catch (Exception ex) {
            log.warn("Publishing snapshot regeneration failed for revision {}", event.revisionId(), ex);
            markFailed(event, ex.getMessage());
        } finally {
            SecurityContextHolder.getContext().setAuthentication(previousAuthentication);
        }
    }

    private boolean isCurrentRequest(RevisionPublishingMetadata metadata, PublishingSnapshotRegenerationEvent event) {
        return metadata != null
                && event.requestId() != null
                && event.requestId().equals(metadata.getPreviewGenerationRequestId())
                && "GENERATING".equalsIgnoreCase(metadata.getPreviewGenerationStatus());
    }

    private void markFailed(PublishingSnapshotRegenerationEvent event, String error) {
        RevisionPublishingMetadata metadata = publishingMetadataRepository.findByRevision_Id(event.revisionId()).orElse(null);
        // A stale task must never turn a newer regeneration request into FAILED.
        if (!isCurrentRequest(metadata, event)) return;
        metadata.setPreviewGenerationStatus("FAILED");
        metadata.setPreviewGenerationError(error == null ? "Publishing snapshot regeneration failed" : error.substring(0, Math.min(error.length(), 1000)));
        publishingMetadataRepository.save(metadata);

        DocumentRevisionRecord revision = revisionRepository.findById(event.revisionId()).orElse(null);
        UserAccount actor = event.userId() == null ? null : userAccountRepository.findById(event.userId()).orElse(null);
        if (revision != null && actor != null) {
            auditTrailService.logAs(
                    actor,
                    "REVISION",
                    revision.getRevisionName(),
                    revision.getId(),
                    "REVIEW_SNAPSHOT_REGENERATION_FAILED",
                    status(revision),
                    status(revision),
                    "Review snapshot PDF regeneration failed; the previously published PDF is unchanged. Error: "
                            + (error == null ? "-" : error)
            );
        }
    }

    private String status(DocumentRevisionRecord revision) {
        return revision.getStatus() == null ? null : revision.getStatus().getCode();
    }
}
