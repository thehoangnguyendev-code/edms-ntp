package com.eqms;

import com.eqms.auth.CurrentUserService;
import com.eqms.auth.TokenService;
import com.eqms.dto.user.PermissionCatalogFlatResponse;
import com.eqms.dto.user.PermissionGroupResponse;
import com.eqms.entity.LifecycleStatePolicy;
import com.eqms.entity.Permission;
import com.eqms.entity.WorkflowActionPolicy;
import com.eqms.repository.*;
import com.eqms.service.*;
import com.eqms.service.authorization.AuthorizationEngineService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Covers the "which lifecycle states does this permission apply to" aggregation added to
 * {@link UserManagementService#getPermissionCatalog(String, String, String)} and
 * {@link UserManagementService#getPermissionCatalogPaged}. The join must be a single batched
 * IN(...) query per source table (no N+1) and must gracefully default to an empty list when a
 * permission is not referenced by any policy.
 */
@ExtendWith(MockitoExtension.class)
class UserManagementServicePermissionCatalogLifecycleTest {

    @Mock private UserAccountRepository userRepository;
    @Mock private UserEducationRepository educationRepository;
    @Mock private UserCertificationRepository certificationRepository;
    @Mock private BusinessUnitRepository businessUnitRepository;
    @Mock private DepartmentRepository departmentRepository;
    @Mock private PositionRepository positionRepository;
    @Mock private UserLanguageRepository userLanguageRepository;
    @Mock private RoleDefinitionRepository roleRepository;
    @Mock private PermissionRepository permissionRepository;
    @Mock private PermissionEvaluationService permissionEvaluationService;
    @Mock private DocumentWorkflowSettingRepository documentWorkflowSettingRepository;
    @Mock private AuthSessionRepository sessionRepository;
    @Mock private AuthAuditService auditService;
    @Mock private CurrentUserService currentUserService;
    @Mock private TokenService tokenService;
    @Mock private org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;
    @Mock private AuditTrailService auditTrailService;
    @Mock private SystemConfigurationService systemConfigurationService;
    @Mock private ExternalIdentityProvisioningService externalIdentityProvisioningService;
    @Mock private FileStorageService fileStorageService;
    @Mock private AuthorizationEngineService authorizationEngineService;
    @Mock private NotificationDispatcher notificationDispatcher;
    @Mock private EmailService emailService;
    @Mock private WorkflowActionPolicyRepository workflowActionPolicyRepository;
    @Mock private LifecycleStatePolicyRepository lifecycleStatePolicyRepository;
    @Mock private com.eqms.repository.UserAccessProfileRepository userAccessProfileRepository;
    @Mock private com.eqms.service.SodConstraintService sodConstraintService;

    private UserManagementService service;

    @BeforeEach
    void setUp() {
        service = new UserManagementService(
                userRepository, educationRepository, certificationRepository, businessUnitRepository,
                departmentRepository, positionRepository, userLanguageRepository, roleRepository,
                permissionRepository, permissionEvaluationService,
                documentWorkflowSettingRepository, sessionRepository,
                auditService, currentUserService, tokenService, passwordEncoder, auditTrailService,
                systemConfigurationService, externalIdentityProvisioningService, fileStorageService,
                authorizationEngineService, notificationDispatcher, emailService,
                workflowActionPolicyRepository, lifecycleStatePolicyRepository,
                userAccessProfileRepository, sodConstraintService
        );
    }

    private Permission permission(String code, String module) {
        Permission p = new Permission();
        p.setCode(code);
        p.setName(code);
        p.setCategory("Cat");
        p.setModuleKey(module);
        p.setGroupKey("group");
        p.setDisplayOrder(1);
        p.setRequiresAudit(false);
        return p;
    }

    private WorkflowActionPolicy workflowPolicy(String permissionCode) {
        WorkflowActionPolicy policy = new WorkflowActionPolicy();
        policy.setObjectType("DOCUMENT_REVISION");
        policy.setActionCode("REJECT_REVIEW");
        policy.setFromStatus("PENDING_REVIEW");
        policy.setRequiredPermissionCode(permissionCode);
        policy.setActive(true);
        return policy;
    }

    @Test
    void getPermissionCatalogPaged_populatesLifecycleUsages_forReferencedPermission() {
        Permission referenced = permission("documents.revision.reject_review", "documents");
        when(permissionRepository.findAll()).thenReturn(List.of(referenced));
        when(workflowActionPolicyRepository.findAllByRequiredPermissionCodeInAndActiveTrue(Set.of(referenced.getCode())))
                .thenReturn(List.of(workflowPolicy(referenced.getCode())));
        when(lifecycleStatePolicyRepository.findAllByRequiredPermissionCodeInAndActiveTrue(Set.of(referenced.getCode())))
                .thenReturn(List.of());

        var page = service.getPermissionCatalogPaged(null, null, 1, 10, "code", "asc");

        assertEquals(1, page.data().size());
        PermissionCatalogFlatResponse item = page.data().get(0);
        assertEquals(1, item.lifecycleUsages().size());
        assertEquals("DOCUMENT_REVISION", item.lifecycleUsages().get(0).objectType());
        assertEquals("Revision", item.lifecycleUsages().get(0).objectTypeLabel());
        assertEquals("Pending Review", item.lifecycleUsages().get(0).fromStatusLabel());
        assertEquals("REJECT_REVIEW", item.lifecycleUsages().get(0).action());
        assertEquals("Reject Review", item.lifecycleUsages().get(0).actionLabel());
    }

    @Test
    void getPermissionCatalogPaged_defaultsToEmptyList_whenPermissionUnreferenced() {
        Permission unreferenced = permission("security.users.view", "security");
        when(permissionRepository.findAll()).thenReturn(List.of(unreferenced));
        when(workflowActionPolicyRepository.findAllByRequiredPermissionCodeInAndActiveTrue(any())).thenReturn(List.of());
        when(lifecycleStatePolicyRepository.findAllByRequiredPermissionCodeInAndActiveTrue(any())).thenReturn(List.of());

        var page = service.getPermissionCatalogPaged(null, null, 1, 10, "code", "asc");

        assertEquals(1, page.data().size());
        assertNotNull(page.data().get(0).lifecycleUsages());
        assertTrue(page.data().get(0).lifecycleUsages().isEmpty());
    }

    @Test
    void getPermissionCatalog_groupsIncludeLifecycleUsages_fromBothPolicySources() {
        Permission p = permission("documents.controlled_copy.print", "documents");
        when(permissionRepository.findAll()).thenReturn(List.of(p));
        when(workflowActionPolicyRepository.findAllByRequiredPermissionCodeInAndActiveTrue(Set.of(p.getCode())))
                .thenReturn(List.of());
        LifecycleStatePolicy lcPolicy = new LifecycleStatePolicy();
        lcPolicy.setObjectType("CONTROLLED_COPY");
        lcPolicy.setCapabilityCode("PRINT");
        lcPolicy.setStatusCode("ACTIVE");
        lcPolicy.setRequiredPermissionCode(p.getCode());
        lcPolicy.setActive(true);
        when(lifecycleStatePolicyRepository.findAllByRequiredPermissionCodeInAndActiveTrue(Set.of(p.getCode())))
                .thenReturn(List.of(lcPolicy));

        List<PermissionGroupResponse> groups = service.getPermissionCatalog(null, null, null);

        assertEquals(1, groups.size());
        var item = groups.get(0).permissions().get(0);
        assertEquals(1, item.lifecycleUsages().size());
        assertEquals("CONTROLLED_COPY", item.lifecycleUsages().get(0).objectType());
        assertEquals("Controlled Copy", item.lifecycleUsages().get(0).objectTypeLabel());
        assertEquals("PRINT", item.lifecycleUsages().get(0).action());
        assertEquals("Print", item.lifecycleUsages().get(0).actionLabel());
        assertEquals("Active", item.lifecycleUsages().get(0).fromStatusLabel());
    }

    @Test
    void buildLifecycleUsages_callsRepositoriesExactlyOnce_regardlessOfPermissionCount() {
        Permission a = permission("a.code", "mod");
        Permission b = permission("b.code", "mod");
        when(permissionRepository.findAll()).thenReturn(List.of(a, b));
        when(workflowActionPolicyRepository.findAllByRequiredPermissionCodeInAndActiveTrue(any())).thenReturn(List.of());
        when(lifecycleStatePolicyRepository.findAllByRequiredPermissionCodeInAndActiveTrue(any())).thenReturn(List.of());

        service.getPermissionCatalogPaged(null, null, 1, 10, "code", "asc");

        org.mockito.Mockito.verify(workflowActionPolicyRepository, org.mockito.Mockito.times(1))
                .findAllByRequiredPermissionCodeInAndActiveTrue(any());
        org.mockito.Mockito.verify(lifecycleStatePolicyRepository, org.mockito.Mockito.times(1))
                .findAllByRequiredPermissionCodeInAndActiveTrue(any());
    }

    /**
     * Regression for a real production data artifact: documents.document.cancel has both a
     * workflow_action_policies row (objectType=DOCUMENT, pre-cutover leftover, never read at
     * runtime -- see DocumentResourceAdapter, which only wires LifecycleStatePolicyRepository) and
     * a lifecycle_state_policies row (the one actually enforced). Surfacing the orphaned
     * workflow_action_policies row made the Admin-facing hint look like a duplicate/redundant
     * policy. Only the real, enforced entry must appear.
     */
    @Test
    void getPermissionCatalog_excludesOrphanedDocumentWorkflowActionPolicy() {
        Permission p = permission("documents.document.cancel", "documents");
        when(permissionRepository.findAll()).thenReturn(List.of(p));

        WorkflowActionPolicy orphaned = new WorkflowActionPolicy();
        orphaned.setObjectType("DOCUMENT");
        orphaned.setActionCode("CANCEL");
        orphaned.setFromStatus("DRAFT");
        orphaned.setRequiredPermissionCode(p.getCode());
        orphaned.setActive(true);
        when(workflowActionPolicyRepository.findAllByRequiredPermissionCodeInAndActiveTrue(Set.of(p.getCode())))
                .thenReturn(List.of(orphaned));

        LifecycleStatePolicy real = new LifecycleStatePolicy();
        real.setObjectType("DOCUMENT");
        real.setCapabilityCode("CANCEL");
        real.setStatusCode("DRAFT");
        real.setRequiredPermissionCode(p.getCode());
        real.setActive(true);
        when(lifecycleStatePolicyRepository.findAllByRequiredPermissionCodeInAndActiveTrue(Set.of(p.getCode())))
                .thenReturn(List.of(real));

        List<PermissionGroupResponse> groups = service.getPermissionCatalog(null, null, null);

        var item = groups.get(0).permissions().get(0);
        assertEquals(1, item.lifecycleUsages().size(), "orphaned workflow_action_policies row for objectType=DOCUMENT must not be surfaced");
    }
}
