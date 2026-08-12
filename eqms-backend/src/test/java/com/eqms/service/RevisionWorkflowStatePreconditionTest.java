package com.eqms.service;

import com.eqms.dto.security.RevisionWorkflowAuthorizationContext;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.RevisionStatusDefinition;
import com.eqms.enums.RevisionWorkflowAction;
import com.eqms.repository.WorkflowParticipantRepository;
import com.eqms.service.authorization.AuthorizationEngineService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * State-machine invariant coverage for {@link RevisionWorkflowAuthorizationService#checkStatePrecondition},
 * the logic {@code RevisionResourceAdapter#checkPrecondition} delegates to as one of
 * {@link AuthorizationEngineService}'s evaluation steps post-cutover
 * (SECURITY_AUTHORIZATION_HYBRID_REFACTOR_PLAN.md §7 cutover rule 5). This state logic itself was
 * never removed by the cutover -- only the actor/permission matching around it was -- so this
 * replaces the state-only cases from the pre-cutover
 * {@code RevisionWorkflowAuthorizationServiceTest} that used to reach the same code through the now
 * -removed {@code checkInternal}.
 */
@ExtendWith(MockitoExtension.class)
class RevisionWorkflowStatePreconditionTest {

    @Mock private AuditTrailService auditTrailService;
    @Mock private WorkflowParticipantRepository workflowParticipantRepository;
    @Mock private AuthorizationEngineService authorizationEngineService;

    private RevisionWorkflowAuthorizationService newService() {
        return new RevisionWorkflowAuthorizationService(
                auditTrailService, workflowParticipantRepository, authorizationEngineService);
    }

    private DocumentRevisionRecord revision(String statusCode) {
        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(java.util.UUID.randomUUID());
        RevisionStatusDefinition status = new RevisionStatusDefinition();
        status.setCode(statusCode);
        revision.setStatus(status);
        revision.setDocument(new DocumentRecord());
        return revision;
    }

    @Test
    void wrongStatus_completeReview_deniedAsInvalidState() {
        DocumentRevisionRecord r = revision("DRAFT"); // should be PENDING_REVIEW
        Optional<String> reason = newService().checkStatePrecondition(
                r, RevisionWorkflowAction.COMPLETE_REVIEW, RevisionWorkflowAuthorizationContext.of(r));
        assertThat(reason).contains("INVALID_WORKFLOW_STATE");
    }

    @Test
    void correctStatus_completeReview_noPreconditionViolation() {
        DocumentRevisionRecord r = revision("PENDING_REVIEW");
        Optional<String> reason = newService().checkStatePrecondition(
                r, RevisionWorkflowAction.COMPLETE_REVIEW, RevisionWorkflowAuthorizationContext.of(r));
        assertThat(reason).isEmpty();
    }

    @Test
    void cancel_terminalStatus_denied() {
        DocumentRevisionRecord r = revision("EFFECTIVE"); // CANCEL requires DRAFT
        Optional<String> reason = newService().checkStatePrecondition(
                r, RevisionWorkflowAction.CANCEL, RevisionWorkflowAuthorizationContext.of(r));
        assertThat(reason).contains("INVALID_WORKFLOW_STATE");
    }

    @Test
    void upgradeRevision_notEffective_denied() {
        DocumentRevisionRecord r = revision("DRAFT"); // UPGRADE_REVISION requires EFFECTIVE
        Optional<String> reason = newService().checkStatePrecondition(
                r, RevisionWorkflowAction.UPGRADE_REVISION, RevisionWorkflowAuthorizationContext.of(r));
        assertThat(reason).contains("INVALID_WORKFLOW_STATE");
    }

    @Test
    void completeAuthoring_alreadyCompleted_denied() {
        DocumentRevisionRecord r = revision("DRAFT");
        r.setEditingStatus("COMPLETED");
        r.setSourceLocked(true);
        Optional<String> reason = newService().checkStatePrecondition(
                r, RevisionWorkflowAction.COMPLETE_AUTHORING, RevisionWorkflowAuthorizationContext.of(r));
        assertThat(reason).contains("EDITING_ALREADY_COMPLETED");
    }

    @Test
    void submitForReview_editingNotCompleted_denied() {
        DocumentRevisionRecord r = revision("DRAFT");
        r.setEditingStatus("IN_PROGRESS");
        r.setSourceLocked(false);
        Optional<String> reason = newService().checkStatePrecondition(
                r, RevisionWorkflowAction.SUBMIT_FOR_REVIEW, RevisionWorkflowAuthorizationContext.of(r));
        assertThat(reason).contains("EDITING_NOT_COMPLETED");
    }

    @Test
    void submitForReview_editingCompletedAndLocked_noPreconditionViolation() {
        DocumentRevisionRecord r = revision("DRAFT");
        r.setEditingStatus("COMPLETED");
        r.setSourceLocked(true);
        Optional<String> reason = newService().checkStatePrecondition(
                r, RevisionWorkflowAction.SUBMIT_FOR_REVIEW, RevisionWorkflowAuthorizationContext.of(r));
        assertThat(reason).isEmpty();
    }

    @Test
    void nullRevision_returnsEmpty_notAnException() {
        Optional<String> reason = newService().checkStatePrecondition(
                null, RevisionWorkflowAction.COMPLETE_REVIEW, null);
        assertThat(reason).isEmpty();
    }
}
