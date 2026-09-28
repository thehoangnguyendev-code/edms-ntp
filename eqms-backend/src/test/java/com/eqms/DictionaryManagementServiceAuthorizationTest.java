package com.eqms;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.dictionary.*;
import com.eqms.entity.UserAccount;
import com.eqms.repository.*;
import com.eqms.service.AuditTrailService;
import com.eqms.service.DictionaryManagementService;
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
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * F-17 — Dictionary master data (Business Unit, Department, Position, Storage Location,
 * Retention Policy) previously had NO permission gate at either the controller or service layer.
 * Business Unit/Department feed {@code ObjectAccessEvaluationService}'s scope matching — so an
 * unauthenticated-permission write here could reshape authorization decisions elsewhere.
 * (Document Type / Sub-Type permission coverage now lives in
 * {@code DocumentTypeAdminServiceAuthorizationTest}, alongside its own service.)
 *
 * Every mutate (create/update/delete, manage-only) and every paginated "admin screen" read
 * ({@code list*Page()}) is gated, verified to run BEFORE any repository access.
 *
 * The unpaginated "give me the full active list" reads ({@code listBusinessUnits()} etc.)
 * are a deliberate exception (2026-08-27 product decision): they back ordinary dropdowns used
 * across unrelated modules (document creation, user creation, controlled copies policy, ...),
 * not the Settings > Dictionaries admin screen, so they carry no permission gate at all —
 * requiring a Settings screen permission just to populate a form dropdown blocked ordinary users
 * (e.g. DCO) from routine actions. Only their {@code *Page()} counterpart is gated.
 */
@ExtendWith(MockitoExtension.class)
class DictionaryManagementServiceAuthorizationTest {

    @Mock private BusinessUnitRepository businessUnitRepository;
    @Mock private DepartmentRepository departmentRepository;
    @Mock private PositionRepository positionRepository;
    @Mock private StorageLocationRepository storageLocationRepository;
    @Mock private RetentionPolicyRepository retentionPolicyRepository;
    @Mock private DocumentRecordRepository documentRecordRepository;
    @Mock private DocumentRevisionRepository documentRevisionRepository;
    @Mock private ControlledCopyExpiryLimitRepository controlledCopyExpiryLimitRepository;
    @Mock private UserLanguageRepository userLanguageRepository;
    @Mock private AuditTrailService auditTrailService;
    @Mock private CurrentUserService currentUserService;
    @Mock private PermissionEvaluationService permissionEvaluationService;

    @InjectMocks
    private DictionaryManagementService service;

    private UserAccount actor;
    @BeforeEach
    void setUp() {
        actor = new UserAccount();
        actor.setId(UUID.randomUUID());
        // lenient: the unpaginated "no permission gate" reads never call requireCurrentUser().
        lenient().when(currentUserService.requireCurrentUser()).thenReturn(actor);
    }

    private void grantView() {
        when(permissionEvaluationService.hasAnyPermission(eq(actor), anyString(), anyString())).thenReturn(true);
    }

    private void denyView() {
        when(permissionEvaluationService.hasAnyPermission(eq(actor), anyString(), anyString())).thenReturn(false);
    }

    private void grantManage() {
        when(permissionEvaluationService.hasPermission(eq(actor), anyString())).thenReturn(true);
    }

    private void denyManage() {
        when(permissionEvaluationService.hasPermission(eq(actor), anyString())).thenReturn(false);
    }

    // ── Unpaginated "dropdown" reads: deliberately NOT gated (see class Javadoc) ───────────────

    @Test
    void listBusinessUnits_hasNoPermissionGate_alwaysAllowed() {
        when(businessUnitRepository.findAllByOrderByNameAsc()).thenReturn(List.of());
        assertDoesNotThrow(() -> service.listBusinessUnits());
        verify(businessUnitRepository).findAllByOrderByNameAsc();
        verifyNoInteractions(permissionEvaluationService);
    }

    @Test
    void listDepartments_hasNoPermissionGate_alwaysAllowed() {
        when(departmentRepository.findAllByOrderByNameAsc()).thenReturn(List.of());
        assertDoesNotThrow(() -> service.listDepartments());
        verify(departmentRepository).findAllByOrderByNameAsc();
        verifyNoInteractions(permissionEvaluationService);
    }

    @Test
    void listPositions_hasNoPermissionGate_alwaysAllowed() {
        when(positionRepository.findAllByOrderByNameAsc()).thenReturn(List.of());
        assertDoesNotThrow(() -> service.listPositions());
        verify(positionRepository).findAllByOrderByNameAsc();
        verifyNoInteractions(permissionEvaluationService);
    }

