package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.entity.UserAccount;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.security.access.AccessDeniedException;

import java.lang.reflect.Constructor;
import java.util.Arrays;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** The Knowledge Base is closed on the server to a user without self_service.knowledge.view: the menu is only a hint. */
class KnowledgeServerPermissionTest {

    private final PermissionEvaluationService permissions = Mockito.mock(PermissionEvaluationService.class);
    private final CurrentUserService current = Mockito.mock(CurrentUserService.class);
    private final SystemConfigurationService configuration = Mockito.mock(SystemConfigurationService.class);
    private final UserAccount user = new UserAccount();

    private DocumentService service() throws Exception {
        user.setId(UUID.randomUUID());
        when(current.requireCurrentUser()).thenReturn(user);
        Constructor<?> constructor = DocumentService.class.getConstructors()[0];
        Object[] arguments = Arrays.stream(constructor.getParameterTypes()).map(type -> {
            if (type == PermissionEvaluationService.class) return permissions;
            if (type == CurrentUserService.class) return current;
            if (type == SystemConfigurationService.class) return configuration;
            return Mockito.mock(type);
        }).toArray();
        return (DocumentService) constructor.newInstance(arguments);
    }

    @Test
    void aUserWithoutTheKnowledgePermissionGetsNothingEvenWithTheKnowledgeViewAll() throws Exception {
        DocumentService service = service();
        when(permissions.hasPermission(user, KnowledgeVisibilityService.KNOWLEDGE_VIEW_PERMISSION)).thenReturn(false);
        when(permissions.hasPermission(user, KnowledgeVisibilityService.KNOWLEDGE_VIEW_ALL_PERMISSION)).thenReturn(true);

        assertThatThrownBy(service::visibleKnowledgeEntries).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> service.previewKnowledgeDocumentFile(UUID.randomUUID())).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(service::getKnowledgeBase).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void theDocumentControlPermissionsDoNotOpenTheKnowledgeBase() throws Exception {
        DocumentService service = service();
        when(permissions.hasPermission(any(UserAccount.class), any(String.class))).thenAnswer(invocation ->
                !KnowledgeVisibilityService.KNOWLEDGE_VIEW_PERMISSION.equals(invocation.getArgument(1)));

        assertThatThrownBy(service::visibleKnowledgeEntries).isInstanceOf(AccessDeniedException.class);
        assertThat(KnowledgeVisibilityService.KNOWLEDGE_VIEW_PERMISSION).isEqualTo("self_service.knowledge.view");
        verify(permissions, never()).hasPermission(user, "documents.module.view");
    }
}
