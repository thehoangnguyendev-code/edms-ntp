package com.eqms;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.dictionary.EducationDegreeLevelDictionaryRequest;
import com.eqms.dto.dictionary.SchoolDictionaryRequest;
import com.eqms.entity.UserAccount;
import com.eqms.repository.EducationDegreeLevelRepository;
import com.eqms.repository.SchoolRepository;
import com.eqms.service.AuditTrailService;
import com.eqms.service.EducationManagementService;
import com.eqms.service.PermissionEvaluationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.AccessDeniedException;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Application Settings > Education (Degree Levels, Schools) permission gating -- moved out of
 * {@code DictionaryManagementServiceAuthorizationTest} together with the underlying service logic
 * (see {@link EducationManagementService}), since Education has its own top-level Settings menu
 * entry and its own permission families ({@code settings.education.degree_level.*} /
 * {@code settings.education.school.*}), not part of Dictionaries.
 *
 * Every mutate (create/update/delete, manage-only) and every paginated "admin screen" read
 * ({@code list*Page()}) is gated, verified to run BEFORE any repository access. The unpaginated
 * "give me the full active list" lookup reads are a deliberate exception (they back ordinary
 * dropdowns used across unrelated modules, not the Settings admin screen), so they carry no
 * permission gate at all.
 */
@ExtendWith(MockitoExtension.class)
class EducationManagementServiceAuthorizationTest {

    @Mock private EducationDegreeLevelRepository educationDegreeLevelRepository;
    @Mock private SchoolRepository schoolRepository;
    @Mock private AuditTrailService auditTrailService;
    @Mock private CurrentUserService currentUserService;
    @Mock private PermissionEvaluationService permissionEvaluationService;

    @InjectMocks
    private EducationManagementService service;

    private UserAccount actor;

    @BeforeEach
    void setUp() {
        actor = new UserAccount();
        actor.setId(UUID.randomUUID());
        // lenient: the unpaginated "no permission gate" lookup reads never call requireCurrentUser().
        lenient().when(currentUserService.requireCurrentUser()).thenReturn(actor);
    }

    private void denyView() {
        when(permissionEvaluationService.hasAnyPermission(eq(actor), anyString(), anyString())).thenReturn(false);
    }

    private void denyManage() {
        when(permissionEvaluationService.hasPermission(eq(actor), anyString())).thenReturn(false);
    }

    @Test
    void educationLookupLists_haveNoDictionaryPermissionGate_andOnlyQueryActiveRows() {
        when(educationDegreeLevelRepository.findAllByActiveTrueOrderByDisplayOrderAscNameAsc()).thenReturn(List.of());
        when(schoolRepository.findAllByActiveTrueOrderByNameAsc()).thenReturn(List.of());

        assertDoesNotThrow(() -> service.listDegreeLevelsForLookup());
        assertDoesNotThrow(() -> service.listSchoolsForLookup());

        verify(educationDegreeLevelRepository).findAllByActiveTrueOrderByDisplayOrderAscNameAsc();
        verify(schoolRepository).findAllByActiveTrueOrderByNameAsc();
        verifyNoInteractions(permissionEvaluationService);
    }

    @Test
    void createDegreeLevel_withoutManage_isDenied() {
        denyManage();
        assertThrows(AccessDeniedException.class, () ->
                service.createDegreeLevel(new EducationDegreeLevelDictionaryRequest("Đại học", 40, true)));
        verifyNoInteractions(educationDegreeLevelRepository);
    }

    @Test
    void updateDegreeLevel_withoutManage_isDenied() {
        denyManage();
        UUID id = UUID.randomUUID();
        assertThrows(AccessDeniedException.class, () ->
                service.updateDegreeLevel(id, new EducationDegreeLevelDictionaryRequest("Đại học", 40, true)));
        verifyNoInteractions(educationDegreeLevelRepository);
    }

    @Test
    void deleteDegreeLevel_withoutManage_isDenied() {
        denyManage();
        UUID id = UUID.randomUUID();
        assertThrows(AccessDeniedException.class, () -> service.deleteDegreeLevel(id));
        verifyNoInteractions(educationDegreeLevelRepository);
    }

    @Test
    void listDegreeLevelsPage_withoutPermission_isDenied() {
        denyView();
        assertThrows(AccessDeniedException.class,
                () -> service.listDegreeLevelsPage(null, null, null, null, 1, 10, "displayOrder", "asc"));
        verify(educationDegreeLevelRepository, never()).findAll(any(Specification.class), any(Pageable.class));
    }

    @Test
    void listDegreeLevels_withoutPermission_isDenied() {
        denyView();
        assertThrows(AccessDeniedException.class, () -> service.listDegreeLevels());
        verifyNoInteractions(educationDegreeLevelRepository);
    }

    private static SchoolDictionaryRequest newSchoolRequest() {
        return new SchoolDictionaryRequest(
                "Đại học Bách khoa Hà Nội", "HUST", "UNIVERSITY", "PUBLIC", true,
                null, null, null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null, null
        );
    }

    @Test
    void createSchool_withoutManage_isDenied() {
        denyManage();
        assertThrows(AccessDeniedException.class, () -> service.createSchool(newSchoolRequest()));
        verifyNoInteractions(schoolRepository);
    }

    @Test
    void updateSchool_withoutManage_isDenied() {
        denyManage();
        UUID id = UUID.randomUUID();
        assertThrows(AccessDeniedException.class, () -> service.updateSchool(id, newSchoolRequest()));
        verifyNoInteractions(schoolRepository);
    }

    @Test
    void deleteSchool_withoutManage_isDenied() {
        denyManage();
        UUID id = UUID.randomUUID();
        assertThrows(AccessDeniedException.class, () -> service.deleteSchool(id));
        verifyNoInteractions(schoolRepository);
    }

    @Test
    void listSchoolsPage_withoutPermission_isDenied() {
        denyView();
        assertThrows(AccessDeniedException.class,
                () -> service.listSchoolsPage(null, null, null, null, null, null, null, null, null, 1, 10, "name", "asc"));
        verify(schoolRepository, never()).findAll(any(Specification.class), any(Pageable.class));
    }

    @Test
    void listSchoolFilterOptions_withoutPermission_isDenied() {
        denyView();
        assertThrows(AccessDeniedException.class, () -> service.listSchoolFilterOptions());
    }

    @Test
    void listSchools_withoutPermission_isDenied() {
        denyView();
        assertThrows(AccessDeniedException.class, () -> service.listSchools());
        verifyNoInteractions(schoolRepository);
    }
}