    // Document Type / Sub-Type lookup tests moved to DocumentTypeAdminServiceAuthorizationTest.

    @Test
    void listStorageLocations_withoutPermission_isDenied() {
        // Was previously ungated (a genuine oversight, unlike listBusinessUnits/listDepartments/
        // listPositions above which are deliberately open lookups) -- now matches its paginated
        // sibling listStorageLocationsPage.
        denyView();
        assertThrows(AccessDeniedException.class, () -> service.listStorageLocations());
        verifyNoInteractions(storageLocationRepository);
    }

    @Test
    void listRetentionPolicies_hasNoPermissionGate_alwaysAllowed() {
        when(retentionPolicyRepository.findAllByOrderByNameAsc()).thenReturn(List.of());
        assertDoesNotThrow(() -> service.listRetentionPolicies());
        verify(retentionPolicyRepository).findAllByOrderByNameAsc();
        verifyNoInteractions(permissionEvaluationService);
    }

    @Test
    void listLanguages_hasNoPermissionGate_alwaysAllowed() {
        when(userLanguageRepository.findAllByActiveTrueOrderBySortOrderAscNameAsc()).thenReturn(List.of());
        assertDoesNotThrow(() -> service.listLanguages());
        verify(userLanguageRepository).findAllByActiveTrueOrderBySortOrderAscNameAsc();
        verifyNoInteractions(permissionEvaluationService);
    }

    // Education lookup-list test moved to EducationManagementServiceAuthorizationTest.

    // ── Paginated "admin screen" reads: gated, and the gate runs before any repo call ──────────

