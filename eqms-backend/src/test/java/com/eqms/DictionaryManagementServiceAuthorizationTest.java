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
 * F-17 — Dictionary master data (Business Unit, Department, Position, Document Type,
 * Document Sub-Type, Storage Location, Retention Policy) previously had NO permission gate
 * at either the controller or service layer. Document Type is the key
 * {@code workflow_action_policies.document_type_id} is keyed on, and Business Unit/Department
 * feed {@code ObjectAccessEvaluationService}'s scope matching — so an unauthenticated-permission
 * write here could reshape authorization decisions elsewhere.
 *
 * Verifies the gate runs BEFORE any repository access (not just before the response is built),
 * for every read (view-or-manage) and every mutate (manage-only) method across all 7 resources.
 */
@ExtendWith(MockitoExtension.class)
class DictionaryManagementServiceAuthorizationTest {

    @Mock private BusinessUnitRepository businessUnitRepository;
    @Mock private DepartmentRepository departmentRepository;
    @Mock private PositionRepository positionRepository;
    @Mock private DocumentTypeRepository documentTypeRepository;
    @Mock private DocumentSubTypeRepository documentSubTypeRepository;
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
    private static final String VIEW = "settings.dictionary.view";
    private static final String MANAGE = "settings.dictionary.manage";

    @BeforeEach
    void setUp() {
        actor = new UserAccount();
        actor.setId(UUID.randomUUID());
        when(currentUserService.requireCurrentUser()).thenReturn(actor);
    }

    private void grantView() {
        when(permissionEvaluationService.hasAnyPermission(actor, VIEW, MANAGE)).thenReturn(true);
    }

    private void denyView() {
        when(permissionEvaluationService.hasAnyPermission(actor, VIEW, MANAGE)).thenReturn(false);
    }

    private void grantManage() {
        when(permissionEvaluationService.hasPermission(actor, MANAGE)).thenReturn(true);
    }

    private void denyManage() {
        when(permissionEvaluationService.hasPermission(actor, MANAGE)).thenReturn(false);
    }

    // ── Read methods: denied without view/manage, and the gate runs before any repo call ──────

    @Test
    void listBusinessUnits_withoutPermission_isDenied_andRepositoryNeverTouched() {
        denyView();
        assertThrows(AccessDeniedException.class, () -> service.listBusinessUnits());
        verifyNoInteractions(businessUnitRepository);
    }

    @Test
    void listDepartments_withoutPermission_isDenied() {
        denyView();
        assertThrows(AccessDeniedException.class, () -> service.listDepartments());
        verifyNoInteractions(departmentRepository);
    }

    @Test
    void listPositions_withoutPermission_isDenied() {
        denyView();
        assertThrows(AccessDeniedException.class, () -> service.listPositions());
        verifyNoInteractions(positionRepository);
    }

    @Test
    void listDocumentTypes_withoutPermission_isDenied() {
        denyView();
        assertThrows(AccessDeniedException.class, () -> service.listDocumentTypes());
        verifyNoInteractions(documentTypeRepository);
    }

    @Test
    void listDocumentSubTypes_withoutPermission_isDenied() {
        denyView();
        assertThrows(AccessDeniedException.class, () -> service.listDocumentSubTypes());
        verifyNoInteractions(documentSubTypeRepository);
    }

    @Test
    void listStorageLocations_withoutPermission_isDenied() {
        denyView();
        assertThrows(AccessDeniedException.class, () -> service.listStorageLocations());
        verifyNoInteractions(storageLocationRepository);
    }

    @Test
    void listRetentionPolicies_withoutPermission_isDenied() {
        denyView();
        assertThrows(AccessDeniedException.class, () -> service.listRetentionPolicies());
        verifyNoInteractions(retentionPolicyRepository);
    }

    @Test
    void listLanguages_withoutPermission_isDenied() {
        denyView();
        assertThrows(AccessDeniedException.class, () -> service.listLanguages());
        verifyNoInteractions(userLanguageRepository);
    }

