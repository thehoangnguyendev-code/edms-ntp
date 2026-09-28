package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.dto.publishing.PublishingWorkspaceRequest;
import com.eqms.entity.PublishingWorkspaceJob;
import com.eqms.repository.PublishingWorkspaceJobRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class PublishingWorkspaceJobService {

    private final PublishingWorkspaceJobRepository jobRepository;
    private final CurrentUserService currentUserService;
    private final AuditTrailService auditTrailService;

    public PublishingWorkspaceJobService(
            PublishingWorkspaceJobRepository jobRepository,
            CurrentUserService currentUserService,
            AuditTrailService auditTrailService
    ) {
        this.jobRepository = jobRepository;
        this.currentUserService = currentUserService;
        this.auditTrailService = auditTrailService;
    }

    @Transactional
    public PublishingWorkspaceJob createPublishJob(UUID revisionId, UUID requestedByUserId, PublishingWorkspaceRequest request) {
        PublishingWorkspaceJob job = new PublishingWorkspaceJob();
        job.setRevisionId(revisionId);
        job.setRequestedBy(currentUserService.requireCurrentUser(requestedByUserId));
        job.setStatus("QUEUED");
        job.setMessage("Publishing job queued");
        PublishingWorkspaceJob saved = jobRepository.save(job);

        auditTrailService.logAs(
                job.getRequestedBy(),
                "REVISION",
                "Publishing workspace",
                revisionId,
                "PUBLISHING_PACKAGE_QUEUED",
                "READY_FOR_PUBLISHING",
                "READY_FOR_PUBLISHING",
                "Queued publishing package generation and publish processing.",
                buildQueuedSelectionChanges(request)
        );

        return saved;
    }

    @Transactional
    public PublishingWorkspaceJob createOpenWorkspaceJob(UUID revisionId, UUID requestedByUserId, PublishingWorkspaceRequest request) {
        PublishingWorkspaceJob job = new PublishingWorkspaceJob();
        job.setRevisionId(revisionId);
        job.setRequestedBy(currentUserService.requireCurrentUser(requestedByUserId));
        job.setStatus("QUEUED");
        job.setMessage("Publishing workspace preview queued");
        PublishingWorkspaceJob saved = jobRepository.save(job);

        auditTrailService.logAs(
                job.getRequestedBy(),
                "REVISION",
                "Publishing workspace",
                revisionId,
                "PUBLISHING_PACKAGE_QUEUED",
                "DRAFT",
                "DRAFT",
                "Queued publishing workspace preview generation.",
                buildQueuedSelectionChanges(request)
        );

        return saved;
    }

    /**
     * A queued job has no real "before" for these fields, so a row is only meaningful when the
     * request actually carried a value. Unconditionally emitting a row for every field regardless
     * produced a "Selected Template ID: - -> -" no-op (and likewise for Layout/Change Summary)
     * whenever the workspace was opened without pre-selecting one -- the common case.
     */
    private List<AuditTrailChangeResponse> buildQueuedSelectionChanges(PublishingWorkspaceRequest request) {
        List<AuditTrailChangeResponse> changes = new ArrayList<>();
        if (request != null && StringUtils.hasText(request.publishingTemplateId())) {
            changes.add(new AuditTrailChangeResponse("Selected Template ID", null, request.publishingTemplateId()));
        }
        if (request != null && StringUtils.hasText(request.selectedLayout())) {
            changes.add(new AuditTrailChangeResponse("Selected Layout", null, request.selectedLayout()));
        }
        if (request != null && StringUtils.hasText(request.changeSummary())) {
            changes.add(new AuditTrailChangeResponse("Change Summary", null, request.changeSummary()));
        }
        return changes;
    }

    @Transactional(readOnly = true)
    public PublishingWorkspaceJob getLatestJob(UUID revisionId) {
        return jobRepository.findTopByRevisionIdOrderByCreatedAtDesc(revisionId).orElse(null);
    }

    @Transactional
    public void markProcessing(UUID jobId, String message) {
        updateJob(jobId, "PROCESSING", message, null, Instant.now(), null);
    }

    @Transactional
    public void markCompleted(UUID jobId, String message) {
        updateJob(jobId, "COMPLETED", message, null, null, Instant.now());
    }

    @Transactional
    public void markFailed(UUID jobId, String errorMessage) {
        updateJob(jobId, "FAILED", "Publishing failed", errorMessage, null, Instant.now());
    }

    private void updateJob(UUID jobId, String status, String message, String errorMessage, Instant startedAt, Instant completedAt) {
        PublishingWorkspaceJob job = jobRepository.findById(jobId)
                .orElseThrow(() -> new IllegalArgumentException("Publishing workspace job not found"));
        job.setStatus(status);
        if (StringUtils.hasText(message)) {
            job.setMessage(message);
        }
        if (startedAt != null) {
            job.setStartedAt(startedAt);
        }
        if (completedAt != null) {
            job.setCompletedAt(completedAt);
        }
        if (errorMessage != null) {
            job.setErrorMessage(errorMessage);
        }
        jobRepository.save(job);
    }
}