    @Test
    void listBusinessUnits_withViewOnly_isAllowedThroughTheGate() {
        grantView();
        when(businessUnitRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(org.springframework.data.domain.Page.empty());
        assertDoesNotThrow(() -> service.listBusinessUnitsPage(null, null, null, null, 1, 10, "name", "asc"));
        verify(permissionEvaluationService).hasAnyPermission(
                actor, "settings.business_unit.view", "settings.business_unit.manage");
        verify(businessUnitRepository).findAll(any(Specification.class), any(Pageable.class));
    }

    @SuppressWarnings("unchecked")
    @Test
    void listBusinessUnitsPage_withoutPermission_isDenied_pageVariantAlsoGated() {
        denyView();
        assertThrows(AccessDeniedException.class,
                () -> service.listBusinessUnitsPage(null, null, null, null, 1, 10, "name", "asc"));
        verify(businessUnitRepository, never()).findAll(any(Specification.class), any(Pageable.class));
    }

    // ── Mutate methods: denied without manage, for all 7 resources ────────────────────────────

    @Test
    void createBusinessUnit_withoutManage_isDenied() {
        denyManage();
        assertThrows(AccessDeniedException.class, () ->
                service.createBusinessUnit(new BusinessUnitDictionaryRequest("Unit", "UNT", null, true)));
        verifyNoInteractions(businessUnitRepository);
    }

    @Test
    void updateBusinessUnit_withoutManage_isDenied_beforeLookup() {
        denyManage();
        UUID id = UUID.randomUUID();
        assertThrows(AccessDeniedException.class, () ->
                service.updateBusinessUnit(id, new BusinessUnitDictionaryRequest("Unit", "UNT", null, true)));
        verify(businessUnitRepository, never()).findById(any());
    }

    @Test
    void deleteBusinessUnit_withoutManage_isDenied_beforeLookup() {
        denyManage();
        UUID id = UUID.randomUUID();
        assertThrows(AccessDeniedException.class, () -> service.deleteBusinessUnit(id));
        verify(businessUnitRepository, never()).findById(any());
    }

    @Test
    void createDepartment_withoutManage_isDenied_beforeBusinessUnitLookup() {
        denyManage();
        assertThrows(AccessDeniedException.class, () ->
                service.createDepartment(new DepartmentDictionaryRequest("Dept", "DPT", "Unit", null, true, null, null)));
        verifyNoInteractions(businessUnitRepository, departmentRepository);
    }

    @Test
    void updateDepartment_withoutManage_isDenied() {
        denyManage();
        UUID id = UUID.randomUUID();
        assertThrows(AccessDeniedException.class, () ->
                service.updateDepartment(id, new DepartmentDictionaryRequest("Dept", "DPT", "Unit", null, true, null, null)));
        verifyNoInteractions(departmentRepository);
    }

    @Test
    void deleteDepartment_withoutManage_isDenied() {
        denyManage();
        UUID id = UUID.randomUUID();
        assertThrows(AccessDeniedException.class, () -> service.deleteDepartment(id));
        verifyNoInteractions(departmentRepository);
    }

    @Test
    void createPosition_withoutManage_isDenied() {
        denyManage();
        assertThrows(AccessDeniedException.class, () ->
                service.createPosition(new PositionDictionaryRequest("Pos", "Unit", "Dept", null, true)));
        verifyNoInteractions(businessUnitRepository, departmentRepository, positionRepository);
    }

    @Test
    void updatePosition_withoutManage_isDenied() {
        denyManage();
        UUID id = UUID.randomUUID();
        assertThrows(AccessDeniedException.class, () ->
                service.updatePosition(id, new PositionDictionaryRequest("Pos", "Unit", "Dept", null, true)));
        verifyNoInteractions(positionRepository);
    }

    @Test
    void deletePosition_withoutManage_isDenied() {
        denyManage();
        UUID id = UUID.randomUUID();
        assertThrows(AccessDeniedException.class, () -> service.deletePosition(id));
        verifyNoInteractions(positionRepository);
    }

    // Document Type / Sub-Type mutate tests moved to DocumentTypeAdminServiceAuthorizationTest.

    @Test
    void createStorageLocation_withoutManage_isDenied() {
        denyManage();
        assertThrows(AccessDeniedException.class, () ->
                service.createStorageLocation(new StorageLocationDictionaryRequest("Loc", null, true)));
        verifyNoInteractions(storageLocationRepository);
    }

    @Test
    void updateStorageLocation_withoutManage_isDenied() {
        denyManage();
        UUID id = UUID.randomUUID();
        assertThrows(AccessDeniedException.class, () ->
                service.updateStorageLocation(id, new StorageLocationDictionaryRequest("Loc", null, true)));
        verifyNoInteractions(storageLocationRepository);
    }

    @Test
    void deleteStorageLocation_withoutManage_isDenied() {
        denyManage();
        UUID id = UUID.randomUUID();
        assertThrows(AccessDeniedException.class, () -> service.deleteStorageLocation(id));
        verifyNoInteractions(storageLocationRepository);
    }

    @Test
    void createRetentionPolicy_withoutManage_isDenied() {
        denyManage();
        assertThrows(AccessDeniedException.class, () ->
                service.createRetentionPolicy(new RetentionPolicyDictionaryRequest("Policy", null, 30, true)));
        verifyNoInteractions(retentionPolicyRepository);
    }

    @Test
    void updateRetentionPolicy_withoutManage_isDenied() {
        denyManage();
        UUID id = UUID.randomUUID();
        assertThrows(AccessDeniedException.class, () ->
                service.updateRetentionPolicy(id, new RetentionPolicyDictionaryRequest("Policy", null, 30, true)));
        verifyNoInteractions(retentionPolicyRepository);
    }

    @Test
    void deleteRetentionPolicy_withoutManage_isDenied() {
        denyManage();
        UUID id = UUID.randomUUID();
        assertThrows(AccessDeniedException.class, () -> service.deleteRetentionPolicy(id));
        verifyNoInteractions(retentionPolicyRepository);
    }

    // Country tests removed: Application Settings > Countries no longer goes through
    // DictionaryManagementService/countryRepository at all -- it's live-sourced from REST
    // Countries v5 via CountryManagementService/RestCountriesClient (read-only, no manage gate to
    // regression-test here anymore).

    // Education (Degree Levels, Schools) create/update/delete/page tests moved to
    // EducationManagementServiceAuthorizationTest.

    // ── View-only is not enough to mutate ──────────────────────────────────────────────────────

    @Test
    void createBusinessUnit_withViewOnly_isStillDenied() {
        when(permissionEvaluationService.hasPermission(eq(actor), anyString())).thenReturn(false);
        assertThrows(AccessDeniedException.class, () ->
                service.createBusinessUnit(new BusinessUnitDictionaryRequest("Unit", "UNT", null, true)));
    }

    // ── Manage implies allowed through the gate (proceeds to real business logic) ─────────────

    @Test
    void deleteBusinessUnit_withManage_passesGate_thenFailsOnNotFound_notOnAuthorization() {
        grantManage();
        UUID id = UUID.randomUUID();
        when(businessUnitRepository.findById(id)).thenReturn(Optional.empty());

        // EntityNotFoundException (not AccessDeniedException) proves the gate ran and passed,
        // and execution reached the actual lookup.
        assertThrows(jakarta.persistence.EntityNotFoundException.class, () -> service.deleteBusinessUnit(id));
    }
}
