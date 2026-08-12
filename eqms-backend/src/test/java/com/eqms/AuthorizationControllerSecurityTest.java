package com.eqms;

import com.eqms.auth.CurrentUserService;
import com.eqms.controller.AuthorizationController;
import com.eqms.dto.security.AuthorizationEvaluateRequest;
import com.eqms.entity.AuthorizationRelationDefinition;
import com.eqms.entity.UserAccount;
import com.eqms.repository.AuthorizationRelationDefinitionRepository;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.service.authorization.AuthorizationDecision;
import com.eqms.service.authorization.AuthorizationEngineService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

/** Verifies the new /authorization/* endpoints enforce the correct permission gate. */
@ExtendWith(MockitoExtension.class)
class AuthorizationControllerSecurityTest {

    @Mock AuthorizationEngineService engine;
    @Mock AuthorizationRelationDefinitionRepository relationDefinitionRepository;
    @Mock CurrentUserService currentUserService;
    @Mock PermissionEvaluationService permissionEvaluationService;
    @Mock UserAccountRepository userAccountRepository;

    AuthorizationController controller;

    UserAccount caller;
    UserAccount subject;

    @BeforeEach
    void setUp() {
        controller = new AuthorizationController(
                engine, relationDefinitionRepository, currentUserService, permissionEvaluationService, userAccountRepository);
        caller = new UserAccount();
        caller.setId(UUID.randomUUID());
        subject = new UserAccount();
        subject.setId(UUID.randomUUID());
        lenient().when(currentUserService.requireCurrentUser()).thenReturn(caller);
    }

    @Test
    void evaluate_withoutAccessProfileUpdatePermission_denied() {
        when(permissionEvaluationService.hasPermission(caller, "security.access_profiles.update")).thenReturn(false);

        assertThatThrownBy(() -> controller.evaluate(
                new AuthorizationEvaluateRequest(subject.getId(), "REVISION", UUID.randomUUID(), "SUBMIT_FOR_REVIEW", null)))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void evaluate_withPermission_delegatesToEngine() {
        when(permissionEvaluationService.hasPermission(caller, "security.access_profiles.update")).thenReturn(true);
        when(userAccountRepository.findById(subject.getId())).thenReturn(Optional.of(subject));
        UUID resourceId = UUID.randomUUID();
        AuthorizationDecision expected = AuthorizationDecision.deny("UNSUPPORTED_RESOURCE_TYPE");
        when(engine.authorize(any())).thenReturn(expected);

        AuthorizationDecision result = controller.evaluate(
                new AuthorizationEvaluateRequest(subject.getId(), "REVISION", resourceId, "SUBMIT_FOR_REVIEW", null));

        assertThat(result).isEqualTo(expected);
    }

    @Test
    void relationDefinitions_withoutViewPermission_denied() {
        when(permissionEvaluationService.hasAnyPermission(caller,
                "security.workflow_authorization.view", "security.workflow_authorization.manage")).thenReturn(false);

        assertThatThrownBy(() -> controller.relationDefinitions(null))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void relationDefinitions_withViewPermission_returnsMappedList() {
        when(permissionEvaluationService.hasAnyPermission(caller,
                "security.workflow_authorization.view", "security.workflow_authorization.manage")).thenReturn(true);
        AuthorizationRelationDefinition def = new AuthorizationRelationDefinition();
        def.setCode("AUTHOR");
        def.setResourceType("REVISION");
        when(relationDefinitionRepository.findAllByOrderByResourceTypeAscCodeAsc()).thenReturn(List.of(def));

        var result = controller.relationDefinitions(null);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).code()).isEqualTo("AUTHOR");
    }

    @Test
    void relationDefinitions_filteredByResourceType_usesFilteredQuery() {
        when(permissionEvaluationService.hasAnyPermission(caller,
                "security.workflow_authorization.view", "security.workflow_authorization.manage")).thenReturn(true);
        when(relationDefinitionRepository.findAllByResourceTypeAndActiveTrueOrderByCodeAsc("CONTROLLED_COPY"))
                .thenReturn(List.of());

        var result = controller.relationDefinitions("CONTROLLED_COPY");

        assertThat(result).isEmpty();
    }
}
