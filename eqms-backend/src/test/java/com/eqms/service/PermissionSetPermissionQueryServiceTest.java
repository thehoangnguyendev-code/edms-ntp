package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.user.PermissionSetPermissionPageResponse;
import com.eqms.entity.Permission;
import com.eqms.entity.PermissionSetItem;
import com.eqms.entity.UserAccount;
import com.eqms.repository.PermissionSetItemRepository;
import com.eqms.repository.PermissionSetRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;

import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class PermissionSetPermissionQueryServiceTest {

    private final UUID setId = UUID.randomUUID();
    private PermissionSetRepository sets;
    private PermissionSetItemRepository items;
    private UserManagementService users;
    private PermissionEvaluationService evaluation;
    private PermissionSetPermissionQueryService service;

    @BeforeEach
    void setUp() {
        sets = mock(PermissionSetRepository.class);
        items = mock(PermissionSetItemRepository.class);
        users = mock(UserManagementService.class);
        evaluation = mock(PermissionEvaluationService.class);
        CurrentUserService current = mock(CurrentUserService.class);
        UserAccount user = mock(UserAccount.class);
        when(current.requireCurrentUser()).thenReturn(user);
        when(evaluation.hasAnyPermission(any(UserAccount.class), anyString(), anyString())).thenReturn(true);
        when(sets.existsById(setId)).thenReturn(true);
        when(users.buildLifecycleUsagesByPermissionCode(any())).thenReturn(Map.of());
        service = new PermissionSetPermissionQueryService(sets, items, users, current, evaluation);
    }

    private PermissionSetItem item(String code, String name, String module, int order) {
        Permission p = mock(Permission.class);
        when(p.getCode()).thenReturn(code);
        when(p.getName()).thenReturn(name);
        when(p.getDescription()).thenReturn("Description of " + name);
        when(p.getModuleKey()).thenReturn(module);
        when(p.getDisplayOrder()).thenReturn(order);
        PermissionSetItem item = mock(PermissionSetItem.class);
        when(item.getPermission()).thenReturn(p);
        return item;
    }

    private void twelveDocumentsAndOneReport() {
        java.util.ArrayList<PermissionSetItem> all = new java.util.ArrayList<>();
        for (int i = 1; i <= 12; i++) all.add(item("documents.thing" + i + ".view", "Thing " + i, "documents", i));
        all.add(item("report.module.view", "View Reports", "report", 1));
        when(items.findAllByPermissionSet_Id(setId)).thenReturn(all);
    }

    @Test
    void pagesTenAtATimeAndKeepsTheTotal() {
        twelveDocumentsAndOneReport();
        PermissionSetPermissionPageResponse first = service.page(setId, 1, 10, null, null);
        PermissionSetPermissionPageResponse second = service.page(setId, 2, 10, null, null);
        assertEquals(10, first.data().size());
        assertEquals(3, second.data().size());
        assertEquals(13, first.pagination().total());
        assertEquals(2, first.pagination().totalPages());
    }

    @Test
    void theModuleFilterNarrowsTheRowsButNotTheFilterList() {
        twelveDocumentsAndOneReport();
        PermissionSetPermissionPageResponse reports = service.page(setId, 1, 10, null, "reports");
        assertEquals(1, reports.data().size());
        assertEquals("report.module.view", reports.data().get(0).code());
        assertEquals(2, reports.modules().size());
    }

    @Test
    void theSearchLooksInNameCodeAndDescriptionAndShrinksTheModulesToWhatItFound() {
        twelveDocumentsAndOneReport();
        PermissionSetPermissionPageResponse found = service.page(setId, 1, 10, "  VIEW REPORTS ", null);
        assertEquals(1, found.data().size());
        assertEquals(1, found.modules().size());
        assertEquals(0, service.page(setId, 1, 10, "no such permission", null).data().size());
    }

    @Test
    void aPersonWithoutThePermissionSetViewPermissionIsRefusedBeforeAnythingIsRead() {
        when(evaluation.hasAnyPermission(any(UserAccount.class), anyString(), anyString())).thenReturn(false);
        assertThrows(AccessDeniedException.class, () -> service.page(setId, 1, 10, null, null));
        verifyNoInteractions(items);
    }

    @Test
    void aSetThatDoesNotExistIsRefused() {
        when(sets.existsById(setId)).thenReturn(false);
        assertThrows(IllegalArgumentException.class, () -> service.page(setId, 1, 10, null, null));
    }

    @Test
    void aHugeLimitIsCapped() {
        twelveDocumentsAndOneReport();
        assertEquals(13, service.page(setId, 1, 100000, null, null).data().size());
        assertEquals(50, service.page(setId, 1, 100000, null, null).pagination().limit());
    }
}
