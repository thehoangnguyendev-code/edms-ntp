package com.eqms;

import com.eqms.auth.CurrentUserService;
import com.eqms.entity.AccessProfilePermissionSet;
import com.eqms.entity.Permission;
import com.eqms.entity.PermissionSet;
import com.eqms.entity.PermissionSetItem;
import com.eqms.entity.RoleDefinition;
import com.eqms.entity.UserAccount;
import com.eqms.repository.AccessProfilePermissionSetRepository;
import com.eqms.repository.AccessProfileWorkflowRoleRepository;
import com.eqms.repository.PermissionSetItemRepository;
import com.eqms.repository.PermissionSetRepository;
import com.eqms.repository.RoleDefinitionRepository;
import com.eqms.repository.SodConstraintRepository;
import com.eqms.repository.UserAccessProfileRepository;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.AccessProfileService;
import com.eqms.service.AuditTrailService;
import com.eqms.service.EffectivePermissionService;
import com.eqms.service.PermissionEvaluationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AccessProfileServiceSecurityTest {

    @Mock RoleDefinitionRepository roleRepo;
    @Mock PermissionSetRepository permSetRepo;
    @Mock PermissionSetItemRepository permissionSetItemRepo;
    @Mock AccessProfilePermissionSetRepository appSetRepo;
    @Mock AccessProfileWorkflowRoleRepository appWfRepo;
    @Mock UserAccessProfileRepository uapRepo;
    @Mock UserAccountRepository userRepo;
    @Mock CurrentUserService currentUserService;
    @Mock PermissionEvaluationService permissionEvaluationService;
    @Mock AuditTrailService auditTrailService;
    @Mock com.eqms.service.SecurityChangeSignatureService securityChangeSignatureService;
    @Mock com.eqms.service.EffectivePermissionService effectivePermissionService;
    @Mock SodConstraintRepository sodConstraintRepo;
    @Mock com.eqms.service.PermissionSetService permissionSetService;

    private AccessProfileService service;
    private UserAccount actor;

    @BeforeEach
    void setUp() {
        service = new AccessProfileService(
                roleRepo,
                permSetRepo,
                permissionSetItemRepo,
                appSetRepo,
                appWfRepo,
                uapRepo,
                userRepo,
                currentUserService,
                permissionEvaluationService,
                auditTrailService,
                securityChangeSignatureService,
                effectivePermissionService,
                sodConstraintRepo,
                permissionSetService);

        actor = user("qa-admin");
    }

    @Test
    void addPermissionSet_deniedForSystemSuperAdminProfile_doesNotMutate() {
        UUID profileId = UUID.randomUUID();
        UUID setId = UUID.randomUUID();
        RoleDefinition profile = accessProfile(profileId, EffectivePermissionService.SYSTEM_SUPER_ADMIN_CODE);

        allowAssign();
        when(roleRepo.findById(profileId)).thenReturn(Optional.of(profile));
        when(permSetRepo.findById(setId)).thenReturn(Optional.of(permissionSet(setId, "Critical Admin Set")));

        assertThatThrownBy(() -> service.addPermissionSet(profileId, setId, null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("system super admin profile");

        verify(appSetRepo, never()).save(any());
        verify(auditTrailService, never()).logAs(any(), any(), any(), any(), any(), any(), any(), any());
        verify(permissionEvaluationService, never()).clearCache();
    }

    @Test
    void setPermissionSets_deniedWhenActorAddsCriticalSetToOwnProfile_doesNotMutate() {
        UUID profileId = UUID.randomUUID();
        UUID criticalSetId = UUID.randomUUID();
        RoleDefinition profile = accessProfile(profileId, "QA_ADMIN");

        allowAssign();
        when(roleRepo.findById(profileId)).thenReturn(Optional.of(profile));
        when(appSetRepo.findByAccessProfileId(profileId)).thenReturn(List.of());
        when(uapRepo.existsByUserIdAndAccessProfileId(actor.getId(), profileId)).thenReturn(true);
        when(permissionSetItemRepo.findAllByPermissionSet_Id(criticalSetId))
                .thenReturn(List.of(permissionSetItem(criticalPermission("security.access_profiles.update"))));

        assertThatThrownBy(() -> service.setPermissionSets(profileId, List.of(criticalSetId), null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("critical permissions");

        verify(appSetRepo, never()).deleteByAccessProfileId(profileId);
        verify(appSetRepo, never()).save(any());
        verify(auditTrailService, never()).logAs(any(), any(), any(), any(), any(), any(), any(), any(), any());
        verify(permissionEvaluationService, never()).clearCache();
    }

    @Test
    void addPermissionSet_deniedWhenActorAddsCriticalSetToOwnProfile_doesNotMutate() {
        UUID profileId = UUID.randomUUID();
        UUID criticalSetId = UUID.randomUUID();
        RoleDefinition profile = accessProfile(profileId, "QA_ADMIN");

        allowAssign();
        when(roleRepo.findById(profileId)).thenReturn(Optional.of(profile));
        when(permSetRepo.findById(criticalSetId)).thenReturn(Optional.of(permissionSet(criticalSetId, "Security Admin")));
        when(uapRepo.existsByUserIdAndAccessProfileId(actor.getId(), profileId)).thenReturn(true);
        when(permissionSetItemRepo.findAllByPermissionSet_Id(criticalSetId))
                .thenReturn(List.of(permissionSetItem(criticalPermission("security.permission_sets.manage"))));

        assertThatThrownBy(() -> service.addPermissionSet(profileId, criticalSetId, null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("critical permissions");

        verify(appSetRepo, never()).save(any());
        verify(auditTrailService, never()).logAs(any(), any(), any(), any(), any(), any(), any(), any(), any());
        verify(permissionEvaluationService, never()).clearCache();
    }

    @Test
    void assignUser_deniedWhenActorAssignsSelfToProfileContainingCriticalSet_doesNotMutate() {
        UUID profileId = UUID.randomUUID();
        UUID criticalSetId = UUID.randomUUID();
        RoleDefinition profile = accessProfile(profileId, "QA_ADMIN");
        UserAccount target = actor;

        allowAssign();
        when(roleRepo.findById(profileId)).thenReturn(Optional.of(profile));
        when(userRepo.findById(actor.getId())).thenReturn(Optional.of(target));
        when(appSetRepo.findByAccessProfileId(profileId)).thenReturn(List.of(accessProfilePermissionSet(profileId, criticalSetId)));
        when(permissionSetItemRepo.findAllByPermissionSet_Id(criticalSetId))
                .thenReturn(List.of(permissionSetItem(criticalPermission("settings.configuration.manage"))));

        assertThatThrownBy(() -> service.assignUser(profileId, actor.getId(), null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("critical permissions");

        verify(uapRepo, never()).save(any());
        verify(auditTrailService, never()).logAs(any(), any(), any(), any(), any(), any(), any(), any(), any());
        verify(permissionEvaluationService, never()).clearCache();
    }

    @Test
    void assignUser_deniedWhenResultingPermissionsViolateBlockingSodConstraint_doesNotMutate() {
        UUID profileId = UUID.randomUUID();
        UUID setId = UUID.randomUUID();
        RoleDefinition profile = accessProfile(profileId, "QA_REVIEWER");
        UserAccount target = user("target-user");

        allowAssign();
        when(roleRepo.findById(profileId)).thenReturn(Optional.of(profile));
        when(userRepo.findById(target.getId())).thenReturn(Optional.of(target));
        when(uapRepo.existsByUserIdAndAccessProfileId(target.getId(), profileId)).thenReturn(false);
        when(appSetRepo.findByAccessProfileId(profileId)).thenReturn(List.of(accessProfilePermissionSet(profileId, setId)));
        when(permissionSetItemRepo.findAllByPermissionSet_Id(setId)).thenReturn(List.of(
                permissionSetItem(plainPermission("documents.revision.submit_review")),
                permissionSetItem(plainPermission("documents.revision.approve"))));
        when(effectivePermissionService.getEffectivePermissionCodes(target)).thenReturn(java.util.Set.of());

        com.eqms.entity.SodConstraint constraint = new com.eqms.entity.SodConstraint();
        constraint.setName("Submitter cannot also Approve");
        constraint.setPermissionCodeA("documents.revision.submit_review");
        constraint.setPermissionCodeB("documents.revision.approve");
        constraint.setSeverity("BLOCK");
        when(sodConstraintRepo.findActiveConstraintsInvolvingAny(any())).thenReturn(List.of(constraint));

        assertThatThrownBy(() -> service.assignUser(profileId, target.getId(), null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Segregation of Duties");

        verify(uapRepo, never()).save(any());
        verify(auditTrailService, never()).logAs(any(), any(), any(), any(), any(), any(), any(), any(), any());
        verify(permissionEvaluationService, never()).clearCache();
    }

    @Test
    void createProfileFull_createsManagedSetAndAssignsUser_recordsSignatureOnce() {
        UserAccount target = user("new-role-user");
        RoleDefinition savedRole = accessProfile(UUID.randomUUID(), "QC_SUPERVISOR");
        savedRole.setName("QC Supervisor");
        PermissionSet managed = permissionSet(UUID.randomUUID(), "QC Supervisor Permissions");

        allowManageAndAssign();
        when(roleRepo.findByNameIgnoreCase("QC Supervisor")).thenReturn(Optional.empty());
        when(roleRepo.findByCodeIgnoreCase("QC_SUPERVISOR")).thenReturn(Optional.empty());
        when(roleRepo.save(any(RoleDefinition.class))).thenReturn(savedRole);
        when(permissionSetService.createManagedSet(eq("QC Supervisor Permissions"), eq("ROLE_QC_SUPERVISOR"), any(), eq(actor)))
                .thenReturn(managed);
        when(userRepo.findById(target.getId())).thenReturn(Optional.of(target));
        when(effectivePermissionService.getEffectivePermissionCodes(target)).thenReturn(java.util.Set.of());
        // With no granted codes the SoD gate short-circuits before querying constraints.
        org.mockito.Mockito.lenient().when(sodConstraintRepo.findActiveConstraintsInvolvingAny(any())).thenReturn(List.of());
        // toDetailResponse reload path (lenient — exact reload calls vary)
        org.mockito.Mockito.lenient().when(appSetRepo.findByAccessProfileId(savedRole.getId())).thenReturn(List.of());
        org.mockito.Mockito.lenient().when(appWfRepo.findByAccessProfileId(savedRole.getId())).thenReturn(List.of());

        service.createProfileFull(new com.eqms.dto.settings.AccessProfileFullRequest(
                "QC Supervisor", "desc", true, null, null,
                List.of("documents.document.view"), List.of(), List.of("DOCUMENT_REVIEWER"),
                List.of(target.getId()), "token", "reason"));

        verify(permissionSetService).createManagedSet(eq("QC Supervisor Permissions"), eq("ROLE_QC_SUPERVISOR"), any(), eq(actor));
        verify(uapRepo).save(any());
        verify(securityChangeSignatureService, org.mockito.Mockito.times(1))
                .record(any(), any(), any(), any(), any(), any(), any(), any(), any());
        verify(permissionEvaluationService).clearCache();
    }

    @Test
    void createProfileFull_sodBlockOnInitialUser_abortsWholeOperation() {
        UserAccount target = user("conflicted-user");
        RoleDefinition savedRole = accessProfile(UUID.randomUUID(), "QC_SUPERVISOR");
        savedRole.setName("QC Supervisor");
        PermissionSet managed = permissionSet(UUID.randomUUID(), "QC Supervisor Permissions");

        allowManageAndAssign();
        when(roleRepo.findByNameIgnoreCase("QC Supervisor")).thenReturn(Optional.empty());
        when(roleRepo.findByCodeIgnoreCase("QC_SUPERVISOR")).thenReturn(Optional.empty());
        when(roleRepo.save(any(RoleDefinition.class))).thenReturn(savedRole);
        when(permissionSetService.createManagedSet(any(), any(), any(), any())).thenReturn(managed);
        when(userRepo.findById(target.getId())).thenReturn(Optional.of(target));
        when(effectivePermissionService.getEffectivePermissionCodes(target))
                .thenReturn(java.util.Set.of("documents.revision.approve"));
        // the profile's managed set grants submit_review → BLOCK pair with approve
        when(appSetRepo.findByAccessProfileId(savedRole.getId()))
                .thenReturn(List.of(accessProfilePermissionSet(savedRole.getId(), managed.getId())));
        when(permissionSetItemRepo.findAllByPermissionSet_Id(managed.getId()))
                .thenReturn(List.of(permissionSetItem(plainPermission("documents.revision.submit_review"))));
        com.eqms.entity.SodConstraint constraint = new com.eqms.entity.SodConstraint();
        constraint.setName("Submitter cannot also Approve");
        constraint.setPermissionCodeA("documents.revision.submit_review");
        constraint.setPermissionCodeB("documents.revision.approve");
        constraint.setSeverity("BLOCK");
        when(sodConstraintRepo.findActiveConstraintsInvolvingAny(any())).thenReturn(List.of(constraint));

        assertThatThrownBy(() -> service.createProfileFull(new com.eqms.dto.settings.AccessProfileFullRequest(
                "QC Supervisor", "desc", true, null, null,
                List.of("documents.revision.submit_review"), List.of(), List.of(),
                List.of(target.getId()), "token", "reason")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Segregation of Duties");

        // Signature is never recorded — the surrounding transaction rolls everything back.
        verify(uapRepo, never()).save(any());
        verify(securityChangeSignatureService, never())
                .record(any(), any(), any(), any(), any(), any(), any(), any(), any());
        verify(permissionEvaluationService, never()).clearCache();
    }

    @Test
    void updateProfileConfiguration_staleUpdatedAt_returns409AndChangesNothing() {
        UUID profileId = UUID.randomUUID();
        RoleDefinition profile = accessProfile(profileId, "QC_SUPERVISOR");
        profile.setUpdatedAt(java.time.Instant.parse("2026-07-16T10:00:00Z"));

        allowAssign();
        when(roleRepo.findByIdForUpdate(profileId)).thenReturn(Optional.of(profile));

        assertThatThrownBy(() -> service.updateProfileConfiguration(profileId,
                new com.eqms.dto.settings.AccessProfileConfigurationRequest(
                        java.time.Instant.parse("2026-07-16T09:00:00Z"), // loaded before another admin saved
                        null, List.of("documents.document.view"), null, null, null,
                        "token", "reason")))
                .isInstanceOf(org.springframework.web.server.ResponseStatusException.class)
                .hasMessageContaining("modified by another administrator");

        verify(roleRepo, never()).save(any());
        verify(uapRepo, never()).save(any());
        verify(securityChangeSignatureService, never())
                .record(any(), any(), any(), any(), any(), any(), any(), any(), any());
        verify(permissionEvaluationService, never()).clearCache();
    }

    @Test
    void updateProfileConfiguration_multiSectionChange_recordsSignatureOnce() {
        UUID profileId = UUID.randomUUID();
        RoleDefinition profile = accessProfile(profileId, "QC_SUPERVISOR");
        profile.setName("QC Supervisor");
        profile.setUpdatedAt(java.time.Instant.parse("2026-07-16T10:00:00Z"));
        PermissionSet managed = permissionSet(UUID.randomUUID(), "QC Supervisor Permissions");
        UserAccount target = user("new-holder");

        allowAssign();
        when(roleRepo.findByIdForUpdate(profileId)).thenReturn(Optional.of(profile));
        when(roleRepo.findById(profileId)).thenReturn(Optional.of(profile));
        when(roleRepo.save(profile)).thenReturn(profile);
        when(permSetRepo.findByCode("ROLE_QC_SUPERVISOR")).thenReturn(Optional.empty());
        when(permissionSetService.createManagedSet(eq("QC Supervisor Permissions"), eq("ROLE_QC_SUPERVISOR"), any(), eq(actor)))
                .thenReturn(managed);
        when(appWfRepo.findByAccessProfileId(profileId)).thenReturn(List.of());
        when(uapRepo.findByAccessProfileId(profileId)).thenReturn(List.of());
        when(userRepo.findById(target.getId())).thenReturn(Optional.of(target));
        when(effectivePermissionService.getEffectivePermissionCodes(target)).thenReturn(java.util.Set.of());
        org.mockito.Mockito.lenient().when(sodConstraintRepo.findActiveConstraintsInvolvingAny(any())).thenReturn(List.of());
        org.mockito.Mockito.lenient().when(appSetRepo.findByAccessProfileId(profileId)).thenReturn(List.of());
        org.mockito.Mockito.lenient().when(permissionSetItemRepo.findAllByPermissionSet_Id(managed.getId())).thenReturn(List.of());

        service.updateProfileConfiguration(profileId,
                new com.eqms.dto.settings.AccessProfileConfigurationRequest(
                        java.time.Instant.parse("2026-07-16T10:00:00Z"), // matches — no conflict
                        null,
                        List.of("documents.document.view"),
                        null,
                        List.of("DOCUMENT_REVIEWER"),
                        List.of(target.getId()),
                        "token", "reason"));

        verify(appWfRepo).save(any());
        verify(uapRepo).save(any());
        verify(roleRepo).save(profile);
        verify(securityChangeSignatureService, org.mockito.Mockito.times(1))
                .record(any(), any(), any(), any(), any(), any(), any(), any(), any());
        verify(permissionEvaluationService).clearCache();
    }

    private void allowManage() {
        when(currentUserService.requireCurrentUser()).thenReturn(actor);
        when(permissionEvaluationService.hasPermission(actor, "security.access_profiles.update")).thenReturn(true);
    }

    private void allowManageAndAssign() {
        allowManage();
        when(permissionEvaluationService.hasPermission(actor, "security.access_profiles.assign")).thenReturn(true);
    }

    @Test
    void assignUser_updatePermissionAlone_isDenied() {
        UUID profileId = UUID.randomUUID();
        UUID targetUserId = UUID.randomUUID();

        when(currentUserService.requireCurrentUser()).thenReturn(actor);
        org.mockito.Mockito.lenient()
                .when(permissionEvaluationService.hasPermission(actor, "security.access_profiles.update"))
                .thenReturn(true);
        when(permissionEvaluationService.hasPermission(actor, "security.access_profiles.assign"))
                .thenReturn(false);

        assertThatThrownBy(() -> service.assignUser(profileId, targetUserId, null))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class)
                .hasMessageContaining("assignment permission required");

        verify(uapRepo, never()).save(any());
    }

    @Test
    void removeUser_deniedWhenRemovingLastSystemSuperAdmin_doesNotMutate() {
        UUID profileId = UUID.randomUUID();
        UUID targetUserId = UUID.randomUUID();
        RoleDefinition profile = accessProfile(profileId, EffectivePermissionService.SYSTEM_SUPER_ADMIN_CODE);
        UserAccount target = user("last-admin");
        target.setId(targetUserId);

        allowAssign();
        when(roleRepo.findById(profileId)).thenReturn(Optional.of(profile));
        when(userRepo.findById(targetUserId)).thenReturn(Optional.of(target));
        when(uapRepo.existsByUserIdAndAccessProfileId(targetUserId, profileId)).thenReturn(true);
        when(uapRepo.countByActiveProfileCode(EffectivePermissionService.SYSTEM_SUPER_ADMIN_CODE)).thenReturn(1L);

        assertThatThrownBy(() -> service.removeUser(profileId, targetUserId, null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("last system super admin");

        verify(uapRepo, never()).deleteByUserIdAndAccessProfileId(eq(targetUserId), eq(profileId));
        verify(auditTrailService, never()).logAs(any(), any(), any(), any(), any(), any(), any(), any(), any());
        verify(permissionEvaluationService, never()).clearCache();
    }

    private void allowAssign() {
        when(currentUserService.requireCurrentUser()).thenReturn(actor);
        when(permissionEvaluationService.hasPermission(actor, "security.access_profiles.assign")).thenReturn(true);
    }

    private UserAccount user(String username) {
        UserAccount user = new UserAccount();
        user.setId(UUID.randomUUID());
        user.setUsername(username);
        user.setEmail(username + "@example.test");
        user.setFullName(username);
        user.setRoleName("Regular User");
        user.setPasswordHash("hash");
        return user;
    }

    private RoleDefinition accessProfile(UUID id, String code) {
        RoleDefinition role = new RoleDefinition();
        role.setId(id);
        role.setCode(code);
        role.setName(code);
        role.setActive(true);
        role.setSystem(EffectivePermissionService.SYSTEM_SUPER_ADMIN_CODE.equalsIgnoreCase(code));
        return role;
    }

    private PermissionSet permissionSet(UUID id, String name) {
        PermissionSet set = new PermissionSet();
        ReflectionTestUtils.setField(set, "id", id);
        set.setName(name);
        set.setCode(name.toUpperCase().replace(' ', '_'));
        set.setActive(true);
        return set;
    }

    private AccessProfilePermissionSet accessProfilePermissionSet(UUID profileId, UUID permissionSetId) {
        AccessProfilePermissionSet assignment = new AccessProfilePermissionSet();
        assignment.setAccessProfileId(profileId);
        assignment.setPermissionSetId(permissionSetId);
        return assignment;
    }

    private PermissionSetItem permissionSetItem(Permission permission) {
        PermissionSetItem item = new PermissionSetItem();
        item.setPermission(permission);
        return item;
    }

    private Permission plainPermission(String code) {
        Permission permission = new Permission();
        permission.setId(UUID.randomUUID());
        permission.setCode(code);
        permission.setName(code);
        permission.setCategory("DOCUMENTS");
        permission.setModuleKey("documents");
        permission.setGroupKey("revision");
        permission.setRequiresAudit(false);
        return permission;
    }

    private Permission criticalPermission(String code) {
        Permission permission = new Permission();
        permission.setId(UUID.randomUUID());
        permission.setCode(code);
        permission.setName(code);
        permission.setCategory("SECURITY");
        permission.setModuleKey("security");
        permission.setGroupKey("access");
        permission.setRequiresAudit(true);
        return permission;
    }
}
