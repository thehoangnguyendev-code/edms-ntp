package com.eqms.service;

import com.eqms.dto.security.WorkflowAuthorizationDecision;
import com.eqms.entity.UserAccount;
import com.eqms.enums.RevisionWorkflowAction;
import com.eqms.service.authorization.AuthorizationDecision;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class AuthorizationShadowEvaluationServiceTest {

    @Mock private JdbcTemplate jdbc;

    private AuthorizationShadowEvaluationService service;
    private UserAccount user;
    private UUID resourceId;

    @BeforeEach
    void setUp() {
        service = new AuthorizationShadowEvaluationService(jdbc);
        user = new UserAccount();
        user.setId(UUID.randomUUID());
        resourceId = UUID.randomUUID();
    }

    @Test
    void recordMismatch_disagreement_insertsRow() {
        AuthorizationDecision policyDecision = AuthorizationDecision.deny("OUT_OF_SCOPE");

        service.recordMismatch(user, "REVISION", resourceId, "SUBMIT_FOR_REVIEW",
                policyDecision, true, "ALLOWED_LEGACY");

        verify(jdbc).update(anyString(),
                eq("REVISION"), eq(resourceId), eq("SUBMIT_FOR_REVIEW"), eq(user.getId()),
                eq(false), eq("OUT_OF_SCOPE"), eq(true), eq("ALLOWED_LEGACY"));
    }

    @Test
    void recordMismatch_agreement_noInsert() {
        AuthorizationDecision policyDecision = AuthorizationDecision.allow(
                "documents.revision.submit_review", List.of(), List.of("AUTHOR"), 1L, "DRAFT", Map.of());

        service.recordMismatch(user, "REVISION", resourceId, "SUBMIT_FOR_REVIEW",
                policyDecision, true, null);

        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }

    @Test
    void recordMismatch_missingUser_noInsert() {
        service.recordMismatch(null, "REVISION", resourceId, "SUBMIT_FOR_REVIEW",
                AuthorizationDecision.deny("USER_NOT_ACTIVE"), true, null);

        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }

    @Test
    void recordRevisionMismatch_delegatesAsDocumentRevisionResourceType() {
        WorkflowAuthorizationDecision policyDecision = WorkflowAuthorizationDecision.denied(
                "ACTOR_NOT_ALLOWED", "not allowed", "documents.revision.submit_review",
                RevisionWorkflowAction.SUBMIT_FOR_REVIEW, resourceId, "DRAFT");
        WorkflowAuthorizationDecision legacyDecision = WorkflowAuthorizationDecision.allowed(
                RevisionWorkflowAction.SUBMIT_FOR_REVIEW, resourceId, "DRAFT", false, false);

        service.recordRevisionMismatch(user, resourceId, RevisionWorkflowAction.SUBMIT_FOR_REVIEW,
                policyDecision, legacyDecision);

        verify(jdbc).update(anyString(),
                eq("DOCUMENT_REVISION"), eq(resourceId), eq("SUBMIT_FOR_REVIEW"), eq(user.getId()),
                eq(false), eq("ACTOR_NOT_ALLOWED"), eq(true), eq((String) null));
    }
}
