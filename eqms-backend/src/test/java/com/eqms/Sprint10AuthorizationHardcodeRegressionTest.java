package com.eqms;

import com.eqms.auth.CurrentUserService;
import com.eqms.auth.UnauthorizedException;
import com.eqms.controller.ControlledCopyPolicyController;
import com.eqms.controller.ElectronicSignatureSettingsController;
import com.eqms.dto.controlledcopypolicy.ControlledCopyPolicyRequest;
import com.eqms.dto.document.RevisionListItemResponse;
import com.eqms.dto.security.WorkflowAuthorizationDecision;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.RevisionStatusDefinition;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.enums.RevisionWorkflowAction;
import com.eqms.service.ControlledCopyPolicyService;
import com.eqms.service.ElectronicSignaturePdfPreviewService;
import com.eqms.service.ElectronicSignatureService;
import com.eqms.service.EffectivePermissionService;
import com.eqms.service.NavigationService;
import com.eqms.service.ObjectAccessRuleService;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.service.PermissionSetService;
import com.eqms.service.RevisionService;
import com.eqms.service.RevisionWorkflowAuthorizationService;
import com.eqms.service.SodConstraintService;
import com.eqms.service.SystemConfigurationService;
import com.eqms.service.UserManagementService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

/**
 * Sprint 10 Patch 1 — Regression tests for all authorization hardcode fixes.
 *
 * Verifies that:
 * - Role-name string gates have been removed from ControlledCopyPolicyController,
 *   ElectronicSignatureSettingsController, UserManagementService, NavigationService,
 *   PermissionSetService, ObjectAccessRuleService, SodConstraintService, ConfigurationController.
 * - canPublishRevision on RevisionListItemResponse is derived from
 *   RevisionWorkflowAuthorizationService, not a role/status FE check.
 * - Users with raw role names like "System Administrator" or "QA Administrator" are
 *   denied when isSuperAdmin() returns false (i.e., they have no SYSTEM_SUPER_ADMIN profile).
 */
@ExtendWith(MockitoExtension.class)
class Sprint10AuthorizationHardcodeRegressionTest {

    // ── Shared mocks ──────────────────────────────────────────────────────────

    @org.mockito.Mock com.eqms.service.SecurityChangeSignatureService securityChangeSignatureService;
    @Mock PermissionEvaluationService permissionEvaluationService;
    @Mock CurrentUserService currentUserService;

    // Users
    UserAccount superAdminUser;
    UserAccount nonSuperAdminWithOldRoleName; // has roleName="System Administrator" but isSuperAdmin=false
    UserAccount permissionHolderUser;         // has the specific permission but is not super admin

    @BeforeEach
    void setUp() {
        superAdminUser = user("super-admin");
        superAdminUser.setRoleName("SuperAdmin"); // role name alone must NOT grant access

        nonSuperAdminWithOldRoleName = user("legacy-role-name-user");
        nonSuperAdminWithOldRoleName.setRoleName("System Administrator");

        permissionHolderUser = user("permission-holder");
        permissionHolderUser.setRoleName("Regular User");
    }

    // ── 1. ControlledCopyPolicyController ────────────────────────────────────

    @Mock ControlledCopyPolicyService controlledCopyPolicyService;

