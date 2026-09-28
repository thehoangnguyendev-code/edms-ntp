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
import com.eqms.dto.knowledge.KnowledgeHierarchyDtos.HierarchyRequest;
import com.eqms.dto.knowledge.KnowledgeHierarchyDtos.LevelRequest;
import com.eqms.entity.KnowledgeCategoryHierarchy;
import com.eqms.entity.UserAccount;
import com.eqms.exception.RevisionLifecycleConflictException;
import com.eqms.repository.KnowledgeCategoryHierarchyRepository;
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
class KnowledgeHierarchyServiceTest {

    @Mock private KnowledgeCategoryHierarchyRepository repository;
    @Mock private CurrentUserService currentUserService;
    @Mock private PermissionEvaluationService permissionEvaluationService;
    @Mock private AuditTrailService auditTrailService;
    @Mock private KnowledgeComponentService componentService;

    private KnowledgeHierarchyService service;
    private UserAccount actor;

    @BeforeEach
    void setUp() {
        service = new KnowledgeHierarchyService(repository, currentUserService, permissionEvaluationService, auditTrailService, componentService);
        lenient().when(componentService.isActiveSource(any())).thenReturn(true);
        lenient().when(componentService.nameOf(any())).thenAnswer(i -> com.eqms.enums.KnowledgeField.parse(i.getArgument(0)).map(com.eqms.enums.KnowledgeField::label).orElse(i.getArgument(0)));
        actor = new UserAccount();
        actor.setId(UUID.randomUUID());
        lenient().when(currentUserService.requireCurrentUser()).thenReturn(actor);
        lenient().when(permissionEvaluationService.hasPermission(actor, "documents.admin.knowledge_categories.manage")).thenReturn(true);
        lenient().when(repository.save(any(KnowledgeCategoryHierarchy.class))).thenAnswer(i -> {
            KnowledgeCategoryHierarchy h = i.getArgument(0);
            if (h.getId() == null) ReflectionTestUtils.setField(h, "id", UUID.randomUUID());
            return h;
        });
    }

    private KnowledgeCategoryHierarchy existing(String name, String determinator, boolean active, boolean def) {
        KnowledgeCategoryHierarchy h = new KnowledgeCategoryHierarchy();
        ReflectionTestUtils.setField(h, "id", UUID.randomUUID());
        h.setName(name);
        h.setDeterminatorField(determinator);
        h.setActive(active);
        h.setDefaultHierarchy(def);
        lenient().when(repository.findById(h.getId())).thenReturn(Optional.of(h));
        return h;
    }

    @Test
    void managePermissionIsRequiredToWrite() {
        when(permissionEvaluationService.hasPermission(actor, "documents.admin.knowledge_categories.manage")).thenReturn(false);
        assertThrows(AccessDeniedException.class,
                () -> service.create(new HierarchyRequest("A", null, "BUSINESS_UNIT", true)));
        verify(repository, never()).save(any());
    }

    @Test
    void nameAndDeterminatorAreRequiredAndValidated() {
        assertThrows(IllegalArgumentException.class, () -> service.create(new HierarchyRequest(" ", null, "BUSINESS_UNIT", true)));
        assertThrows(IllegalArgumentException.class, () -> service.create(new HierarchyRequest("A", null, null, true)));
        assertThrows(IllegalArgumentException.class, () -> service.create(new HierarchyRequest("A", null, "NOT_A_FIELD", true)));
    }

    @Test
    void duplicateNamesAreRefused() {
        when(repository.existsByNameIgnoreCase("Dup")).thenReturn(true);
        assertThrows(IllegalArgumentException.class, () -> service.create(new HierarchyRequest("Dup", null, "BUSINESS_UNIT", true)));
    }

    @Test
    void theFirstHierarchyBecomesTheDefaultAndTheCreationIsAudited() {
        when(repository.findByDefaultHierarchyTrue()).thenReturn(Optional.empty());
        var created = service.create(new HierarchyRequest("First", "d", "BUSINESS_UNIT", true));
        assertTrue(created.isDefault());
        verify(auditTrailService).logAs(eq(actor), eq("KNOWLEDGE_HIERARCHY"), eq("First"), any(), eq("KNOWLEDGE_HIERARCHY_CREATED"),
                any(), any(), any(), any());
    }

    @Test
    void aLaterHierarchyDoesNotStealTheDefault() {
        KnowledgeCategoryHierarchy old = existing("Old", "DEPARTMENT", true, true);
        when(repository.findByDefaultHierarchyTrue()).thenReturn(Optional.of(old));
        assertFalse(service.create(new HierarchyRequest("New", null, "BUSINESS_UNIT", true)).isDefault());
    }

