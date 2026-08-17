package com.eqms.service;

import com.eqms.auth.AuthenticatedUser;
import com.eqms.auth.CurrentUserService;
import com.eqms.auth.TokenService;
import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.dto.publishing.PublishingWorkspaceRequest;
import com.eqms.entity.UserAccount;
import com.eqms.event.PublishingWorkspaceOpenedEvent;
import org.springframework.scheduling.annotation.Async;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.transaction.event.TransactionPhase;

import java.util.List;
import java.util.UUID;

@Service
public class PublishingWorkspaceJobProcessorService {

    private final PublishingWorkspaceService publishingWorkspaceService;
    private final PublishingWorkspaceJobService publishingWorkspaceJobService;
    private final CurrentUserService currentUserService;
    private final AuditTrailService auditTrailService;
    private final PermissionEvaluationService permissionEvaluationService;
    private final TokenService tokenService;

    public PublishingWorkspaceJobProcessorService(
            PublishingWorkspaceService publishingWorkspaceService,
            PublishingWorkspaceJobService publishingWorkspaceJobService,
            CurrentUserService currentUserService,
            AuditTrailService auditTrailService,
            PermissionEvaluationService permissionEvaluationService,
            TokenService tokenService
    ) {
        this.publishingWorkspaceService = publishingWorkspaceService;
        this.publishingWorkspaceJobService = publishingWorkspaceJobService;
        this.currentUserService = currentUserService;
        this.auditTrailService = auditTrailService;
        this.permissionEvaluationService = permissionEvaluationService;
        this.tokenService = tokenService;
    }

    @Async("fileProcessingExecutor")
    public void processPublishJob(UUID jobId, UUID revisionId, PublishingWorkspaceRequest request, UUID userId) {
        UserAccount currentUser = currentUserService.requireCurrentUser(userId);
        SecurityContext previousContext = SecurityContextHolder.getContext();
        SecurityContext jobContext = SecurityContextHolder.createEmptyContext();
        var permissions = permissionEvaluationService.getPermissionCodes(currentUser);
        var principal = new AuthenticatedUser(
                currentUser.getId(),
                null,
                currentUser.getUsername(),
                currentUser.getRoleName(),
                permissions
        );
        jobContext.setAuthentication(new UsernamePasswordAuthenticationToken(
                principal,
                null,
                tokenService.toAuthorities(permissions)
        ));
        SecurityContextHolder.setContext(jobContext);
        try {
            publishingWorkspaceJobService.markProcessing(jobId, "Processing publishing package and electronic signature.");
            publishingWorkspaceService.completePublish(revisionId, request, userId);
            publishingWorkspaceJobService.markCompleted(jobId, "Publishing completed successfully.");
        } catch (Exception ex) {
            String message = extractMessage(ex);
            publishingWorkspaceJobService.markFailed(jobId, message);
            auditTrailService.logAs(
                    currentUser,
                    "REVISION",
                    "Publishing workspace",
                    revisionId,
                    "PUBLISHING_PACKAGE_FAILED",
                    "READY_FOR_PUBLISHING",
                    "READY_FOR_PUBLISHING",
                    message,
                    List.of(
                            new AuditTrailChangeResponse("Selected Template ID", "-", request == null || request.publishingTemplateId() == null ? "-" : request.publishingTemplateId()),
                            new AuditTrailChangeResponse("Selected Layout", "-", request == null || request.selectedLayout() == null ? "-" : request.selectedLayout()),
                            new AuditTrailChangeResponse("Error", "-", message)
                    )
            );
        } finally {
            SecurityContextHolder.setContext(previousContext);
        }
    }

    @Async("fileProcessingExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void processOpenWorkspaceJob(PublishingWorkspaceOpenedEvent event) {
        publishingWorkspaceJobService.markProcessing(event.jobId(), "Generating publishing workspace preview.");
        try {
            UserAccount currentUser = currentUserService.requireCurrentUser(event.requestedByUserId());
            publishingWorkspaceService.generatePreview(event.revisionId(), event.request(), currentUser);
            publishingWorkspaceJobService.markCompleted(event.jobId(), "Publishing workspace preview generated successfully.");
        } catch (Exception ex) {
            String message = extractMessage(ex);
            publishingWorkspaceJobService.markFailed(event.jobId(), message);
            auditTrailService.logAs(
                    currentUserService.requireCurrentUser(event.requestedByUserId()),
                    "REVISION",
                    "Publishing workspace",
                    event.revisionId(),
                    "PUBLISHING_PACKAGE_FAILED",
                    "DRAFT",
                    "DRAFT",
                    message,
                    List.of(
                            new AuditTrailChangeResponse("Selected Template ID", "-", event.request() == null || event.request().publishingTemplateId() == null ? "-" : event.request().publishingTemplateId()),
                            new AuditTrailChangeResponse("Selected Layout", "-", event.request() == null || event.request().selectedLayout() == null ? "-" : event.request().selectedLayout()),
                            new AuditTrailChangeResponse("Error", "-", message)
                    )
            );
        }
    }

    private String extractMessage(Throwable error) {
        Throwable current = error;
        while (current.getCause() != null && current.getCause() != current) {
            current = current.getCause();
        }
        String message = current.getMessage();
        if (message == null || message.isBlank()) {
            message = error.getMessage();
        }
        return message == null || message.isBlank() ? "Publishing failed" : message;
    }
}
