package com.eqms.controller;

import com.eqms.dto.knowledge.KnowledgeSharingDtos.Managed;
import com.eqms.service.KnowledgeShareDelegateService;
import com.eqms.service.KnowledgeShareLinkService;
import com.eqms.service.KnowledgeSharingService;
import com.eqms.service.SystemConfigurationService;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** Sharing exists only while the Knowledge Base visibility is "Sharing": in every other mode there is nothing to share. */
class KnowledgeSharingControllerTest {
    private final KnowledgeSharingService service = mock(KnowledgeSharingService.class);
    private final KnowledgeShareDelegateService delegates = mock(KnowledgeShareDelegateService.class);
    private final KnowledgeShareLinkService links = mock(KnowledgeShareLinkService.class);
    private final SystemConfigurationService configuration = mock(SystemConfigurationService.class);
    private final KnowledgeSharingController controller = new KnowledgeSharingController(service, delegates, links, configuration);

    @Test
    void inEveryModeButSharingNobodyManagesAnything_soTheShareMenuIsNotOffered() {
        for (String mode : new String[] {SystemConfigurationService.KNOWLEDGE_VISIBILITY_OWN_DEPARTMENT,
                SystemConfigurationService.KNOWLEDGE_VISIBILITY_OWN_BUSINESS_UNIT, SystemConfigurationService.KNOWLEDGE_VISIBILITY_ALL}) {
            when(configuration.getKnowledgeVisibilityMode()).thenReturn(mode);
            Managed managed = controller.managed().getBody();
            assertThat(managed.departmentIds()).as(mode).isEmpty();
            assertThat(managed.businessUnitIds()).as(mode).isEmpty();
        }
        verifyNoInteractions(service);
    }

    @Test
    void sharingCannotBeDoneThroughTheApiEither() {
        when(configuration.getKnowledgeVisibilityMode()).thenReturn(SystemConfigurationService.KNOWLEDGE_VISIBILITY_OWN_BUSINESS_UNIT);
        UUID id = UUID.randomUUID();
        assertThatThrownBy(() -> controller.access("DEPARTMENT", null, id, null, null)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.revoke(id)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.users("a", 20, 0, null, null, null)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.removeDelegate(id)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.revokeLink(id)).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(service, delegates, links);
    }

    @Test
    void underSharingTheServiceIsAsked() {
        when(configuration.getKnowledgeVisibilityMode()).thenReturn(SystemConfigurationService.KNOWLEDGE_VISIBILITY_SHARING);
        Managed managed = new Managed(List.of(UUID.randomUUID()), List.of());
        when(service.managed()).thenReturn(managed);
        assertThat(controller.managed().getBody()).isSameAs(managed);
        UUID id = UUID.randomUUID();
        controller.revoke(id);
        verify(service).revoke(id);
        verify(service, never()).people(null, null, null, null, null, null, false, 0, 20);
    }
}