    @Test
    void listBusinessUnits_withViewOnly_isAllowedThroughTheGate() {
        grantView();
        when(businessUnitRepository.findAllByOrderByNameAsc()).thenReturn(List.of());
        assertDoesNotThrow(() -> service.listBusinessUnits());
        verify(businessUnitRepository).findAllByOrderByNameAsc();
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
                service.createDepartment(new DepartmentDictionaryRequest("Dept", "DPT", "Unit", null, true)));
        verifyNoInteractions(businessUnitRepository, departmentRepository);
    }

    @Test
    void updateDepartment_withoutManage_isDenied() {
        denyManage();
        UUID id = UUID.randomUUID();
        assertThrows(AccessDeniedException.class, () ->
                service.updateDepartment(id, new DepartmentDictionaryRequest("Dept", "DPT", "Unit", null, true)));
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
                service.createPosition(new PositionDictionaryRequest("Pos", "POS", "Unit", "Dept", null, true)));
        verifyNoInteractions(businessUnitRepository, departmentRepository, positionRepository);
    }

    @Test
    void updatePosition_withoutManage_isDenied() {
        denyManage();
        UUID id = UUID.randomUUID();
        assertThrows(AccessDeniedException.class, () ->
                service.updatePosition(id, new PositionDictionaryRequest("Pos", "POS", "Unit", "Dept", null, true)));
        verifyNoInteractions(positionRepository);
    }

    @Test
    void deletePosition_withoutManage_isDenied() {
        denyManage();
        UUID id = UUID.randomUUID();
        assertThrows(AccessDeniedException.class, () -> service.deletePosition(id));
        verifyNoInteractions(positionRepository);
    }

    @Test
    void createDocumentType_withoutManage_isDenied() {
        denyManage();
        assertThrows(AccessDeniedException.class, () ->
                service.createDocumentType(new DocumentTypeDictionaryRequest("SOP", "SOP", 0, null, true)));
        verifyNoInteractions(documentTypeRepository);
    }

    @Test
    void updateDocumentType_withoutManage_isDenied() {
        denyManage();
        UUID id = UUID.randomUUID();
        assertThrows(AccessDeniedException.class, () ->
                service.updateDocumentType(id, new DocumentTypeDictionaryRequest("SOP", "SOP", 0, null, true)));
        verifyNoInteractions(documentTypeRepository);
    }

    @Test
    void deleteDocumentType_withoutManage_isDenied() {
        denyManage();
        UUID id = UUID.randomUUID();
        assertThrows(AccessDeniedException.class, () -> service.deleteDocumentType(id));
        verifyNoInteractions(documentTypeRepository);
    }

    @Test
    void createDocumentSubType_withoutManage_isDenied() {
        denyManage();
        assertThrows(AccessDeniedException.class, () ->
                service.createDocumentSubType(new DocumentSubTypeDictionaryRequest("Sub", UUID.randomUUID().toString(), null, true)));
        verifyNoInteractions(documentTypeRepository, documentSubTypeRepository);
    }

    @Test
    void updateDocumentSubType_withoutManage_isDenied() {
        denyManage();
        UUID id = UUID.randomUUID();
        assertThrows(AccessDeniedException.class, () ->
                service.updateDocumentSubType(id, new DocumentSubTypeDictionaryRequest("Sub", UUID.randomUUID().toString(), null, true)));
        verifyNoInteractions(documentSubTypeRepository);
    }

    @Test
    void deleteDocumentSubType_withoutManage_isDenied() {
        denyManage();
        UUID id = UUID.randomUUID();
        assertThrows(AccessDeniedException.class, () -> service.deleteDocumentSubType(id));
        verifyNoInteractions(documentSubTypeRepository);
    }

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

    // ── View-only is not enough to mutate ──────────────────────────────────────────────────────

    @Test
    void createBusinessUnit_withViewOnly_isStillDenied() {
        when(permissionEvaluationService.hasPermission(actor, MANAGE)).thenReturn(false);
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
