package com.eqms.service;

import com.eqms.entity.UserAccount;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class WorkflowDiagramServiceTest {
    private static final String XML = "<mxfile><diagram/></mxfile>";
    private static final String SVG = "<svg xmlns=\"http://www.w3.org/2000/svg\"/>";

    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final PermissionEvaluationService permissions = mock(PermissionEvaluationService.class);
    private final AuditTrailService audit = mock(AuditTrailService.class);
    private final UserAccount actor = mock(UserAccount.class);
    private final UUID id = UUID.randomUUID();
    private WorkflowDiagramService service;

    @BeforeEach
    void setUp() {
        service = new WorkflowDiagramService(jdbc, permissions, audit);
        Map<String, Object> row = new HashMap<>(Map.of("id", id, "module", "TRAINING", "name", "Training flow", "version_no", 3));
        when(jdbc.queryForList(anyString(), any(Object[].class))).thenReturn(List.of(row));
    }

    private void holds(String... codes) {
        for (String code : codes) when(permissions.hasPermission(actor, code)).thenReturn(true);
    }

    @Test
    void aPersonWhoOnlyViewsCannotChangeAnything() {
        holds("training.module.view", "training.workflow_diagram.view");
        assertThatThrownBy(() -> service.save(actor, id, 3, XML, SVG, "New step")).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> service.delete(actor, id, "Not needed")).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> service.create(actor, "TRAINING", "Another", null)).isInstanceOf(AccessDeniedException.class);
        assertThat(service.get(actor, id).get("canManage")).isEqualTo(false);
        verifyNoInteractions(audit);
    }

    @Test
    void thePermissionOfTheOtherModuleOpensNothing() {
        holds("documents.module.view", "documents.workflow_diagram.manage", "training.module.view");
        assertThatThrownBy(() -> service.get(actor, id)).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void aSaveOverAVersionThatWasNotSeenIsRefused() {
        holds("training.module.view", "training.workflow_diagram.manage");
        assertThatThrownBy(() -> service.save(actor, id, 2, XML, SVG, "New step"))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("WORKFLOW_DIAGRAM_CHANGED");
        verify(jdbc, never()).update(anyString(), any(Object[].class));
        verifyNoInteractions(audit);
    }

    @Test
    void aSaveNeedsAReasonAndADrawing() {
        holds("training.module.view", "training.workflow_diagram.manage");
        assertThatThrownBy(() -> service.save(actor, id, 3, XML, SVG, "  ")).hasMessageContaining("WORKFLOW_DIAGRAM_REASON_REQUIRED");
        assertThatThrownBy(() -> service.save(actor, id, 3, "<html/>", SVG, "New step")).hasMessageContaining("WORKFLOW_DIAGRAM_CONTENT_INVALID");
        assertThatThrownBy(() -> service.save(actor, id, 3, XML, "<?xml version=\"1.0\"?><html/>", "New step")).hasMessageContaining("WORKFLOW_DIAGRAM_CONTENT_INVALID");
        verifyNoInteractions(audit);
    }

    @Test
    void aSaveKeepsTheVersionAndWritesWhy() {
        holds("training.module.view", "training.workflow_diagram.manage");
        service.save(actor, id, 3, XML, SVG, "New approval step");
        verify(jdbc).update(contains("insert into workflow_diagram_versions"), any(), any(), any(), any(), any(), any(), any());
        verify(audit).logAsWithUserReason(any(), anyString(), anyString(), any(), anyString(), any(), any(), anyString(), contains("New approval step"), any(), any());
    }
}
