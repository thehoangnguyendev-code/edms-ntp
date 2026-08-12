package com.eqms.service;

import com.eqms.dto.security.RevisionWorkflowAuthorizationContext;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.RevisionStatusDefinition;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.entity.UserAccount;
import com.eqms.enums.RevisionWorkflowAction;
import com.eqms.exception.WorkflowAuthorizationDeniedException;
import com.eqms.repository.WorkflowParticipantRepository;
import com.eqms.service.authorization.AuthorizationDecision;
import com.eqms.service.authorization.AuthorizationEngineService;
import com.eqms.service.authorization.AuthorizationRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * REVISION completed its hybrid-engine cutover (SECURITY_AUTHORIZATION_HYBRID_REFACTOR_PLAN.md §7
 * cutover rule 5) -- {@link AuthorizationEngineService} is the sole decision authority, no legacy
 * fallback. Replaces the pre-cutover suite that exercised the removed feature-flag on/off branching.
 */
@ExtendWith(MockitoExtension.class)
class RevisionWorkflowAuthorizationServiceCutoverTest {

    @Mock private AuditTrailService auditTrailService;
    @Mock private WorkflowParticipantRepository workflowParticipantRepository;
    @Mock private AuthorizationEngineService authorizationEngineService;

    private UserAccount user;
    private DocumentRevisionRecord revision;
    private RevisionWorkflowAuthorizationContext context;

    private RevisionWorkflowAuthorizationService newService() {
        return new RevisionWorkflowAuthorizationService(
                auditTrailService, workflowParticipantRepository, authorizationEngineService);
    }

    @BeforeEach
    void setUp() {
        user = new UserAccount();
        user.setId(UUID.randomUUID());
        user.setStatus(UserStatus.Active);

        revision = new DocumentRevisionRecord();
        revision.setId(UUID.randomUUID());
        RevisionStatusDefinition status = new RevisionStatusDefinition();
        status.setCode("DRAFT");
        revision.setStatus(status);
        revision.setDocument(new DocumentRecord());
        context = RevisionWorkflowAuthorizationContext.of(revision);
    }

    @Test
    void allowsWhenEngineAllows() {
        when(authorizationEngineService.authorize(any(AuthorizationRequest.class)))
                .thenReturn(AuthorizationDecision.allow("documents.revision.upload_source", List.of(), List.of("AUTHOR"), 1L, "DRAFT", Map.of()));

        var decision = newService().check(user, revision, RevisionWorkflowAction.UPLOAD_SOURCE, context);

        assertThat(decision.allowed()).isTrue();
    }

    @Test
    void deniesWhenEngineDenies_andPassesThroughReasonCode() {
        when(authorizationEngineService.authorize(any(AuthorizationRequest.class)))
                .thenReturn(AuthorizationDecision.deny("OUT_OF_SCOPE", "documents.revision.upload_source", "DRAFT"));

        var decision = newService().check(user, revision, RevisionWorkflowAction.UPLOAD_SOURCE, context);

        assertThat(decision.allowed()).isFalse();
        assertThat(decision.reasonCode()).isEqualTo("OUT_OF_SCOPE");
    }

    @Test
    void requestSentToEngineCarriesResourceTypeIdAndAction() {
        when(authorizationEngineService.authorize(any(AuthorizationRequest.class)))
                .thenReturn(AuthorizationDecision.allow("documents.revision.upload_source", List.of(), List.of("AUTHOR"), 1L, "DRAFT", Map.of()));

        newService().check(user, revision, RevisionWorkflowAction.UPLOAD_SOURCE, context);

        verify(authorizationEngineService).authorize(argThat(req ->
                "REVISION".equals(req.resourceType())
                        && revision.getId().equals(req.resourceId())
                        && "UPLOAD_SOURCE".equals(req.actionCode())));
    }

    @Test
    void failsClosedWhenEngineThrows() {
        when(authorizationEngineService.authorize(any(AuthorizationRequest.class)))
                .thenThrow(new RuntimeException("boom"));

        var decision = newService().check(user, revision, RevisionWorkflowAction.UPLOAD_SOURCE, context);

        assertThat(decision.allowed()).isFalse();
        assertThat(decision.reasonCode()).isEqualTo("AUTHORIZATION_ENGINE_ERROR");
    }

    @Test
    void deniesWithoutCallingEngine_whenInputIsIncomplete() {
        var decision = newService().check(null, revision, RevisionWorkflowAction.UPLOAD_SOURCE, context);

        assertThat(decision.allowed()).isFalse();
        assertThat(decision.reasonCode()).isEqualTo("WORKFLOW_ACTION_NOT_ALLOWED");
        verifyNoInteractions(authorizationEngineService);
    }

    @Test
    void require_throwsOnDenial() {
        when(authorizationEngineService.authorize(any(AuthorizationRequest.class)))
                .thenReturn(AuthorizationDecision.deny("INVALID_WORKFLOW_STATE", "documents.revision.submit_review", "DRAFT"));

        assertThatThrownBy(() ->
                newService().require(user, revision, RevisionWorkflowAction.SUBMIT_FOR_REVIEW, context)
        ).isInstanceOf(WorkflowAuthorizationDeniedException.class)
                .satisfies(ex -> {
                    WorkflowAuthorizationDeniedException wex = (WorkflowAuthorizationDeniedException) ex;
                    assertThat(wex.getReasonCode()).isEqualTo("INVALID_WORKFLOW_STATE");
                    assertThat(wex.getAction()).isEqualTo(RevisionWorkflowAction.SUBMIT_FOR_REVIEW);
                });
    }

    @Test
    void require_noThrowOnSuccess() {
        when(authorizationEngineService.authorize(any(AuthorizationRequest.class)))
                .thenReturn(AuthorizationDecision.allow("documents.revision.cancel", List.of(), List.of("AUTHOR"), 1L, "DRAFT", Map.of()));

        newService().require(user, revision, RevisionWorkflowAction.CANCEL, context);
        // no exception
    }

    @Test
    void require_onDenial_logsAudit() {
        when(authorizationEngineService.authorize(any(AuthorizationRequest.class)))
                .thenReturn(AuthorizationDecision.deny("EDITING_ALREADY_COMPLETED", "documents.revision.complete_authoring", "DRAFT"));

        try {
            newService().require(user, revision, RevisionWorkflowAction.COMPLETE_AUTHORING, context);
        } catch (WorkflowAuthorizationDeniedException ignored) {
        }

        verify(auditTrailService).logAs(
                eq(user), eq("REVISION"), any(), eq(revision.getId()),
                eq("WORKFLOW_ACCESS_DENIED"), any(), any(), any());
    }
}
