package com.eqms.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.knowledge.KnowledgeComponentDtos.ComponentRequest;
import com.eqms.entity.KnowledgeCategoryComponent;
import com.eqms.entity.UserAccount;
import com.eqms.exception.RevisionLifecycleConflictException;
import com.eqms.repository.KnowledgeCategoryComponentRepository;
import com.eqms.repository.KnowledgeCategoryHierarchyRepository;
import com.eqms.repository.KnowledgeCategoryLevelRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class KnowledgeComponentServiceTest {

    @Mock private KnowledgeCategoryComponentRepository repository;
    @Mock private KnowledgeCategoryHierarchyRepository hierarchyRepository;
    @Mock private KnowledgeCategoryLevelRepository levelRepository;
    @Mock private CurrentUserService currentUserService;
    @Mock private PermissionEvaluationService permissionEvaluationService;
    @Mock private AuditTrailService auditTrailService;

    private KnowledgeComponentService service;
    private UserAccount actor;

    @BeforeEach
    void setUp() {
        service = new KnowledgeComponentService(repository, hierarchyRepository, levelRepository, currentUserService,
                permissionEvaluationService, auditTrailService);
        actor = new UserAccount();
        actor.setId(UUID.randomUUID());
        lenient().when(currentUserService.requireCurrentUser()).thenReturn(actor);
        lenient().when(permissionEvaluationService.hasPermission(actor, "documents.admin.knowledge_categories.manage")).thenReturn(true);
        lenient().when(permissionEvaluationService.hasAnyPermission(any(), any(), any())).thenReturn(true);
        lenient().when(repository.save(any(KnowledgeCategoryComponent.class))).thenAnswer(i -> {
            KnowledgeCategoryComponent c = i.getArgument(0);
            if (c.getId() == null) ReflectionTestUtils.setField(c, "id", UUID.randomUUID());
            return c;
        });
    }

    private KnowledgeCategoryComponent existing(String name, String source, boolean active, boolean system) {
        KnowledgeCategoryComponent c = new KnowledgeCategoryComponent();
        ReflectionTestUtils.setField(c, "id", UUID.randomUUID());
        ReflectionTestUtils.setField(c, "systemDefined", system);
        c.setName(name);
        c.setSourceField(source);
        c.setActive(active);
        lenient().when(repository.findById(c.getId())).thenReturn(Optional.of(c));
        return c;
    }

    @Test
    void managePermissionIsRequiredToWrite() {
        when(permissionEvaluationService.hasPermission(actor, "documents.admin.knowledge_categories.manage")).thenReturn(false);
        assertThrows(AccessDeniedException.class, () -> service.create(new ComponentRequest("Author", "AUTHOR", null, true)));
        verify(repository, never()).save(any());
    }

    @Test
    void createRequiresNameAndAKnownSourceThatIsNotTakenYet() {
        assertThrows(IllegalArgumentException.class, () -> service.create(new ComponentRequest(" ", "AUTHOR", null, true)));
        assertThrows(IllegalArgumentException.class, () -> service.create(new ComponentRequest("A", null, null, true)));
        assertThrows(IllegalArgumentException.class, () -> service.create(new ComponentRequest("A", "PASSWORD_HASH", null, true)));
        when(repository.existsBySourceField("AUTHOR")).thenReturn(true);
        assertThrows(IllegalArgumentException.class, () -> service.create(new ComponentRequest("Author", "AUTHOR", null, true)));
        when(repository.existsBySourceField("OWNER")).thenReturn(false);
        when(repository.existsByNameIgnoreCase("Dup")).thenReturn(true);
        assertThrows(IllegalArgumentException.class, () -> service.create(new ComponentRequest("Dup", "OWNER", null, true)));
    }

    @Test
    void createSavesAndAuditsTheNewComponent() {
        var created = service.create(new ComponentRequest("Document Author", "AUTHOR", "who wrote it", true));
        assertEquals("AUTHOR", created.sourceField());
        assertFalse(created.systemDefined());
        assertTrue(created.determinatorEligible() == false);
        verify(auditTrailService).logAs(eq(actor), eq("KNOWLEDGE_COMPONENT"), eq("Document Author"), any(),
                eq("KNOWLEDGE_COMPONENT_CREATED"), any(), any(), any(), any());
    }

    @Test
    void theSourceFieldCannotBeChanged() {
        KnowledgeCategoryComponent c = existing("Author", "AUTHOR", true, false);
        assertThrows(IllegalArgumentException.class, () -> service.update(c.getId(), new ComponentRequest("Author", "OWNER", null, true)));
    }

    @Test
    void aComponentInUseCannotBeDeactivatedOrDeleted() {
        KnowledgeCategoryComponent c = existing("Author", "AUTHOR", true, false);
        when(levelRepository.countHierarchiesUsingLevel("AUTHOR")).thenReturn(2L);
        assertThrows(RevisionLifecycleConflictException.class, () -> service.update(c.getId(), new ComponentRequest("Author", null, null, false)));
        assertThrows(RevisionLifecycleConflictException.class, () -> service.delete(c.getId()));
        verify(repository, never()).delete(any(KnowledgeCategoryComponent.class));
    }

    @Test
    void aSystemDefinedComponentCannotBeDeleted() {
        KnowledgeCategoryComponent c = existing("Department", "DEPARTMENT", true, true);
        assertThrows(RevisionLifecycleConflictException.class, () -> service.delete(c.getId()));
    }

    @Test
    void anUnusedCustomComponentCanBeRenamedDeactivatedAndDeleted() {
        KnowledgeCategoryComponent c = existing("Author", "AUTHOR", true, false);
        var updated = service.update(c.getId(), new ComponentRequest("Written by", null, "d", false));
        assertEquals("Written by", updated.name());
        assertFalse(updated.active());
        service.delete(c.getId());
        verify(repository).delete(c);
    }

    @Test
    void availableSourcesListsOnlyFieldsWithoutAComponent() {
        when(repository.existsBySourceField(any())).thenReturn(true);
        when(repository.existsBySourceField("AUTHOR")).thenReturn(false);
        List<String> sources = service.availableSources().stream().map(s -> s.value()).toList();
        assertEquals(List.of("AUTHOR"), sources);
    }

    @Test
    void listFiltersSearchesAndSortsOnTheServer() {
        KnowledgeCategoryComponent a = existing("Alpha", "AUTHOR", true, false);
        KnowledgeCategoryComponent b = existing("Beta", "OWNER", false, false);
        when(repository.findAll()).thenReturn(List.of(a, b));
        assertEquals(1, service.list("alp", null, null, null, 1, 10, "name", "asc").pagination().total());
        assertEquals(1, service.list(null, "INACTIVE", null, null, 1, 10, "name", "asc").pagination().total());
        assertEquals("Beta", service.list(null, null, null, null, 1, 10, "name", "desc").data().get(0).name());
        assertEquals(1, service.list("owner", null, null, null, 1, 10, "name", "asc").pagination().total());
    }
}