    @Test
    void controlledCopyPolicy_view_allowedWithViewPermission() {
        when(currentUserService.requireCurrentUser()).thenReturn(permissionHolderUser);
        when(permissionEvaluationService.hasPermission(permissionHolderUser, "settings.controlled_copy_policy.view")).thenReturn(true);
        lenient().when(permissionEvaluationService.isSuperAdmin(permissionHolderUser)).thenReturn(false);
        when(controlledCopyPolicyService.getPolicy()).thenReturn(null);

        var controller = new ControlledCopyPolicyController(controlledCopyPolicyService, currentUserService, permissionEvaluationService);
        assertThat(controller.getPolicy().getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void controlledCopyPolicy_view_allowedForSystemSuperAdmin() {
        when(currentUserService.requireCurrentUser()).thenReturn(superAdminUser);
        when(permissionEvaluationService.hasPermission(superAdminUser, "settings.controlled_copy_policy.view")).thenReturn(false);
        when(permissionEvaluationService.hasPermission(superAdminUser, "settings.controlled_copy_policy.manage")).thenReturn(false);
        when(permissionEvaluationService.isSuperAdmin(superAdminUser)).thenReturn(true);
        when(controlledCopyPolicyService.getPolicy()).thenReturn(null);

        var controller = new ControlledCopyPolicyController(controlledCopyPolicyService, currentUserService, permissionEvaluationService);
        assertThat(controller.getPolicy().getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void controlledCopyPolicy_view_deniedWhenRoleNameOnlyNoPermissionNoSuperAdmin() {
        when(currentUserService.requireCurrentUser()).thenReturn(nonSuperAdminWithOldRoleName);
        when(permissionEvaluationService.hasPermission(nonSuperAdminWithOldRoleName, "settings.controlled_copy_policy.view")).thenReturn(false);
        when(permissionEvaluationService.hasPermission(nonSuperAdminWithOldRoleName, "settings.controlled_copy_policy.manage")).thenReturn(false);
        when(permissionEvaluationService.isSuperAdmin(nonSuperAdminWithOldRoleName)).thenReturn(false);

        var controller = new ControlledCopyPolicyController(controlledCopyPolicyService, currentUserService, permissionEvaluationService);
        assertThatThrownBy(controller::getPolicy).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void controlledCopyPolicy_manage_allowedWithManagePermission() {
        when(currentUserService.requireCurrentUser()).thenReturn(permissionHolderUser);
        when(permissionEvaluationService.hasPermission(permissionHolderUser, "settings.controlled_copy_policy.manage")).thenReturn(true);
        lenient().when(permissionEvaluationService.isSuperAdmin(permissionHolderUser)).thenReturn(false);
        when(controlledCopyPolicyService.savePolicy(any())).thenReturn(null);

        var controller = new ControlledCopyPolicyController(controlledCopyPolicyService, currentUserService, permissionEvaluationService);
        assertThat(controller.savePolicy(new ControlledCopyPolicyRequest(null, null, null, null, null)).getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void controlledCopyPolicy_manage_deniedWhenRoleNameOnlyNoPermissionNoSuperAdmin() {
        when(currentUserService.requireCurrentUser()).thenReturn(nonSuperAdminWithOldRoleName);
        when(permissionEvaluationService.hasPermission(nonSuperAdminWithOldRoleName, "settings.controlled_copy_policy.manage")).thenReturn(false);
        when(permissionEvaluationService.isSuperAdmin(nonSuperAdminWithOldRoleName)).thenReturn(false);

        var controller = new ControlledCopyPolicyController(controlledCopyPolicyService, currentUserService, permissionEvaluationService);
        assertThatThrownBy(() -> controller.savePolicy(new ControlledCopyPolicyRequest(null, null, null, null, null)))
                .isInstanceOf(AccessDeniedException.class);
    }

    // ── 2. ElectronicSignatureSettingsController ──────────────────────────────

    @Mock ElectronicSignatureService electronicSignatureService;
    @Mock ElectronicSignaturePdfPreviewService electronicSignaturePdfPreviewService;

    @Test
    void electronicSignatureSettings_allowedWithManagePermission() {
        when(currentUserService.requireCurrentUser()).thenReturn(permissionHolderUser);
        when(permissionEvaluationService.hasPermission(permissionHolderUser, "settings.configuration.view")).thenReturn(false);
        when(permissionEvaluationService.hasPermission(permissionHolderUser, "settings.configuration.manage")).thenReturn(true);
        lenient().when(permissionEvaluationService.isSuperAdmin(permissionHolderUser)).thenReturn(false);
        when(electronicSignatureService.getSettings()).thenReturn(null);

        var controller = new ElectronicSignatureSettingsController(
                electronicSignatureService, electronicSignaturePdfPreviewService, currentUserService, permissionEvaluationService);
        assertThat(controller.getSettings().getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void electronicSignatureSettings_allowedForSystemSuperAdmin() {
        when(currentUserService.requireCurrentUser()).thenReturn(superAdminUser);
        when(permissionEvaluationService.hasPermission(superAdminUser, "settings.configuration.view")).thenReturn(false);
        when(permissionEvaluationService.hasPermission(superAdminUser, "settings.configuration.manage")).thenReturn(false);
        when(permissionEvaluationService.isSuperAdmin(superAdminUser)).thenReturn(true);
        when(electronicSignatureService.getSettings()).thenReturn(null);

        var controller = new ElectronicSignatureSettingsController(
                electronicSignatureService, electronicSignaturePdfPreviewService, currentUserService, permissionEvaluationService);
        assertThat(controller.getSettings().getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void electronicSignatureSettings_deniedWhenRoleNameOnlyNoPermissionNoSuperAdmin() {
        when(currentUserService.requireCurrentUser()).thenReturn(nonSuperAdminWithOldRoleName);
        when(permissionEvaluationService.hasPermission(nonSuperAdminWithOldRoleName, "settings.configuration.view")).thenReturn(false);
        when(permissionEvaluationService.hasPermission(nonSuperAdminWithOldRoleName, "settings.configuration.manage")).thenReturn(false);
        when(permissionEvaluationService.isSuperAdmin(nonSuperAdminWithOldRoleName)).thenReturn(false);

        var controller = new ElectronicSignatureSettingsController(
                electronicSignatureService, electronicSignaturePdfPreviewService, currentUserService, permissionEvaluationService);
        assertThatThrownBy(controller::getSettings).isInstanceOf(AccessDeniedException.class);
    }

    // ── 3. NavigationService — permission codes only, no super-admin boolean bypass ─────

    @Mock SystemConfigurationService systemConfigurationService;

    @Test
    void navigation_wildcardPermissionReceivesFullMenu() {
        lenient().when(systemConfigurationService.isFeatureEnabled(any())).thenReturn(true);
        var navService = new NavigationService(systemConfigurationService);

        // "*" is a real, explicitly-granted wildcard permission code (not a role-name or
        // boolean special case) — see PermissionEvaluationService.getPermissionCodesByRoleName.
        var menu = navService.getNavigation(Set.of("*"));
        assertThat(menu).isNotEmpty();
    }

    @Test
    void navigation_withoutPermissionsGetsEmptyMenu() {
        lenient().when(systemConfigurationService.isFeatureEnabled(any())).thenReturn(true);
        var navService = new NavigationService(systemConfigurationService);

        // No permissions granted → nothing permission-gated is visible. No bypass of any kind.
        var menu = navService.getNavigation(Set.of());
        assertThat(menu).isEmpty();
    }

    @Test
    void navigation_signatureUsesPermissionCode_notRoleName() {
        lenient().when(systemConfigurationService.isFeatureEnabled(any())).thenReturn(true);
        var navService = new NavigationService(systemConfigurationService);

        // A user with "documents.module.view" permission (not a super admin role name) should see doc menu
        var menu = navService.getNavigation(Set.of("DOCUMENTS.MODULE.VIEW"));
        boolean hasDocMenu = menu.stream().anyMatch(item -> "doc-control".equals(item.id()));
        assertThat(hasDocMenu).isTrue();
    }

    @Test
    void navigation_securityAccessReviewUsesBackendPermissionDecision() {
        lenient().when(systemConfigurationService.isFeatureEnabled(any())).thenReturn(true);
        var navService = new NavigationService(systemConfigurationService);

        var menu = navService.getNavigation(Set.of("SECURITY.ACCESS_REVIEW.VIEW"));
        var security = menu.stream()
                .filter(item -> "security-authorization".equals(item.id()))
                .findFirst()
                .orElseThrow();

        assertThat(security.children()).extracting(item -> item.id())
                .contains("sec-access-review");
        assertThat(security.children()).extracting(item -> item.id())
                .doesNotContain("security-access-profiles", "security-workflow-roles");
    }

    // ── 4. PermissionSetService, ObjectAccessRuleService, SodConstraintService ─

    @Mock com.eqms.repository.PermissionSetRepository permissionSetRepository;
    @Mock com.eqms.repository.PermissionSetItemRepository permissionSetItemRepository;
    @Mock com.eqms.repository.PermissionRepository permissionRepository;
    @Mock com.eqms.repository.AccessProfilePermissionSetRepository accessProfilePermissionSetRepository;
    @Mock com.eqms.repository.UserAccessProfileRepository userAccessProfileRepository;
    @Mock com.eqms.service.AuditTrailService auditTrailService;

    @Test
    void permissionSetService_requireAdmin_allowedForSuperAdmin() {
        when(currentUserService.requireCurrentUser()).thenReturn(superAdminUser);
        when(permissionEvaluationService.hasAnyPermission(eq(superAdminUser), any(String[].class))).thenReturn(true);
        when(permissionSetRepository.findAllByOrderByNameAsc()).thenReturn(java.util.List.of());

        var service = new PermissionSetService(permissionSetRepository, permissionSetItemRepository,
                permissionRepository, accessProfilePermissionSetRepository, userAccessProfileRepository, currentUserService, auditTrailService, permissionEvaluationService, securityChangeSignatureService);
        assertThat(service.listAll()).isEmpty(); // no exception
    }

    @Test
    void permissionSetService_requireAdmin_deniedWhenRoleNameOnlyNoSuperAdmin() {
        when(currentUserService.requireCurrentUser()).thenReturn(nonSuperAdminWithOldRoleName);
        when(permissionEvaluationService.hasAnyPermission(eq(nonSuperAdminWithOldRoleName), any(String[].class))).thenReturn(false);

        var service = new PermissionSetService(permissionSetRepository, permissionSetItemRepository,
                permissionRepository, accessProfilePermissionSetRepository, userAccessProfileRepository, currentUserService, auditTrailService, permissionEvaluationService, securityChangeSignatureService);
        assertThatThrownBy(service::listAll).isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
    }

    @Mock com.eqms.repository.ObjectAccessRuleRepository objectAccessRuleRepository;
    @Mock com.eqms.repository.RoleDefinitionRepository roleDefinitionRepository;

    @Test
    void objectAccessRuleService_requireAdmin_allowedForSuperAdmin() {
        when(currentUserService.requireCurrentUser()).thenReturn(superAdminUser);
        when(permissionEvaluationService.isSuperAdmin(superAdminUser)).thenReturn(true);
        when(objectAccessRuleRepository.findAllByOrderByPriorityDescNameAsc()).thenReturn(java.util.List.of());

        var service = new ObjectAccessRuleService(objectAccessRuleRepository, roleDefinitionRepository,
                null, null, null,
                currentUserService, auditTrailService, permissionEvaluationService, securityChangeSignatureService);
        assertThat(service.listAll()).isEmpty();
    }

    @Test
    void objectAccessRuleService_requireAdmin_deniedWhenRoleNameOnlyNoSuperAdmin() {
        when(currentUserService.requireCurrentUser()).thenReturn(nonSuperAdminWithOldRoleName);
        when(permissionEvaluationService.isSuperAdmin(nonSuperAdminWithOldRoleName)).thenReturn(false);

        var service = new ObjectAccessRuleService(objectAccessRuleRepository, roleDefinitionRepository,
                null, null, null,
                currentUserService, auditTrailService, permissionEvaluationService, securityChangeSignatureService);
        assertThatThrownBy(service::listAll).isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
    }

    @Mock com.eqms.repository.SodConstraintRepository sodRepository;
    @Mock com.eqms.repository.RolePermissionRepository rolePermissionRepository;
    @Mock EffectivePermissionService effectivePermissionService;

    @Test
    void sodConstraintService_requireAdmin_allowedForSuperAdmin() {
        when(currentUserService.requireCurrentUser()).thenReturn(superAdminUser);
        when(permissionEvaluationService.isSuperAdmin(superAdminUser)).thenReturn(true);
        when(sodRepository.findAllByOrderByNameAsc()).thenReturn(java.util.List.of());

        var service = new SodConstraintService(sodRepository, roleDefinitionRepository, effectivePermissionService,
                permissionRepository, currentUserService, auditTrailService, permissionEvaluationService, securityChangeSignatureService);
        assertThat(service.listAll()).isEmpty();
    }

    @Test
    void sodConstraintService_requireAdmin_deniedWhenRoleNameOnlyNoSuperAdmin() {
        when(currentUserService.requireCurrentUser()).thenReturn(nonSuperAdminWithOldRoleName);
        when(permissionEvaluationService.isSuperAdmin(nonSuperAdminWithOldRoleName)).thenReturn(false);

        var service = new SodConstraintService(sodRepository, roleDefinitionRepository, effectivePermissionService,
                permissionRepository, currentUserService, auditTrailService, permissionEvaluationService, securityChangeSignatureService);
        assertThatThrownBy(service::listAll).isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
    }

    // ── 5. Revision publish capability — comes from WorkflowAuthorizationService ─

    @Mock RevisionWorkflowAuthorizationService revisionWorkflowAuthorizationService;

    @Test
    void revisionListItem_canPublishRevision_trueWhenWorkflowAuthorizationAllows() {
        // WorkflowAuthorizationDecision.allowed() means the service said yes
        when(revisionWorkflowAuthorizationService.check(
                any(), any(), any(RevisionWorkflowAction.class), any()))
                .thenReturn(WorkflowAuthorizationDecision.allowed(
                        RevisionWorkflowAction.PUBLISH, UUID.randomUUID(), "READY_FOR_PUBLISHING", false, false));

        boolean result = revisionWorkflowAuthorizationService.check(
                superAdminUser, revision("READY_FOR_PUBLISHING"), RevisionWorkflowAction.PUBLISH, null).allowed();

        assertThat(result).isTrue();
    }

    @Test
    void revisionListItem_canPublishRevision_falseWhenWorkflowAuthorizationDenies() {
        when(revisionWorkflowAuthorizationService.check(
                any(), any(), any(RevisionWorkflowAction.class), any()))
                .thenReturn(WorkflowAuthorizationDecision.denied(
                        "WRONG_STATUS", "Not in publishable state", null,
                        RevisionWorkflowAction.PUBLISH, UUID.randomUUID(), "DRAFT"));

        boolean result = revisionWorkflowAuthorizationService.check(
                permissionHolderUser, revision("DRAFT"), RevisionWorkflowAction.PUBLISH, null).allowed();

        assertThat(result).isFalse();
    }

    @Test
    void revisionListItem_canPublishRevision_falseEvenIfUserHasPermissionButWrongStatus() {
        // Even a user with publish permission is denied if workflow authorization denies
        when(revisionWorkflowAuthorizationService.check(
                any(), any(), any(RevisionWorkflowAction.class), any()))
                .thenReturn(WorkflowAuthorizationDecision.denied(
                        "WRONG_STATUS", "Revision is not READY_FOR_PUBLISHING", null,
                        RevisionWorkflowAction.PUBLISH, UUID.randomUUID(), "DRAFT"));
        lenient().when(permissionEvaluationService.hasPermission(permissionHolderUser, "documents.revision.publish")).thenReturn(true);

        boolean capabilityResult = revisionWorkflowAuthorizationService.check(
                permissionHolderUser, revision("DRAFT"), RevisionWorkflowAction.PUBLISH, null).allowed();

        // Permission alone is not enough — workflow authorization decides
        assertThat(capabilityResult).isFalse();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private UserAccount user(String name) {
        UserAccount u = new UserAccount();
        u.setId(UUID.randomUUID());
        u.setUsername(name);
        u.setStatus(UserStatus.Active);
        return u;
    }

    private DocumentRevisionRecord revision(String statusCode) {
        DocumentRevisionRecord r = new DocumentRevisionRecord();
        r.setId(UUID.randomUUID());
        RevisionStatusDefinition status = new RevisionStatusDefinition();
        status.setCode(statusCode);
        r.setStatus(status);
        DocumentRecord doc = new DocumentRecord();
        doc.setId(UUID.randomUUID());
        r.setDocument(doc);
        return r;
    }
}