    @Test
    void levelsCannotRepeatTheDeterminatorAnotherLevelOrAnOrder() {
        KnowledgeCategoryHierarchy h = existing("H", "BUSINESS_UNIT", true, false);
        assertThrows(IllegalArgumentException.class, () -> service.addLevel(h.getId(), new LevelRequest("BUSINESS_UNIT", 10)));
        service.addLevel(h.getId(), new LevelRequest("DEPARTMENT", 10));
        assertThrows(IllegalArgumentException.class, () -> service.addLevel(h.getId(), new LevelRequest("DEPARTMENT", 20)));
        assertThrows(IllegalArgumentException.class, () -> service.addLevel(h.getId(), new LevelRequest("DOCUMENT_TYPE", 10)));
        assertThrows(IllegalArgumentException.class, () -> service.addLevel(h.getId(), new LevelRequest("DOCUMENT_TYPE", 0)));
        assertEquals(1, h.getLevels().size());
    }

    @Test
    void auditRecordsWhatChangedWithOldAndNewValues() {
        KnowledgeCategoryHierarchy h = existing("Old name", "BUSINESS_UNIT", true, false);
        service.update(h.getId(), new HierarchyRequest("New name", "desc", "DEPARTMENT", false));
        verify(auditTrailService).logAs(eq(actor), eq("KNOWLEDGE_HIERARCHY"), eq("New name"), eq(h.getId()),
                eq("KNOWLEDGE_HIERARCHY_UPDATED"), any(), any(), org.mockito.ArgumentMatchers.contains("Name 'Old name' -> 'New name'"),
                org.mockito.ArgumentMatchers.argThat(changes -> changes.size() == 4));
    }

    @Test
    void theDefaultCannotBeDeactivatedOrDeleted() {
        KnowledgeCategoryHierarchy def = existing("Def", "BUSINESS_UNIT", true, true);
        assertThrows(RevisionLifecycleConflictException.class,
                () -> service.update(def.getId(), new HierarchyRequest("Def", null, "BUSINESS_UNIT", false)));
        assertThrows(RevisionLifecycleConflictException.class, () -> service.delete(def.getId()));
        verify(repository, never()).delete(any(KnowledgeCategoryHierarchy.class));
    }

    @Test
    void makingAnotherHierarchyTheDefaultMovesTheFlag() {
        KnowledgeCategoryHierarchy old = existing("Old", "BUSINESS_UNIT", true, true);
        KnowledgeCategoryHierarchy next = existing("Next", "DEPARTMENT", true, false);
        when(repository.findByDefaultHierarchyTrue()).thenReturn(Optional.of(old));
        service.setDefault(next.getId());
        assertFalse(old.isDefaultHierarchy());
        assertTrue(next.isDefaultHierarchy());
    }

    @Test
    void anInactiveHierarchyCannotBecomeTheDefault() {
        KnowledgeCategoryHierarchy off = existing("Off", "DEPARTMENT", false, false);
        assertThrows(RevisionLifecycleConflictException.class, () -> service.setDefault(off.getId()));
    }

    @Test
    void reorderRewritesTheOrderAndRequiresEveryLevelExactlyOnce() {
        KnowledgeCategoryHierarchy h = existing("H", "BUSINESS_UNIT", true, false);
        service.addLevel(h.getId(), new LevelRequest("DEPARTMENT", 10));
        service.addLevel(h.getId(), new LevelRequest("DOCUMENT_TYPE", 20));
        h.getLevels().forEach(l -> ReflectionTestUtils.setField(l, "id", UUID.randomUUID()));
        UUID first = h.getLevels().get(0).getId();
        UUID second = h.getLevels().get(1).getId();

        assertThrows(IllegalArgumentException.class, () -> service.reorderLevels(h.getId(), java.util.List.of(first)));
        assertThrows(IllegalArgumentException.class, () -> service.reorderLevels(h.getId(), java.util.List.of(first, first)));

        var result = service.reorderLevels(h.getId(), java.util.List.of(second, first));
        assertEquals("Document Type", result.levels().get(0).fieldLabel());
        assertEquals(10, result.levels().get(0).displayOrder());
        assertEquals(20, result.levels().get(1).displayOrder());
        verify(auditTrailService).logAs(eq(actor), eq("KNOWLEDGE_HIERARCHY"), eq("H"), any(), eq("KNOWLEDGE_HIERARCHY_LEVELS_REORDERED"),
                any(), any(), any(), any());
    }

