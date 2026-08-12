package com.eqms.service;

import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentStatusDefinition;
import com.eqms.entity.UserAccount;
import com.eqms.service.authorization.AuthorizationDecision;
import com.eqms.service.authorization.AuthorizationEngineService;
import com.eqms.service.authorization.AuthorizationRequest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * DOCUMENT completed its hybrid-engine cutover (SECURITY_AUTHORIZATION_HYBRID_REFACTOR_PLAN.md §7
 * cutover rule 5) -- {@link AuthorizationEngineService} is the sole decision authority, no legacy
 * fallback. These tests replace the pre-cutover suite that exercised the removed
 * lifecycle-policy-evaluator branch and legacy/new shadow comparison.
 */
@ExtendWith(MockitoExtension.class)
class DocumentMasterWorkflowAuthorizationServiceTest {

    @Mock private AuthorizationEngineService authorizationEngineService;

    private DocumentMasterWorkflowAuthorizationService newService() {
        return new DocumentMasterWorkflowAuthorizationService(authorizationEngineService);
    }

    @Test
    void allowsWhenEngineAllows() {
        DocumentMasterWorkflowAuthorizationService service = newService();
        UserAccount user = user();
        DocumentRecord document = activeDocument();
        when(authorizationEngineService.authorize(any(AuthorizationRequest.class)))
                .thenReturn(AuthorizationDecision.allow("documents.document.obsolete", List.of(), List.of(), 1L, "ACTIVE", Map.of()));

        var decision = service.check(user, document, "OBSOLETE");

        assertThat(decision.allowed()).isTrue();
        assertThat(decision.requiredPermissionCode()).isEqualTo("documents.document.obsolete");
    }

    @Test
    void deniesWhenEngineDenies_andPassesThroughReasonCode() {
        DocumentMasterWorkflowAuthorizationService service = newService();
        UserAccount user = user();
        DocumentRecord document = activeDocument();
        when(authorizationEngineService.authorize(any(AuthorizationRequest.class)))
                .thenReturn(AuthorizationDecision.deny("ACTOR_NOT_ALLOWED", "documents.document.obsolete", "ACTIVE"));

        var decision = service.check(user, document, "OBSOLETE");

        assertThat(decision.allowed()).isFalse();
        assertThat(decision.reasonCode()).isEqualTo("ACTOR_NOT_ALLOWED");
    }

    @Test
    void requestSentToEngineCarriesResourceTypeIdAndAction() {
        DocumentMasterWorkflowAuthorizationService service = newService();
        UserAccount user = user();
        DocumentRecord document = activeDocument();
        when(authorizationEngineService.authorize(any(AuthorizationRequest.class)))
                .thenReturn(AuthorizationDecision.allow("documents.document.obsolete", List.of(), List.of(), 1L, "ACTIVE", Map.of()));

        service.check(user, document, "OBSOLETE");

        org.mockito.Mockito.verify(authorizationEngineService).authorize(org.mockito.ArgumentMatchers.argThat(req ->
                "DOCUMENT".equals(req.resourceType())
                        && document.getId().equals(req.resourceId())
                        && "OBSOLETE".equals(req.actionCode())));
    }

    @Test
    void failsClosedWhenEngineThrows() {
        DocumentMasterWorkflowAuthorizationService service = newService();
        UserAccount user = user();
        DocumentRecord document = activeDocument();
        when(authorizationEngineService.authorize(any(AuthorizationRequest.class)))
                .thenThrow(new RuntimeException("boom"));

        var decision = service.check(user, document, "OBSOLETE");

        assertThat(decision.allowed()).isFalse();
        assertThat(decision.reasonCode()).isEqualTo("AUTHORIZATION_ENGINE_ERROR");
    }

    @Test
    void deniesWithoutCallingEngine_whenInputIsIncomplete() {
        DocumentMasterWorkflowAuthorizationService service = newService();

        var decision = service.check(null, activeDocument(), "OBSOLETE");

        assertThat(decision.allowed()).isFalse();
        assertThat(decision.reasonCode()).isEqualTo("WORKFLOW_ACTION_NOT_ALLOWED");
        org.mockito.Mockito.verifyNoInteractions(authorizationEngineService);
    }

    private UserAccount user() {
        UserAccount user = new UserAccount();
        user.setId(UUID.randomUUID());
        return user;
    }

    private DocumentRecord activeDocument() {
        DocumentStatusDefinition status = new DocumentStatusDefinition();
        status.setCode("ACTIVE");
        DocumentRecord document = new DocumentRecord();
        document.setId(UUID.randomUUID());
        document.setStatus(status);
        return document;
    }
}