    @Test
    void listFiltersByLastUpdatedRangeSearchAndStatusOnTheServer() {
        when(permissionEvaluationService.hasAnyPermission(any(), any(), any())).thenReturn(true);
        KnowledgeCategoryHierarchy a = existing("Alpha", "BUSINESS_UNIT", true, true);
        KnowledgeCategoryHierarchy b = existing("Beta", "DEPARTMENT", false, false);
        when(repository.findAll()).thenReturn(java.util.List.of(a, b));
        assertEquals(1, service.list("alp", null, null, null, 1, 10, "name", "asc").pagination().total());
        assertEquals(1, service.list(null, "INACTIVE", null, null, 1, 10, "name", "asc").pagination().total());
        // both were created "now" (null timestamps count as not matching a range)
        assertEquals(0, service.list(null, null, "01/01/2000", "02/01/2000", 1, 10, "name", "asc").pagination().total());
    }

    @Test
    void savingWithALevelListAppliesRemoveReorderAddAndFieldSwapTogetherAndAuditsIt() {
        KnowledgeCategoryHierarchy h = existing("H", "BUSINESS_UNIT", true, false);
        service.addLevel(h.getId(), new LevelRequest("DEPARTMENT", 10));
        service.addLevel(h.getId(), new LevelRequest("DOCUMENT_TYPE", 20));
        service.addLevel(h.getId(), new LevelRequest("SUB_TYPE", 30));
        h.getLevels().forEach(l -> ReflectionTestUtils.setField(l, "id", UUID.randomUUID()));
        UUID dept = h.getLevels().get(0).getId();
        UUID type = h.getLevels().get(1).getId();

        var request = new HierarchyRequest("H", null, "BUSINESS_UNIT", true, java.util.List.of(
                new com.eqms.dto.knowledge.KnowledgeHierarchyDtos.LevelInput(type, "DOCUMENT_TYPE"),
                new com.eqms.dto.knowledge.KnowledgeHierarchyDtos.LevelInput(null, "LANGUAGE"),
                new com.eqms.dto.knowledge.KnowledgeHierarchyDtos.LevelInput(dept, "DEPARTMENT")));
        var result = service.update(h.getId(), request);

        assertEquals(java.util.List.of("Document Type", "Language", "Department"),
                result.levels().stream().map(l -> l.fieldLabel()).toList());
        assertEquals(java.util.List.of(10, 20, 30), result.levels().stream().map(l -> l.displayOrder()).toList());
        verify(auditTrailService).logAs(eq(actor), eq("KNOWLEDGE_HIERARCHY"), eq("H"), any(), eq("KNOWLEDGE_HIERARCHY_LEVELS_CHANGED"),
                any(), any(), any(), any());
    }

    @Test
    void savingALevelListRejectsDuplicatesTheDeterminatorAndForeignLevels() {
        KnowledgeCategoryHierarchy h = existing("H", "BUSINESS_UNIT", true, false);
        var in = (java.util.function.BiFunction<UUID, String, com.eqms.dto.knowledge.KnowledgeHierarchyDtos.LevelInput>)
                com.eqms.dto.knowledge.KnowledgeHierarchyDtos.LevelInput::new;
        assertThrows(IllegalArgumentException.class, () -> service.update(h.getId(), new HierarchyRequest("H", null, "BUSINESS_UNIT", true,
                java.util.List.of(in.apply(null, "DEPARTMENT"), in.apply(null, "DEPARTMENT")))));
        assertThrows(IllegalArgumentException.class, () -> service.update(h.getId(), new HierarchyRequest("H", null, "BUSINESS_UNIT", true,
                java.util.List.of(in.apply(null, "BUSINESS_UNIT")))));
        assertThrows(IllegalArgumentException.class, () -> service.update(h.getId(), new HierarchyRequest("H", null, "BUSINESS_UNIT", true,
                java.util.List.of(in.apply(UUID.randomUUID(), "DEPARTMENT")))));
    }

    @Test
    void savingTheSameLevelListChangesNothing() {
        KnowledgeCategoryHierarchy h = existing("H", "BUSINESS_UNIT", true, false);
        service.addLevel(h.getId(), new LevelRequest("DEPARTMENT", 10));
        h.getLevels().forEach(l -> ReflectionTestUtils.setField(l, "id", UUID.randomUUID()));
        org.mockito.Mockito.clearInvocations(auditTrailService);
        service.update(h.getId(), new HierarchyRequest("H", null, "BUSINESS_UNIT", true, java.util.List.of(
                new com.eqms.dto.knowledge.KnowledgeHierarchyDtos.LevelInput(h.getLevels().get(0).getId(), "DEPARTMENT"))));
        verify(auditTrailService, never()).logAs(any(), any(), any(), any(), any(), any(), any(), any(), any());
    }
}
