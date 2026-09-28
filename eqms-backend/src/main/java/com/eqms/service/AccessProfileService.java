package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import org.springframework.security.access.AccessDeniedException;
import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.dto.settings.AccessProfileCapabilitiesResponse;
import com.eqms.dto.settings.AccessProfileDetailResponse;
import com.eqms.dto.settings.AccessProfileConfigurationRequest;
import com.eqms.dto.settings.AccessProfileFullRequest;
import com.eqms.dto.settings.AccessProfileRequest;
import com.eqms.dto.settings.AccessProfileResponse;
import com.eqms.dto.settings.AccessProfileMigrationReportResponse;
import com.eqms.dto.settings.SecurityChangeRequest;
import com.eqms.entity.*;
import com.eqms.repository.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
@Transactional
public class AccessProfileService {
    private static final String BASELINE_PERSONAL_WORKSPACE_SET_CODE = "BASELINE_PERSONAL_WORKSPACE";

    private static final String ENTITY_TYPE = "ACCESS_PROFILE";
    private static final String VIEW_PERMISSION = "security.access_profiles.view";
    private static final String MANAGE_PERMISSION = "security.access_profiles.update";
    private static final String ASSIGN_PERMISSION = "security.access_profiles.assign";

    private final RoleDefinitionRepository roleRepo;
    private final PermissionSetRepository permSetRepo;
    private final PermissionSetItemRepository permissionSetItemRepo;
    private final AccessProfilePermissionSetRepository appSetRepo;
    private final AccessProfileWorkflowRoleRepository appWfRepo;
    private final UserAccessProfileRepository uapRepo;
    private final UserAccountRepository userRepo;
    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissionEvaluationService;
    private final AuditTrailService auditTrailService;
    private final SecurityChangeSignatureService securityChangeSignatureService;
    private final EffectivePermissionService effectivePermissionService;
    private final SodConstraintRepository sodConstraintRepo;
    private final PermissionSetService permissionSetService;

    public AccessProfileService(
            RoleDefinitionRepository roleRepo,
            PermissionSetRepository permSetRepo,
            PermissionSetItemRepository permissionSetItemRepo,
            AccessProfilePermissionSetRepository appSetRepo,
            AccessProfileWorkflowRoleRepository appWfRepo,
            UserAccessProfileRepository uapRepo,
            UserAccountRepository userRepo,
            CurrentUserService currentUserService,
            PermissionEvaluationService permissionEvaluationService,
            AuditTrailService auditTrailService,
            SecurityChangeSignatureService securityChangeSignatureService,
            EffectivePermissionService effectivePermissionService,
            SodConstraintRepository sodConstraintRepo,
            PermissionSetService permissionSetService) {
        this.roleRepo = roleRepo;
        this.permSetRepo = permSetRepo;
        this.permissionSetItemRepo = permissionSetItemRepo;
        this.appSetRepo = appSetRepo;
        this.appWfRepo = appWfRepo;
        this.uapRepo = uapRepo;
        this.userRepo = userRepo;
        this.currentUserService = currentUserService;
        this.permissionEvaluationService = permissionEvaluationService;
        this.auditTrailService = auditTrailService;
        this.securityChangeSignatureService = securityChangeSignatureService;
        this.effectivePermissionService = effectivePermissionService;
        this.sodConstraintRepo = sodConstraintRepo;
        this.permissionSetService = permissionSetService;
    }

    // ── Migration report (master plan 18.3) ──────────────────────────────────

    @Transactional(readOnly = true)
    public AccessProfileMigrationReportResponse getMigrationReport() {
        requireView();
        List<UserAccount> users = userRepo.findAll();
        long withProfile = 0;
        long superAdmins = 0;
        long withoutAnyPermission = 0;
        long inactiveWithActiveAccess = 0;
        List<AccessProfileMigrationReportResponse.UnassignedUser> unassignedUsers = new ArrayList<>();

        for (UserAccount user : users) {
            var effective = effectivePermissionService.getEffectivePermissionResult(user);
            boolean hasProfile = !uapRepo.findByUserId(user.getId()).isEmpty();
            if (hasProfile) {
                withProfile++;
            } else {
                unassignedUsers.add(new AccessProfileMigrationReportResponse.UnassignedUser(
                        user.getId(), user.getUsername(), user.getFullName(),
                        user.getStatus() != null ? user.getStatus().name() : null));
            }
            if (effective.systemSuperAdmin()) {
                superAdmins++;
            }
            if (!effective.systemSuperAdmin() && effective.permissionCodes().isEmpty()) {
                withoutAnyPermission++;
            }
            boolean isActiveUser = user.getStatus() != null && "Active".equalsIgnoreCase(user.getStatus().name());
            boolean hasAccess = effective.systemSuperAdmin() || !effective.permissionCodes().isEmpty();
            if (!isActiveUser && hasAccess) {
                inactiveWithActiveAccess++;
            }
        }

        return new AccessProfileMigrationReportResponse(
                users.size(), withProfile, unassignedUsers.size(), superAdmins,
                withoutAnyPermission, inactiveWithActiveAccess, true, unassignedUsers);
    }

    // ── List ──────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Page<AccessProfileResponse> listProfiles(int page, int size, String search, String type, String status) {
        return listProfiles(page, size, search, type, status, null, null);
    }

    @Transactional(readOnly = true)
    public Page<AccessProfileResponse> listProfiles(int page, int size, String search, String type, String status,
            String createdFrom, String createdTo) {
        return listProfiles(page, size, search, type, status, createdFrom, createdTo, null, null);
    }

    @Transactional(readOnly = true)
    public Page<AccessProfileResponse> listProfiles(int page, int size, String search, String type, String status,
            String createdFrom, String createdTo, String updatedFrom, String updatedTo) {
        requireView();
        Specification<RoleDefinition> spec = buildSpec(search, type, status, createdFrom, createdTo, updatedFrom, updatedTo);
        Page<RoleDefinition> roles = roleRepo.findAll(spec, PageRequest.of(page, size, Sort.by("name")));
        return roles.map(this::toSummaryResponse);
    }

    @Transactional(readOnly = true)
    public List<AccessProfileResponse> listAllProfiles() {
        requireView();
        return roleRepo.findAll(Sort.by("name")).stream().map(this::toSummaryResponse).toList();
    }

    // ── Detail ────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public AccessProfileDetailResponse getProfile(UUID id) {
        requireView();
        RoleDefinition role = requireRole(id);
        return toDetailResponse(role);
    }

    @Transactional(readOnly = true)
    public AccessProfileCapabilitiesResponse getCapabilities(UUID id) {
        UserAccount actor = currentUserService.requireCurrentUser();
        requireRole(id);
        boolean canView = canView(actor);
        boolean canManage = canManage(actor);
        boolean canAssign = canAssign(actor);
        long assignedUsers = uapRepo.countByAccessProfileId(id);
        boolean deletingWouldRemoveAssignedAccess = assignedUsers > 0;

        // No profile -- including the system super admin one -- is hard-locked by name here.
        // Every mutating action stays gated purely by the actor's own permission plus the
        // admin-coverage invariant enforced at write time (see requireProfileRemovalKeepsAdminCoverage
        // and friends): the org must always retain at least one active administrator, nothing more,
        // nothing role-specific.
        Map<String, AccessProfileCapabilitiesResponse.ActionCapability> actions = new LinkedHashMap<>();
        actions.put("view", capability(canView, VIEW_PERMISSION, "Access profile view permission required"));
        actions.put("edit", capability(canManage, MANAGE_PERMISSION, "Access profile management permission required"));
        actions.put("duplicate", capability(canManage, MANAGE_PERMISSION, "Access profile management permission required"));
        actions.put("delete", capability(
                canManage && !deletingWouldRemoveAssignedAccess,
                MANAGE_PERMISSION,
                !canManage ? "Access profile management permission required"
                        : deletingWouldRemoveAssignedAccess ? "Access profile is assigned to users and cannot be deleted"
                        : null));
        actions.put("toggleStatus", capability(canManage, MANAGE_PERMISSION, "Access profile management permission required"));
        actions.put("assignPermissionSets", capability(canAssign, ASSIGN_PERMISSION, "Access profile assignment permission required"));
        actions.put("assignWorkflowRoles", capability(canAssign, ASSIGN_PERMISSION, "Access profile assignment permission required"));
        actions.put("assignUsers", capability(canAssign, ASSIGN_PERMISSION, "Access profile assignment permission required"));
        actions.put("removeUsers", capability(
                canAssign,
                ASSIGN_PERMISSION,
                "Access profile assignment permission required"));
        return new AccessProfileCapabilitiesResponse(id, actions);
    }

    // ── Create ────────────────────────────────────────────────────────────────

    public AccessProfileDetailResponse createProfile(AccessProfileRequest req) {
        UserAccount actor = requireManage();
        securityChangeSignatureService.requireValidToken(actor, req.signatureToken());
        RoleDefinition role = new RoleDefinition();
        role.setCode(req.code() != null ? req.code() : generateCode(req.name()));
        role.setName(req.name());
        role.setDescription(req.description());
        role.setType(req.type() != null ? req.type() : "CUSTOM");
        role.setActive(req.active());
        role.setSystem(false);
        role.setBusinessUnitScope(req.businessUnitScope());
        role.setDepartmentScope(req.departmentScope());
        role = roleRepo.save(role);
        linkBaselinePersonalWorkspace(role.getId(), actor);
        ElectronicSignature esig = securityChangeSignatureService.record(actor, req.signatureToken(),
                SecurityChangeSignatureService.MEANING_ACCESS_PROFILE_CHANGE,
                ENTITY_TYPE, role.getId(), role.getName(), req.reason(),
                null, "Created access profile " + safeCode(role));
        auditTrailService.logAs(actor, ENTITY_TYPE, role.getName(), role.getId(),
                "ACCESS_PROFILE_CREATED", null, role.isActive() ? "Active" : "Inactive",
                withReason("Created access profile " + safeCode(role), req.reason()), List.of(), esig == null ? null : esig.getId());
        permissionEvaluationService.clearCache();
        return toDetailResponse(role);
    }

    /**
     * Atomic "create access profile in one shot" for the setup wizard: profile + optional
     * auto-managed permission set (individually picked codes) + shared permission
     * sets + workflow roles + initial users — one transaction, one e-signature.
     * Any failure (unknown code, SoD BLOCK conflict, duplicate name) rolls back
     * everything so no partial role is ever left behind.
     */
    public AccessProfileDetailResponse createProfileFull(AccessProfileFullRequest req) {
        UserAccount actor = requireManage();
        requireAssign();
        securityChangeSignatureService.requireValidToken(actor, req.signatureToken());
        if (req.name() == null || req.name().trim().isEmpty()) {
            throw new IllegalArgumentException("Role name is required");
        }
        String name = req.name().trim();
        roleRepo.findByNameIgnoreCase(name).ifPresent(existing -> {
            throw new IllegalArgumentException("An access profile named \"" + name + "\" already exists");
        });
        String code = generateCode(name);
        roleRepo.findByCodeIgnoreCase(code).ifPresent(existing -> {
            throw new IllegalArgumentException("An access profile with code \"" + code + "\" already exists");
        });

        RoleDefinition role = new RoleDefinition();
        role.setCode(code);
        role.setName(name);
        role.setDescription(req.description());
        role.setType("CUSTOM");
        role.setActive(req.active());
        role.setSystem(false);
        role.setBusinessUnitScope(req.businessUnitScope());
        role.setDepartmentScope(req.departmentScope());
        role = roleRepo.save(role);
        UUID profileId = role.getId();
        linkBaselinePersonalWorkspace(profileId, actor);

        List<String> summary = new ArrayList<>();

        List<String> permissionCodes = req.permissionCodes() == null ? List.of() : req.permissionCodes();
        if (!permissionCodes.isEmpty()) {
            PermissionSet managed = permissionSetService.createManagedSet(
                    name + " Permissions", managedSetCode(code), permissionCodes, actor);
            linkPermissionSet(profileId, managed.getId(), actor);
            summary.add(permissionCodes.size() + " individual permission(s)");
        }

        Set<UUID> setIds = new LinkedHashSet<>(req.permissionSetIds() == null ? List.of() : req.permissionSetIds());
        if (!setIds.isEmpty()) {
            preventSelfGrantOfCriticalPermissionSets(actor, profileId, setIds);
            for (UUID psId : setIds) {
                requirePermissionSet(psId);
                linkPermissionSet(profileId, psId, actor);
            }
            summary.add(setIds.size() + " shared permission set(s)");
        }

        Set<String> workflowRoles = new LinkedHashSet<>();
        if (req.workflowRoles() != null) {
            for (String wfRole : req.workflowRoles()) {
                if (wfRole != null && !wfRole.trim().isEmpty()) {
                    workflowRoles.add(wfRole.trim());
                }
            }
        }
        for (String wfRole : workflowRoles) {
            AccessProfileWorkflowRole link = new AccessProfileWorkflowRole();
            link.setAccessProfileId(profileId);
            link.setWorkflowRole(wfRole);
            appWfRepo.save(link);
        }
        if (!workflowRoles.isEmpty()) {
            summary.add("workflow roles: " + String.join(", ", workflowRoles));
        }

        Set<UUID> userIds = new LinkedHashSet<>(req.userIds() == null ? List.of() : req.userIds());
        List<String> assignedUsers = new ArrayList<>();
        for (UUID userId : userIds) {
            UserAccount targetUser = requireUser(userId);
            if (actor.getId() != null && actor.getId().equals(userId)
                    && profileContainsCriticalPermissionSet(profileId)) {
                throw new IllegalStateException("Users cannot assign themselves an access profile containing critical permissions");
            }
            requireNoBlockingSodConflict(targetUser, profileId);
            UserAccessProfile assignment = new UserAccessProfile();
            assignment.setUserId(userId);
            assignment.setAccessProfileId(profileId);
            assignment.setAssignedBy(actor);
            uapRepo.save(assignment);
            assignedUsers.add(userLabel(targetUser));
        }
        if (!assignedUsers.isEmpty()) {
            summary.add("users: " + String.join(", ", assignedUsers));
        }

        ElectronicSignature esig = securityChangeSignatureService.record(actor, req.signatureToken(),
                SecurityChangeSignatureService.MEANING_ACCESS_PROFILE_CHANGE,
                ENTITY_TYPE, role.getId(), role.getName(), req.reason(),
                null, "Created access profile " + safeCode(role)
                        + (summary.isEmpty() ? "" : " with " + String.join("; ", summary)));
        auditTrailService.logAs(actor, ENTITY_TYPE, role.getName(), role.getId(),
                "ACCESS_PROFILE_CREATED", null, role.isActive() ? "Active" : "Inactive",
                withReason("Created access profile " + safeCode(role)
                        + (summary.isEmpty() ? "" : " with " + String.join("; ", summary)), req.reason()),
                List.of(), esig == null ? null : esig.getId());
        permissionEvaluationService.clearCache();
        return toDetailResponse(role);
    }

    private void linkPermissionSet(UUID profileId, UUID permissionSetId, UserAccount actor) {
        if (appSetRepo.existsByAccessProfileIdAndPermissionSetId(profileId, permissionSetId)) {
            return;
        }
        AccessProfilePermissionSet link = new AccessProfilePermissionSet();
        link.setAccessProfileId(profileId);
        link.setPermissionSetId(permissionSetId);
        link.setAssignedBy(actor);
        appSetRepo.save(link);
    }

    private void linkBaselinePersonalWorkspace(UUID profileId, UserAccount actor) {
        baselinePersonalWorkspaceSetId().ifPresent(permissionSetId -> linkPermissionSet(profileId, permissionSetId, actor));
    }

    private Optional<UUID> baselinePersonalWorkspaceSetId() {
        return permSetRepo.findByCode(BASELINE_PERSONAL_WORKSPACE_SET_CODE).map(PermissionSet::getId);
    }

    private String managedSetCode(String profileCode) {
        return PermissionSetService.MANAGED_SET_PREFIX + profileCode;
    }

    // ── Update ────────────────────────────────────────────────────────────────

    public AccessProfileDetailResponse updateProfile(UUID id, AccessProfileRequest req) {
        UserAccount actor = requireManage();
        securityChangeSignatureService.requireValidToken(actor, req.signatureToken());
        RoleDefinition role = requireRole(id);
        List<AuditTrailChangeResponse> changes = new ArrayList<>();
        String oldStatus = role.isActive() ? "Active" : "Inactive";
        String oldName = role.getName();
        String oldDescription = role.getDescription();
        String oldType = role.getType();
        String oldBusinessUnitScope = role.getBusinessUnitScope();
        String oldDepartmentScope = role.getDepartmentScope();

        if (role.isActive() && !req.active()) {
            requireProfileRemovalKeepsAdminCoverage(id);
        }

        if (req.name() != null) role.setName(req.name());
        if (req.description() != null) role.setDescription(req.description());
        if (req.type() != null) role.setType(req.type());
        role.setActive(req.active());
        role.setBusinessUnitScope(req.businessUnitScope());
        role.setDepartmentScope(req.departmentScope());
        role = roleRepo.save(role);

        addChange(changes, "Name", oldName, role.getName());
        addChange(changes, "Description", oldDescription, role.getDescription());
        addChange(changes, "Type", oldType, role.getType());
        addChange(changes, "Status", oldStatus, role.isActive() ? "Active" : "Inactive");
        addChange(changes, "Business Unit Scope", oldBusinessUnitScope, role.getBusinessUnitScope());
        addChange(changes, "Department Scope", oldDepartmentScope, role.getDepartmentScope());
        ElectronicSignature esig = securityChangeSignatureService.record(actor, req.signatureToken(),
                SecurityChangeSignatureService.MEANING_ACCESS_PROFILE_CHANGE,
                ENTITY_TYPE, role.getId(), role.getName(), auditReason(role, req.reason()),
                oldName, "Updated access profile " + safeCode(role));
        auditTrailService.logAs(actor, ENTITY_TYPE, role.getName(), role.getId(),
                "ACCESS_PROFILE_UPDATED", oldStatus, role.isActive() ? "Active" : "Inactive",
                withReason("Updated access profile " + safeCode(role), req.reason()), changes, esig == null ? null : esig.getId());
        permissionEvaluationService.clearCache();
        return toDetailResponse(role);
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    public void deleteProfile(UUID id, SecurityChangeRequest sig) {
        UserAccount actor = requireManage();
        sig = SecurityChangeRequest.orEmpty(sig);
        securityChangeSignatureService.requireValidToken(actor, sig.signatureToken());
        RoleDefinition role = requireRole(id);
        long assignedUsers = uapRepo.countByAccessProfileId(id);
        if (assignedUsers > 0) {
            throw new IllegalStateException("Access profile is assigned to users and cannot be deleted");
        }
        requireProfileRemovalKeepsAdminCoverage(id);
        // Clean up the role's auto-managed permission set (ROLE_<code>) alongside the role,
        // as long as no other profile happens to reference it.
        permSetRepo.findByCode(managedSetCode(role.getCode())).ifPresent(managed -> {
            if (!managed.isSystem()) {
                appSetRepo.deleteByAccessProfileIdAndPermissionSetId(id, managed.getId());
                if (appSetRepo.countByPermissionSetId(managed.getId()) == 0) {
                    permissionSetItemRepo.deleteAllByPermissionSet_Id(managed.getId());
                    permSetRepo.delete(managed);
                }
            }
        });
        roleRepo.delete(role);
        ElectronicSignature esig = securityChangeSignatureService.record(actor, sig.signatureToken(),
                SecurityChangeSignatureService.MEANING_ACCESS_PROFILE_CHANGE,
                ENTITY_TYPE, id, role.getName(), auditReason(role, sig.reason()),
                "Deleted access profile " + safeCode(role), null);
        auditTrailService.logAs(actor, ENTITY_TYPE, role.getName(), role.getId(),
                "ACCESS_PROFILE_DELETED", role.isActive() ? "Active" : "Inactive", null,
                withReason("Deleted access profile " + safeCode(role), sig.reason()), List.of(), esig == null ? null : esig.getId());
        permissionEvaluationService.clearCache();
    }

    // ── Duplicate ─────────────────────────────────────────────────────────────

    public AccessProfileDetailResponse duplicateProfile(UUID id, String newName, SecurityChangeRequest sig) {
        UserAccount actor = requireManage();
        sig = SecurityChangeRequest.orEmpty(sig);
        securityChangeSignatureService.requireValidToken(actor, sig.signatureToken());
        RoleDefinition src = requireRole(id);
        RoleDefinition copy = new RoleDefinition();
        copy.setCode(generateCode(newName));
        copy.setName(newName != null ? newName : src.getName() + " (Copy)");
        copy.setDescription(src.getDescription());
        copy.setType("CUSTOM");
        copy.setActive(src.isActive());
        copy.setSystem(false);
        copy.setBusinessUnitScope(src.getBusinessUnitScope());
        copy.setDepartmentScope(src.getDepartmentScope());
        copy = roleRepo.save(copy);

        // Copy permission set assignments
        UUID copyId = copy.getId();
        for (AccessProfilePermissionSet a : appSetRepo.findByAccessProfileId(id)) {
            AccessProfilePermissionSet na = new AccessProfilePermissionSet();
            na.setAccessProfileId(copyId);
            na.setPermissionSetId(a.getPermissionSetId());
            appSetRepo.save(na);
        }
        // Copy workflow role assignments
        for (AccessProfileWorkflowRole a : appWfRepo.findByAccessProfileId(id)) {
            AccessProfileWorkflowRole na = new AccessProfileWorkflowRole();
            na.setAccessProfileId(copyId);
            na.setWorkflowRole(a.getWorkflowRole());
            appWfRepo.save(na);
        }
        ElectronicSignature esig = securityChangeSignatureService.record(actor, sig.signatureToken(),
                SecurityChangeSignatureService.MEANING_ACCESS_PROFILE_CHANGE,
                ENTITY_TYPE, copy.getId(), copy.getName(), sig.reason(),
                safeCode(src), "Duplicated access profile from " + safeCode(src));
        auditTrailService.logAs(actor, ENTITY_TYPE, copy.getName(), copy.getId(),
                "ACCESS_PROFILE_DUPLICATED", null, copy.isActive() ? "Active" : "Inactive",
                withReason("Duplicated access profile from " + safeCode(src), sig.reason()), List.of(), esig == null ? null : esig.getId());
        permissionEvaluationService.clearCache();
        return toDetailResponse(copy);
    }

    // ── Enable / Disable ─────────────────────────────────────────────────────

    public AccessProfileDetailResponse toggleStatus(UUID id, SecurityChangeRequest sig) {
        UserAccount actor = requireManage();
        sig = SecurityChangeRequest.orEmpty(sig);
        securityChangeSignatureService.requireValidToken(actor, sig.signatureToken());
        RoleDefinition role = requireRole(id);
        String oldStatus = role.isActive() ? "Active" : "Inactive";
        if (role.isActive()) {
            requireProfileRemovalKeepsAdminCoverage(id);
        }
        role.setActive(!role.isActive());
        RoleDefinition saved = roleRepo.save(role);
        ElectronicSignature esig = securityChangeSignatureService.record(actor, sig.signatureToken(),
                SecurityChangeSignatureService.MEANING_ACCESS_PROFILE_CHANGE,
                ENTITY_TYPE, saved.getId(), saved.getName(), auditReason(saved, sig.reason()),
                oldStatus, saved.isActive() ? "Active" : "Inactive");
        auditTrailService.logAs(actor, ENTITY_TYPE, saved.getName(), saved.getId(),
                saved.isActive() ? "ACCESS_PROFILE_ACTIVATED" : "ACCESS_PROFILE_DEACTIVATED",
                oldStatus, saved.isActive() ? "Active" : "Inactive",
                withReason("Changed access profile status " + safeCode(saved), sig.reason()),
                List.of(new AuditTrailChangeResponse("Status", oldStatus, saved.isActive() ? "Active" : "Inactive")),
                esig == null ? null : esig.getId());
        permissionEvaluationService.clearCache();
        return toDetailResponse(saved);
    }

    // ── Permission Sets ───────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<AccessProfileDetailResponse.PermissionSetSummary> getPermissionSets(UUID profileId) {
        requireView();
        requireRole(profileId);
        return appSetRepo.findByAccessProfileId(profileId).stream()
                .map(a -> toPermSetSummary(a.getPermissionSet()))
                .filter(Objects::nonNull)
                .toList();
    }

    public void setPermissionSets(UUID profileId, List<UUID> permissionSetIds, SecurityChangeRequest sig) {
        UserAccount actor = requireAssign();
        sig = SecurityChangeRequest.orEmpty(sig);
        securityChangeSignatureService.requireValidToken(actor, sig.signatureToken());
        RoleDefinition profile = requireRole(profileId);
        Set<UUID> oldIds = appSetRepo.findByAccessProfileId(profileId).stream()
                .map(AccessProfilePermissionSet::getPermissionSetId)
                .filter(Objects::nonNull)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
        Set<UUID> requestedIds = new LinkedHashSet<>(permissionSetIds == null ? List.of() : permissionSetIds);
        baselinePersonalWorkspaceSetId().ifPresent(requestedIds::add);
        Set<UUID> addedIds = new LinkedHashSet<>(requestedIds);
        addedIds.removeAll(oldIds);
        preventSelfGrantOfCriticalPermissionSets(actor, profileId, addedIds);
        Set<UUID> removedIds = new LinkedHashSet<>(oldIds);
        removedIds.removeAll(requestedIds);
        requireProfilePermissionSetRemovalKeepsAdminCoverage(profileId, removedIds);
        List<String> oldSets = appSetRepo.findByAccessProfileId(profileId).stream()
                .map(AccessProfilePermissionSet::getPermissionSet)
                .filter(Objects::nonNull)
                .map(this::safePermissionSet)
                .sorted()
                .toList();
        appSetRepo.deleteByAccessProfileId(profileId);
        for (UUID psId : requestedIds) {
            AccessProfilePermissionSet a = new AccessProfilePermissionSet();
            a.setAccessProfileId(profileId);
            a.setPermissionSetId(psId);
            a.setAssignedBy(actor);
            appSetRepo.save(a);
        }
        List<String> newSets = appSetRepo.findByAccessProfileId(profileId).stream()
                .map(AccessProfilePermissionSet::getPermissionSet)
                .filter(Objects::nonNull)
                .map(this::safePermissionSet)
                .sorted()
                .toList();
        ElectronicSignature esig = securityChangeSignatureService.record(actor, sig.signatureToken(),
                SecurityChangeSignatureService.MEANING_ACCESS_PROFILE_CHANGE,
                ENTITY_TYPE, profile.getId(), profile.getName(), auditReason(profile, sig.reason()),
                String.join(", ", oldSets), String.join(", ", newSets));
        auditTrailService.logAs(actor, ENTITY_TYPE, profile.getName(), profile.getId(),
                "ACCESS_PROFILE_PERMISSION_SETS_REPLACED", null, null,
                withReason("Replaced permission sets for " + safeCode(profile), sig.reason()),
                List.of(new AuditTrailChangeResponse("Permission Sets", String.join(", ", oldSets), String.join(", ", newSets))),
                esig == null ? null : esig.getId());
        permissionEvaluationService.clearCache();
    }

    public void addPermissionSet(UUID profileId, UUID permissionSetId, SecurityChangeRequest sig) {
        UserAccount actor = requireAssign();
        sig = SecurityChangeRequest.orEmpty(sig);
        securityChangeSignatureService.requireValidToken(actor, sig.signatureToken());
        RoleDefinition profile = requireRole(profileId);
        PermissionSet permissionSet = requirePermissionSet(permissionSetId);
        preventSelfGrantOfCriticalPermissionSets(actor, profileId, Set.of(permissionSetId));
        if (!appSetRepo.existsByAccessProfileIdAndPermissionSetId(profileId, permissionSetId)) {
            AccessProfilePermissionSet a = new AccessProfilePermissionSet();
            a.setAccessProfileId(profileId);
            a.setPermissionSetId(permissionSetId);
            a.setAssignedBy(actor);
            appSetRepo.save(a);
            ElectronicSignature esig = securityChangeSignatureService.record(actor, sig.signatureToken(),
                    SecurityChangeSignatureService.MEANING_ACCESS_PROFILE_CHANGE,
                    ENTITY_TYPE, profile.getId(), profile.getName(), auditReason(profile, sig.reason()),
                    null, "Assigned permission set " + safePermissionSet(permissionSet));
            auditTrailService.logAs(actor, ENTITY_TYPE, profile.getName(), profile.getId(),
                    "ACCESS_PROFILE_PERMISSION_SET_ASSIGNED", null, null,
                    withReason("Assigned permission set " + safePermissionSet(permissionSet) + " to " + safeCode(profile), sig.reason()),
                    List.of(new AuditTrailChangeResponse("Permission Set", null, safePermissionSet(permissionSet))),
                    esig == null ? null : esig.getId());
            permissionEvaluationService.clearCache();
        }
    }

    public void removePermissionSet(UUID profileId, UUID permissionSetId, SecurityChangeRequest sig) {
        UserAccount actor = requireAssign();
        sig = SecurityChangeRequest.orEmpty(sig);
        securityChangeSignatureService.requireValidToken(actor, sig.signatureToken());
        RoleDefinition profile = requireRole(profileId);
        PermissionSet permissionSet = requirePermissionSet(permissionSetId);
        if (BASELINE_PERSONAL_WORKSPACE_SET_CODE.equalsIgnoreCase(permissionSet.getCode())) {
            throw new IllegalArgumentException("The baseline personal workspace permission set is required for every access profile");
        }
        requireProfilePermissionSetRemovalKeepsAdminCoverage(profileId, Set.of(permissionSetId));
        appSetRepo.deleteByAccessProfileIdAndPermissionSetId(profileId, permissionSetId);
        ElectronicSignature esig = securityChangeSignatureService.record(actor, sig.signatureToken(),
                SecurityChangeSignatureService.MEANING_ACCESS_PROFILE_CHANGE,
                ENTITY_TYPE, profile.getId(), profile.getName(), auditReason(profile, sig.reason()),
                "Permission set " + safePermissionSet(permissionSet), null);
        auditTrailService.logAs(actor, ENTITY_TYPE, profile.getName(), profile.getId(),
                "ACCESS_PROFILE_PERMISSION_SET_REMOVED", null, null,
                withReason("Removed permission set " + safePermissionSet(permissionSet) + " from " + safeCode(profile), sig.reason()),
                List.of(new AuditTrailChangeResponse("Permission Set", safePermissionSet(permissionSet), null)),
                esig == null ? null : esig.getId());
        permissionEvaluationService.clearCache();
    }

    /**
     * Replaces the role's individually-picked permissions — the contents of its
     * auto-managed ROLE_<code> permission set. Creates the set on first use,
     * detaches and deletes it when codes is empty. One e-signature per call.
     */
    public void setManagedPermissions(UUID profileId, List<String> codes, SecurityChangeRequest sig) {
        UserAccount actor = requireAssign();
        sig = SecurityChangeRequest.orEmpty(sig);
        securityChangeSignatureService.requireValidToken(actor, sig.signatureToken());
        RoleDefinition profile = requireRole(profileId);
        Optional<PermissionSet> existing = permSetRepo.findByCode(managedSetCode(profile.getCode()));
        String oldValue = existing.map(ps -> ps.getName()).orElse(null);
        requireManagedPermissionRemovalKeepsAdminCoverage(profileId, existing.orElse(null), codes);
        List<String> requested = applyManagedPermissions(profile, codes, actor);

        ElectronicSignature esig = securityChangeSignatureService.record(actor, sig.signatureToken(),
                SecurityChangeSignatureService.MEANING_ACCESS_PROFILE_CHANGE,
                ENTITY_TYPE, profile.getId(), profile.getName(), auditReason(profile, sig.reason()),
                oldValue, requested.isEmpty() ? "Removed individual permissions" : requested.size() + " individual permission(s)");
        auditTrailService.logAs(actor, ENTITY_TYPE, profile.getName(), profile.getId(),
                "ACCESS_PROFILE_PERMISSIONS_REPLACED", null, null,
                withReason("Replaced individually-picked permissions for " + safeCode(profile), sig.reason()),
                List.of(new AuditTrailChangeResponse("Individual Permissions",
                        oldValue, requested.isEmpty() ? null : requested.size() + " permission(s)")),
                esig == null ? null : esig.getId());
        permissionEvaluationService.clearCache();
    }

    /**
     * Core managed-set reconciliation shared by setManagedPermissions and the aggregate
     * configuration save. No signature record here — the caller owns audit + e-sign.
     * Returns the normalized requested codes.
     */
    private List<String> applyManagedPermissions(RoleDefinition profile, List<String> codes, UserAccount actor) {
        UUID profileId = profile.getId();
        String setCode = managedSetCode(profile.getCode());
        Optional<PermissionSet> existing = permSetRepo.findByCode(setCode);
        List<String> requested = codes == null ? List.of() : codes.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(code -> !code.isEmpty())
                .distinct()
                .toList();

        if (requested.isEmpty()) {
            if (existing.isPresent()) {
                PermissionSet managed = existing.get();
                appSetRepo.deleteByAccessProfileIdAndPermissionSetId(profileId, managed.getId());
                permissionSetItemRepo.deleteAllByPermissionSet_Id(managed.getId());
                permSetRepo.delete(managed);
            }
        } else if (existing.isPresent()) {
            PermissionSet managed = existing.get();
            permissionSetService.replaceManagedSetItems(managed, requested, actor);
            linkPermissionSet(profileId, managed.getId(), actor);
            requireNoSelfGrantOfCriticalManagedSet(actor, profileId, managed.getId());
        } else {
            PermissionSet managed = permissionSetService.createManagedSet(
                    profile.getName() + " Permissions", setCode, requested, actor);
            linkPermissionSet(profileId, managed.getId(), actor);
            requireNoSelfGrantOfCriticalManagedSet(actor, profileId, managed.getId());
        }
        return requested;
    }

    /**
     * Mirrors preventSelfGrantOfCriticalPermissionSets for the managed-set path:
     * an actor assigned to this profile must not grant themself critical permissions
     * by editing the role's individually-picked permissions. Applies uniformly -- no identity
     * is exempt, including whoever holds the org's top admin profile; escalating a second
     * admin's help is the intended path, not a self-service bypass.
     */
    private void requireNoSelfGrantOfCriticalManagedSet(UserAccount actor, UUID profileId, UUID managedSetId) {
        if (uapRepo.existsByUserIdAndAccessProfileId(actor.getId(), profileId)
                && permissionSetHasCriticalPermission(managedSetId)) {
            throw new IllegalStateException("Users cannot grant themselves critical permissions through their own access profile");
        }
    }

    /**
     * Aggregate "save role configuration": applies general info, direct (managed)
     * permissions, shared permission sets, workflow roles and user assignments as
     * ONE transaction with ONE e-signature and ONE composite audit event.
     * Optimistic concurrency via expectedUpdatedAt — a mismatch returns 409 and
     * changes nothing. Null sections in the request are left untouched.
     */
    public AccessProfileDetailResponse updateProfileConfiguration(UUID id, AccessProfileConfigurationRequest req) {
        UserAccount actor = currentUserService.requireCurrentUser();
        if (!canAssign(actor)) {
            throw new AccessDeniedException("Access profile assignment permission required");
        }
        securityChangeSignatureService.requireValidToken(actor, req.signatureToken());
        // Serialize aggregate updates so the timestamp check is evaluated against the
        // latest committed Role configuration, including assignment-only changes.
        RoleDefinition profile = requireRoleForConfigurationUpdate(id);
        if (req.expectedUpdatedAt() != null && profile.getUpdatedAt() != null
                && !req.expectedUpdatedAt().equals(profile.getUpdatedAt())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "This role was modified by another administrator. Reload to see the latest configuration.");
        }

        List<AuditTrailChangeResponse> changes = new ArrayList<>();

        // 1 — General info (requires the stronger manage permission, matching updateProfile)
        if (req.general() != null) {
            AccessProfileConfigurationRequest.General g = req.general();
            boolean generalDirty = !Objects.equals(g.name(), profile.getName())
                    || !Objects.equals(g.description(), profile.getDescription())
                    || g.active() != profile.isActive()
                    || !Objects.equals(g.businessUnitScope(), profile.getBusinessUnitScope())
                    || !Objects.equals(g.departmentScope(), profile.getDepartmentScope());
            if (generalDirty) {
                if (!canManage(actor)) {
                    throw new AccessDeniedException("Access profile manage permission required to change role details");
                }
                if (g.name() != null && !g.name().equals(profile.getName())) {
                    roleRepo.findByNameIgnoreCase(g.name().trim()).ifPresent(existing -> {
                        if (!existing.getId().equals(id)) {
                            throw new IllegalArgumentException("An access profile named \"" + g.name().trim() + "\" already exists");
                        }
                    });
                }
                if (profile.isActive() && !g.active()) {
                    requireProfileRemovalKeepsAdminCoverage(id);
                }
                addChange(changes, "Name", profile.getName(), g.name());
                addChange(changes, "Description", profile.getDescription(), g.description());
                addChange(changes, "Status", profile.isActive() ? "Active" : "Inactive", g.active() ? "Active" : "Inactive");
                addChange(changes, "Business Unit Scope", profile.getBusinessUnitScope(), g.businessUnitScope());
                addChange(changes, "Department Scope", profile.getDepartmentScope(), g.departmentScope());
                if (g.name() != null) profile.setName(g.name().trim());
                profile.setDescription(g.description());
                profile.setActive(g.active());
                profile.setBusinessUnitScope(g.businessUnitScope());
                profile.setDepartmentScope(g.departmentScope());
                profile = roleRepo.save(profile);
            }
        }

        String managedCode = managedSetCode(profile.getCode());

        // 2 — Direct (managed) permissions
        if (req.managedPermissionCodes() != null) {
            Optional<PermissionSet> existingManagedSet = permSetRepo.findByCode(managedCode);
            List<String> oldCodes = existingManagedSet
                    .map(ps -> getPermissionSetCodes(ps.getId()))
                    .orElse(List.of());
            requireManagedPermissionRemovalKeepsAdminCoverage(id, existingManagedSet.orElse(null), req.managedPermissionCodes());
            List<String> newCodes = applyManagedPermissions(profile, req.managedPermissionCodes(), actor);
            if (!new HashSet<>(oldCodes).equals(new HashSet<>(newCodes))) {
                addChange(changes, "Direct Permissions",
                        oldCodes.isEmpty() ? null : oldCodes.size() + " permission(s)",
                        newCodes.isEmpty() ? null : newCodes.size() + " permission(s)");
            }
        }

        // 3 — Shared permission sets (reconcile, never touching the managed set link)
        if (req.sharedPermissionSetIds() != null) {
            UUID managedSetId = permSetRepo.findByCode(managedCode).map(PermissionSet::getId).orElse(null);
            Set<UUID> requestedIds = new LinkedHashSet<>(req.sharedPermissionSetIds());
            requestedIds.remove(managedSetId);
            Set<UUID> currentIds = appSetRepo.findByAccessProfileId(id).stream()
                    .map(AccessProfilePermissionSet::getPermissionSetId)
                    .filter(Objects::nonNull)
                    .filter(psId -> !psId.equals(managedSetId))
                    .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
            Set<UUID> added = new LinkedHashSet<>(requestedIds);
            added.removeAll(currentIds);
            Set<UUID> removed = new LinkedHashSet<>(currentIds);
            removed.removeAll(requestedIds);
            if (!added.isEmpty() || !removed.isEmpty()) {
                preventSelfGrantOfCriticalPermissionSets(actor, id, added);
                requireProfilePermissionSetRemovalKeepsAdminCoverage(id, removed);
                for (UUID psId : added) {
                    requirePermissionSet(psId);
                    linkPermissionSet(id, psId, actor);
                }
                for (UUID psId : removed) {
                    appSetRepo.deleteByAccessProfileIdAndPermissionSetId(id, psId);
                }
                addChange(changes, "Shared Permission Sets",
                        currentIds.size() + " set(s)", requestedIds.size() + " set(s)");
            }
        }

        // 4 — Workflow roles (reconcile)
        if (req.workflowRoles() != null) {
            Set<String> requestedRoles = req.workflowRoles().stream()
                    .filter(Objects::nonNull)
                    .map(String::trim)
                    .filter(r -> !r.isEmpty())
                    .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
            Set<String> currentRoles = appWfRepo.findByAccessProfileId(id).stream()
                    .map(AccessProfileWorkflowRole::getWorkflowRole)
                    .filter(Objects::nonNull)
                    .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
            if (!requestedRoles.equals(currentRoles)) {
                for (String role : requestedRoles) {
                    if (!currentRoles.contains(role)) {
                        AccessProfileWorkflowRole link = new AccessProfileWorkflowRole();
                        link.setAccessProfileId(id);
                        link.setWorkflowRole(role);
                        appWfRepo.save(link);
                    }
                }
                for (String role : currentRoles) {
                    if (!requestedRoles.contains(role)) {
                        appWfRepo.deleteByAccessProfileIdAndWorkflowRole(id, role);
                    }
                }
                addChange(changes, "Workflow Roles",
                        String.join(", ", currentRoles), String.join(", ", requestedRoles));
            }
        }

        // 5 — User assignments (reconcile; SoD BLOCK on any added user aborts everything)
        if (req.userIds() != null) {
            Set<UUID> requestedUsers = new LinkedHashSet<>(req.userIds());
            Set<UUID> currentUsers = uapRepo.findByAccessProfileId(id).stream()
                    .map(UserAccessProfile::getUserId)
                    .filter(Objects::nonNull)
                    .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
            Set<UUID> addedUsers = new LinkedHashSet<>(requestedUsers);
            addedUsers.removeAll(currentUsers);
            Set<UUID> removedUsers = new LinkedHashSet<>(currentUsers);
            removedUsers.removeAll(requestedUsers);
            if (!addedUsers.isEmpty() || !removedUsers.isEmpty()) {
                for (UUID userId : addedUsers) {
                    UserAccount targetUser = requireUser(userId);
                    if (actor.getId() != null && actor.getId().equals(userId)
                            && profileContainsCriticalPermissionSet(id)) {
                        throw new IllegalStateException("Users cannot assign themselves an access profile containing critical permissions");
                    }
                    requireNoBlockingSodConflict(targetUser, id);
                    UserAccessProfile assignment = new UserAccessProfile();
                    assignment.setUserId(userId);
                    assignment.setAccessProfileId(id);
                    assignment.setAssignedBy(actor);
                    uapRepo.save(assignment);
                }
                for (UUID userId : removedUsers) {
                    uapRepo.deleteByUserIdAndAccessProfileId(userId, id);
                }
                addChange(changes, "Assigned Users",
                        currentUsers.size() + " user(s)", requestedUsers.size() + " user(s)");
            }
        }

        if (!changes.isEmpty()) {
            // Permission-set links and user assignments do not mutate the Role entity
            // themselves. Touch it so the next editor receives a new concurrency token.
            profile.setUpdatedAt(java.time.Instant.now());
            profile = roleRepo.save(profile);
            ElectronicSignature esig = securityChangeSignatureService.record(actor, req.signatureToken(),
                    SecurityChangeSignatureService.MEANING_ACCESS_PROFILE_CHANGE,
                    ENTITY_TYPE, profile.getId(), profile.getName(), auditReason(profile, req.reason()),
                    null, "Updated role configuration (" + changes.size() + " change group(s))");
            auditTrailService.logAs(actor, ENTITY_TYPE, profile.getName(), profile.getId(),
                    "ACCESS_PROFILE_CONFIGURATION_UPDATED", null, profile.isActive() ? "Active" : "Inactive",
                    withReason("Updated role configuration for " + safeCode(profile), req.reason()), changes, esig == null ? null : esig.getId());
            permissionEvaluationService.clearCache();
        }
        return toDetailResponse(requireRole(id));
    }

    private List<String> getPermissionSetCodes(UUID permissionSetId) {
        return permissionSetItemRepo.findAllByPermissionSet_Id(permissionSetId).stream()
                .map(PermissionSetItem::getPermission)
                .filter(Objects::nonNull)
                .map(Permission::getCode)
                .filter(Objects::nonNull)
                .sorted()
                .toList();
    }

    // ── Workflow Roles ─────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<String> getWorkflowRoles(UUID profileId) {
        requireView();
        requireRole(profileId);
        return appWfRepo.findByAccessProfileId(profileId).stream()
                .map(AccessProfileWorkflowRole::getWorkflowRole).toList();
    }

    public void setWorkflowRoles(UUID profileId, List<String> roles, SecurityChangeRequest sig) {
        UserAccount actor = requireAssign();
        sig = SecurityChangeRequest.orEmpty(sig);
        securityChangeSignatureService.requireValidToken(actor, sig.signatureToken());
        RoleDefinition profile = requireRole(profileId);
        List<String> oldRoles = appWfRepo.findByAccessProfileId(profileId).stream()
                .map(AccessProfileWorkflowRole::getWorkflowRole)
                .sorted()
                .toList();
        appWfRepo.deleteByAccessProfileId(profileId);
        for (String role : roles) {
            AccessProfileWorkflowRole a = new AccessProfileWorkflowRole();
            a.setAccessProfileId(profileId);
            a.setWorkflowRole(role);
            appWfRepo.save(a);
        }
        List<String> newRoles = appWfRepo.findByAccessProfileId(profileId).stream()
                .map(AccessProfileWorkflowRole::getWorkflowRole)
                .sorted()
                .toList();
        ElectronicSignature esig = securityChangeSignatureService.record(actor, sig.signatureToken(),
                SecurityChangeSignatureService.MEANING_ACCESS_PROFILE_CHANGE,
                ENTITY_TYPE, profile.getId(), profile.getName(), auditReason(profile, sig.reason()),
                String.join(", ", oldRoles), String.join(", ", newRoles));
        auditTrailService.logAs(actor, ENTITY_TYPE, profile.getName(), profile.getId(),
                "ACCESS_PROFILE_WORKFLOW_ROLES_REPLACED", null, null,
                withReason("Replaced workflow roles for " + safeCode(profile), sig.reason()),
                List.of(new AuditTrailChangeResponse("Workflow Roles", String.join(", ", oldRoles), String.join(", ", newRoles))),
                esig == null ? null : esig.getId());
        permissionEvaluationService.clearCache();
    }

    public void addWorkflowRole(UUID profileId, String role, SecurityChangeRequest sig) {
        UserAccount actor = requireAssign();
        sig = SecurityChangeRequest.orEmpty(sig);
        securityChangeSignatureService.requireValidToken(actor, sig.signatureToken());
        RoleDefinition profile = requireRole(profileId);
        AccessProfileWorkflowRole.PK pk = new AccessProfileWorkflowRole.PK(profileId, role);
        if (!appWfRepo.existsById(pk)) {
            AccessProfileWorkflowRole a = new AccessProfileWorkflowRole();
            a.setAccessProfileId(profileId);
            a.setWorkflowRole(role);
            appWfRepo.save(a);
            ElectronicSignature esig = securityChangeSignatureService.record(actor, sig.signatureToken(),
                    SecurityChangeSignatureService.MEANING_ACCESS_PROFILE_CHANGE,
                    ENTITY_TYPE, profile.getId(), profile.getName(), auditReason(profile, sig.reason()),
                    null, "Assigned workflow role " + role);
            auditTrailService.logAs(actor, ENTITY_TYPE, profile.getName(), profile.getId(),
                    "ACCESS_PROFILE_WORKFLOW_ROLE_ASSIGNED", null, null,
                    withReason("Assigned workflow role " + role + " to " + safeCode(profile), sig.reason()),
                    List.of(new AuditTrailChangeResponse("Workflow Role", null, role)),
                    esig == null ? null : esig.getId());
            permissionEvaluationService.clearCache();
        }
    }

    public void removeWorkflowRole(UUID profileId, String role, SecurityChangeRequest sig) {
        UserAccount actor = requireAssign();
        sig = SecurityChangeRequest.orEmpty(sig);
        securityChangeSignatureService.requireValidToken(actor, sig.signatureToken());
        RoleDefinition profile = requireRole(profileId);
        appWfRepo.deleteByAccessProfileIdAndWorkflowRole(profileId, role);
        ElectronicSignature esig = securityChangeSignatureService.record(actor, sig.signatureToken(),
                SecurityChangeSignatureService.MEANING_ACCESS_PROFILE_CHANGE,
                ENTITY_TYPE, profile.getId(), profile.getName(), auditReason(profile, sig.reason()),
                "Workflow role " + role, null);
        auditTrailService.logAs(actor, ENTITY_TYPE, profile.getName(), profile.getId(),
                "ACCESS_PROFILE_WORKFLOW_ROLE_REMOVED", null, null,
                withReason("Removed workflow role " + role + " from " + safeCode(profile), sig.reason()),
                List.of(new AuditTrailChangeResponse("Workflow Role", role, null)),
                esig == null ? null : esig.getId());
        permissionEvaluationService.clearCache();
    }

    // ── Assigned Users ─────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<AccessProfileDetailResponse.AssignedUserSummary> getAssignedUsers(UUID profileId) {
        requireView();
        requireRole(profileId);
        return uapRepo.findByAccessProfileId(profileId).stream()
                .map(a -> toUserSummary(a.getUser(), a.getAssignedAt()))
                .filter(Objects::nonNull)
                .toList();
    }

    public void assignUser(UUID profileId, UUID userId, SecurityChangeRequest sig) {
        UserAccount actor = requireAssign();
        sig = SecurityChangeRequest.orEmpty(sig);
        securityChangeSignatureService.requireValidToken(actor, sig.signatureToken());
        RoleDefinition profile = requireRole(profileId);
        UserAccount targetUser = requireUser(userId);
        if (actor.getId() != null
                && actor.getId().equals(userId)
                && profileContainsCriticalPermissionSet(profileId)) {
            throw new IllegalStateException("Users cannot assign themselves an access profile containing critical permissions");
        }
        if (!uapRepo.existsByUserIdAndAccessProfileId(userId, profileId)) {
            requireNoBlockingSodConflict(targetUser, profileId);
            UserAccessProfile a = new UserAccessProfile();
            a.setUserId(userId);
            a.setAccessProfileId(profileId);
            a.setAssignedBy(actor);
            uapRepo.save(a);
            ElectronicSignature esig = securityChangeSignatureService.record(actor, sig.signatureToken(),
                    SecurityChangeSignatureService.MEANING_USER_ACCESS_CHANGE,
                    ENTITY_TYPE, profile.getId(), profile.getName(), sig.reason(),
                    null, "Assigned " + userLabel(targetUser));
            auditTrailService.logAs(actor, ENTITY_TYPE, profile.getName(), profile.getId(),
                    "ACCESS_PROFILE_USER_ASSIGNED", null, null,
                    withReason("Assigned " + userLabel(targetUser) + " to " + safeCode(profile), sig.reason()),
                    List.of(new AuditTrailChangeResponse("Assigned User", null, userLabel(targetUser))),
                    esig == null ? null : esig.getId());
            permissionEvaluationService.clearCache();
        }
    }

    public void removeUser(UUID profileId, UUID userId, SecurityChangeRequest sig) {
        UserAccount actor = requireAssign();
        sig = SecurityChangeRequest.orEmpty(sig);
        securityChangeSignatureService.requireValidToken(actor, sig.signatureToken());
        RoleDefinition profile = requireRole(profileId);
        UserAccount targetUser = requireUser(userId);
        // No more identity-specific "last super admin" guard: requireNotLastActiveAdmin already
        // enforces the general invariant (org must always keep at least one active user holding
        // ADMIN_GUARD_PERMISSION), which this profile's removal is checked against below.
        requireNotLastActiveAdmin(targetUser);
        uapRepo.deleteByUserIdAndAccessProfileId(userId, profileId);
        ElectronicSignature esig = securityChangeSignatureService.record(actor, sig.signatureToken(),
                SecurityChangeSignatureService.MEANING_USER_ACCESS_CHANGE,
                ENTITY_TYPE, profile.getId(), profile.getName(), sig.reason(),
                "Assigned " + userLabel(targetUser), null);
        auditTrailService.logAs(actor, ENTITY_TYPE, profile.getName(), profile.getId(),
                "ACCESS_PROFILE_USER_REMOVED", null, null,
                withReason("Removed " + userLabel(targetUser) + " from " + safeCode(profile), sig.reason()),
                List.of(new AuditTrailChangeResponse("Assigned User", userLabel(targetUser), null)),
                esig == null ? null : esig.getId());
        permissionEvaluationService.clearCache();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static final String ADMIN_GUARD_PERMISSION = "settings.user.edit";

    /**
     * GMP gap fix: mirrors {@code UserManagementService.checkLastActiveAdminGuard} at the Access
     * Profile layer. Without this, an admin lockout blocked at the user-suspend layer could be
     * trivially re-achieved by removing a user (or their profile's grant) of
     * {@value #ADMIN_GUARD_PERMISSION} via Access Profile editing instead -- confirmed exploit
     * path, not hypothetical.
     */
    private void requireNotLastActiveAdmin(UserAccount targetUser) {
        if (targetUser == null || targetUser.getStatus() != UserStatus.Active) return;
        if (!permissionEvaluationService.hasPermission(targetUser, ADMIN_GUARD_PERMISSION)) return;
        long otherActiveAdmins = userRepo.findAll().stream()
                .filter(u -> u.getStatus() == UserStatus.Active && !u.getId().equals(targetUser.getId()))
                .filter(u -> permissionEvaluationService.hasPermission(u, ADMIN_GUARD_PERMISSION))
                .count();
        if (otherActiveAdmins == 0) {
            throw new IllegalStateException(
                    "Cannot remove the last active administrator's access (" + ADMIN_GUARD_PERMISSION + ").");
        }
    }

    private boolean permissionSetGrants(UUID permissionSetId, String permissionCode) {
        return permissionSetItemRepo.findAllByPermissionSet_Id(permissionSetId).stream()
                .anyMatch(item -> item.getPermission() != null
                        && permissionCode.equalsIgnoreCase(item.getPermission().getCode()));
    }

    /** Before a profile-level permission-set change removes {@value #ADMIN_GUARD_PERMISSION} from
     * a profile, ensure no currently-Active assigned user of that profile would be left without
     * any active administrator in the org. */
    private void requireProfilePermissionSetRemovalKeepsAdminCoverage(UUID profileId, Set<UUID> removedSetIds) {
        boolean removesAdminGrant = removedSetIds.stream().anyMatch(id -> permissionSetGrants(id, ADMIN_GUARD_PERMISSION));
        if (!removesAdminGrant) return;
        for (UserAccessProfile uap : uapRepo.findByAccessProfileId(profileId)) {
            requireNotLastActiveAdmin(userRepo.findById(uap.getUserId()).orElse(null));
        }
    }

    /** Same invariant as {@link #requireProfilePermissionSetRemovalKeepsAdminCoverage}, applied to
     * a profile's individually-picked (managed-set) permission codes instead of shared sets. */
    private void requireManagedPermissionRemovalKeepsAdminCoverage(UUID profileId, PermissionSet existingManagedSet, List<String> requestedCodes) {
        if (existingManagedSet == null || !permissionSetGrants(existingManagedSet.getId(), ADMIN_GUARD_PERMISSION)) return;
        boolean requestedKeepsGrant = requestedCodes != null && requestedCodes.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .anyMatch(ADMIN_GUARD_PERMISSION::equalsIgnoreCase);
        if (requestedKeepsGrant) return;
        for (UserAccessProfile uap : uapRepo.findByAccessProfileId(profileId)) {
            requireNotLastActiveAdmin(userRepo.findById(uap.getUserId()).orElse(null));
        }
    }

    private RoleDefinition requireRole(UUID id) {
        return roleRepo.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Access profile not found: " + id));
    }

    private RoleDefinition requireRoleForConfigurationUpdate(UUID id) {
        return roleRepo.findByIdForUpdate(id)
                .orElseThrow(() -> new NoSuchElementException("Access profile not found: " + id));
    }

    private PermissionSet requirePermissionSet(UUID id) {
        return permSetRepo.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Permission set not found: " + id));
    }

    private UserAccount requireUser(UUID id) {
        return userRepo.findById(id)
                .orElseThrow(() -> new NoSuchElementException("User not found: " + id));
    }

    private void requireView() {
        UserAccount actor = currentUserService.requireCurrentUser();
        if (!canView(actor)) {
            // AccessDeniedException (-> 403) — a missing permission is not an authentication
            // failure. UnauthorizedException (-> 401) here previously caused the frontend's
            // 401 interceptor to treat this as an expired session, silently clear the user's
            // tokens and force a redirect to /login (surfacing as a jump back to the dashboard).
            throw new AccessDeniedException("Access profile view permission required");
        }
    }

    private UserAccount requireManage() {
        UserAccount actor = currentUserService.requireCurrentUser();
        if (!canManage(actor)) {
            throw new AccessDeniedException("Access profile manage permission required");
        }
        return actor;
    }

    private UserAccount requireAssign() {
        UserAccount actor = currentUserService.requireCurrentUser();
        if (!canAssign(actor)) {
            throw new AccessDeniedException("Access profile assignment permission required");
        }
        return actor;
    }

    private boolean canView(UserAccount actor) {
        return permissionEvaluationService.hasAnyPermission(actor, VIEW_PERMISSION, MANAGE_PERMISSION, ASSIGN_PERMISSION);
    }

    private boolean canManage(UserAccount actor) {
        return permissionEvaluationService.hasPermission(actor, MANAGE_PERMISSION);
    }

    private boolean canAssign(UserAccount actor) {
        return permissionEvaluationService.hasPermission(actor, ASSIGN_PERMISSION);
    }

    private void preventSelfGrantOfCriticalPermissionSets(UserAccount actor, UUID profileId, Collection<UUID> permissionSetIds) {
        if (actor == null || actor.getId() == null || permissionSetIds == null || permissionSetIds.isEmpty()) {
            return;
        }
        if (!uapRepo.existsByUserIdAndAccessProfileId(actor.getId(), profileId)) {
            return;
        }
        boolean criticalAdded = permissionSetIds.stream().anyMatch(this::permissionSetHasCriticalPermission);
        if (criticalAdded) {
            throw new IllegalStateException("Users cannot grant critical permissions to an access profile assigned to themselves");
        }
    }

    /**
     * Segregation of Duties gate: blocks assigning a profile to a user if the resulting total
     * permission set (existing access profiles + the one being assigned) would give the user
     * both permissions of any active BLOCK-severity SoD constraint. WARN-severity constraints
     * are advisory only (surfaced via the on-demand scan) and do not block the assignment.
     */
    private void requireNoBlockingSodConflict(UserAccount targetUser, UUID profileId) {
        Set<String> prospectiveCodes = new HashSet<>(effectivePermissionService.getEffectivePermissionCodes(targetUser));
        prospectiveCodes.addAll(getProfilePermissionCodes(profileId));
        if (prospectiveCodes.size() < 2) {
            return;
        }
        List<SodConstraint> violations = sodConstraintRepo.findActiveConstraintsInvolvingAny(prospectiveCodes).stream()
                .filter(c -> "BLOCK".equalsIgnoreCase(c.getSeverity())
                        && prospectiveCodes.contains(c.getPermissionCodeA())
                        && prospectiveCodes.contains(c.getPermissionCodeB()))
                .toList();
        if (!violations.isEmpty()) {
            String details = violations.stream()
                    .map(c -> c.getName() + " (" + c.getPermissionCodeA() + " + " + c.getPermissionCodeB() + ")")
                    .reduce((a, b) -> a + "; " + b)
                    .orElse("");
            throw new IllegalStateException(
                    "Cannot assign this access profile: it would give " + userLabel(targetUser)
                            + " a blocked Segregation of Duties conflict — " + details);
        }
    }

    /**
     * Reusable SoD gate for entry points which assign Access Profiles outside this service
     * (for example initial user creation). The rule is evaluated from immutable profile IDs
     * and permission codes, never from a mutable profile display name.
     */
    public void validateProfileAssignment(UserAccount targetUser, UUID profileId) {
        requireNoBlockingSodConflict(targetUser, profileId);
    }

    private Set<String> getProfilePermissionCodes(UUID profileId) {
        Set<String> codes = new HashSet<>();
        for (AccessProfilePermissionSet link : appSetRepo.findByAccessProfileId(profileId)) {
            UUID setId = link.getPermissionSetId();
            if (setId == null) continue;
            permissionSetItemRepo.findAllByPermissionSet_Id(setId).stream()
                    .map(PermissionSetItem::getPermission)
                    .filter(Objects::nonNull)
                    .map(Permission::getCode)
                    .filter(Objects::nonNull)
                    .forEach(codes::add);
        }
        return codes;
    }

    private boolean profileContainsCriticalPermissionSet(UUID profileId) {
        return appSetRepo.findByAccessProfileId(profileId).stream()
                .map(AccessProfilePermissionSet::getPermissionSetId)
                .filter(Objects::nonNull)
                .anyMatch(this::permissionSetHasCriticalPermission);
    }

    private boolean permissionSetHasCriticalPermission(UUID permissionSetId) {
        return permissionSetItemRepo.findAllByPermissionSet_Id(permissionSetId).stream()
                .map(PermissionSetItem::getPermission)
                .filter(Objects::nonNull)
                .anyMatch(this::isCriticalPermission);
    }

    private boolean isCriticalPermission(Permission permission) {
        String code = normalizeText(permission.getCode());
        String name = normalizeText(permission.getName());
        String group = normalizeText(permission.getGroupKey());
        String module = normalizeText(permission.getModuleKey());
        if (permission.isRequiresAudit()) {
            return true;
        }
        return containsAny(code, Set.of(
                "security.", "settings.role", "permission", "access_profile", "access_profiles",
                "workflow_authorization", "sod", "configuration", "esign", "electronic_signature",
                "reset_password", "force_logout"
        )) || containsAny(name, Set.of(
                "permission", "access profile", "workflow authorization", "segregation", "configuration",
                "electronic signature", "reset password", "force logout"
        )) || containsAny(group, Set.of(
                "access", "permission", "workflow", "configuration", "security"
        )) || containsAny(module, Set.of("security", "settings"));
    }

    private boolean containsAny(String value, Set<String> tokens) {
        if (value == null || value.isBlank()) return false;
        return tokens.stream().anyMatch(value::contains);
    }

    private String normalizeText(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private AccessProfileCapabilitiesResponse.ActionCapability capability(boolean allowed, String requiredPermission, String deniedReason) {
        return new AccessProfileCapabilitiesResponse.ActionCapability(
                allowed,
                allowed ? null : deniedReason,
                requiredPermission);
    }

    private void addChange(List<AuditTrailChangeResponse> changes, String field, Object oldValue, Object newValue) {
        String oldText = oldValue == null ? null : String.valueOf(oldValue);
        String newText = newValue == null ? null : String.valueOf(newValue);
        if (!Objects.equals(oldText, newText)) {
            changes.add(new AuditTrailChangeResponse(field, oldText, newText));
        }
    }

    private String safeCode(RoleDefinition role) {
        return role.getCode() == null ? role.getName() : role.getCode();
    }

    /** Does this profile currently grant {@code permissionCode} through any of its linked
     * permission sets, including its auto-managed ROLE_&lt;code&gt; set? */
    private boolean profileGrantsPermission(UUID profileId, String permissionCode) {
        return appSetRepo.findByAccessProfileId(profileId).stream()
                .map(AccessProfilePermissionSet::getPermissionSetId)
                .filter(Objects::nonNull)
                .anyMatch(setId -> permissionSetGrants(setId, permissionCode));
    }

    /**
     * Same admin-coverage invariant as {@link #requireProfilePermissionSetRemovalKeepsAdminCoverage},
     * applied when an action (deactivate, delete) would remove ALL of a profile's grants at once
     * rather than one specific permission set. Deliberately permission-based, not role-name-based:
     * it applies identically to every access profile, including the system super admin one -- there
     * is no hardcoded "cannot touch this profile" rule left, only "don't leave the org without an
     * administrator", which is what EU-GMP actually requires.
     */
    private void requireProfileRemovalKeepsAdminCoverage(UUID profileId) {
        if (!profileGrantsPermission(profileId, ADMIN_GUARD_PERMISSION)) return;
        for (UserAccessProfile uap : uapRepo.findByAccessProfileId(profileId)) {
            requireNotLastActiveAdmin(userRepo.findById(uap.getUserId()).orElse(null));
        }
    }

    /** Tags the audit-trail reason so a signed override of a protected system profile (any
     * profile but the super admin one) is easy to spot separately from routine custom-profile
     * edits when reviewing the Audit Trail. */
    private String auditReason(RoleDefinition role, String reason) {
        if (!role.isSystem()) return reason;
        String suffix = (reason == null || reason.isBlank()) ? "" : ": " + reason;
        return "[System Profile Override]" + suffix;
    }

    /**
     * The reason typed into the e-signature modal is otherwise only persisted on the
     * ElectronicSignature row (as the record()'s own reason param above) and never surfaced in the
     * Audit Trail's own comment/description -- fold it into the action's own comment so a reviewer
     * can actually see it.
     */
    private String withReason(String comment, String reason) {
        return org.springframework.util.StringUtils.hasText(reason) ? comment + " Reason: " + reason : comment;
    }

    private String safePermissionSet(PermissionSet permissionSet) {
        if (permissionSet == null) return "-";
        return permissionSet.getCode() == null ? permissionSet.getName() : permissionSet.getCode();
    }

    private String userLabel(UserAccount user) {
        if (user == null) return "-";
        String name = user.getFullName() != null ? user.getFullName() : user.getUsername();
        return name + " (" + user.getId() + ")";
    }

    private AccessProfileResponse toSummaryResponse(RoleDefinition role) {
        List<AccessProfileWorkflowRole> wfRoles = appWfRepo.findByAccessProfileId(role.getId());
        long psCount = appSetRepo.findByAccessProfileId(role.getId()).size();
        long userCount = uapRepo.countByAccessProfileId(role.getId());
        return new AccessProfileResponse(
                role.getId(), role.getCode(), role.getName(), role.getDescription(),
                role.getType(), role.isActive(), role.isSystem(),
                role.getBusinessUnitScope(), role.getDepartmentScope(),
                (int) psCount,
                wfRoles.size(),
                (int) userCount,
                wfRoles.stream().map(AccessProfileWorkflowRole::getWorkflowRole).toList(),
                role.getCreatedAt(), role.getUpdatedAt(),
                formatCreatedAtDisplay(role.getCreatedAt())
        );
    }

    private AccessProfileDetailResponse toDetailResponse(RoleDefinition role) {
        List<AccessProfilePermissionSet> assignments = appSetRepo.findByAccessProfileId(role.getId());
        List<AccessProfileDetailResponse.PermissionSetSummary> psList = assignments.stream()
                .map(a -> {
                    PermissionSet ps = permSetRepo.findById(a.getPermissionSetId()).orElse(null);
                    return ps != null ? toPermSetSummary(ps) : null;
                })
                .filter(Objects::nonNull)
                .toList();

        List<String> wfRoles = appWfRepo.findByAccessProfileId(role.getId()).stream()
                .map(AccessProfileWorkflowRole::getWorkflowRole).toList();

        List<AccessProfileDetailResponse.AssignedUserSummary> users = uapRepo.findByAccessProfileId(role.getId()).stream()
                .map(a -> toUserSummary(a.getUser(), a.getAssignedAt()))
                .filter(Objects::nonNull)
                .toList();

        return new AccessProfileDetailResponse(
                role.getId(), role.getCode(), role.getName(), role.getDescription(),
                role.getType(), role.isActive(), role.isSystem(),
                role.getBusinessUnitScope(), role.getDepartmentScope(),
                psList, wfRoles, users,
                role.getCreatedAt(), role.getUpdatedAt()
        );
    }

    private AccessProfileDetailResponse.PermissionSetSummary toPermSetSummary(PermissionSet ps) {
        if (ps == null) return null;
        int count = permSetRepo.countItemsById(ps.getId());
        return new AccessProfileDetailResponse.PermissionSetSummary(
                ps.getId(), ps.getCode(), ps.getName(), ps.getDescription(), count, ps.isSystem());
    }

    private AccessProfileDetailResponse.AssignedUserSummary toUserSummary(UserAccount user, java.time.Instant assignedAt) {
        if (user == null) return null;
        return new AccessProfileDetailResponse.AssignedUserSummary(
                user.getId(), user.getFullName(), user.getEmail(),
                user.getDepartment(),
                user.getStatus() != null ? user.getStatus().name() : null,
                assignedAt);
    }

    private String generateCode(String name) {
        if (name == null) return "PROFILE_" + UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        return name.toUpperCase().replaceAll("[^A-Z0-9]", "_").replaceAll("_+", "_").replaceAll("^_|_$", "");
    }

    private Specification<RoleDefinition> buildSpec(String search, String type, String status,
            String createdFrom, String createdTo, String updatedFrom, String updatedTo) {
        return (root, query, cb) -> {
            List<jakarta.persistence.criteria.Predicate> predicates = new ArrayList<>();
            if (search != null && !search.isBlank()) {
                String pattern = "%" + search.toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("name")), pattern),
                        cb.like(cb.lower(root.get("code")), pattern),
                        cb.like(cb.lower(root.get("description")), pattern)
                ));
            }
            if (type != null && !type.isBlank() && !"ALL".equalsIgnoreCase(type)) {
                predicates.add(cb.equal(root.get("type"), type.toUpperCase()));
            }
            if ("active".equalsIgnoreCase(status)) {
                predicates.add(cb.isTrue(root.get("active")));
            } else if ("inactive".equalsIgnoreCase(status)) {
                predicates.add(cb.isFalse(root.get("active")));
            }
            java.time.Instant fromInstant = parseDayStart(createdFrom);
            if (fromInstant != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), fromInstant));
            }
            java.time.Instant toInstant = parseDayEndExclusive(createdTo);
            if (toInstant != null) {
                predicates.add(cb.lessThan(root.get("createdAt"), toInstant));
            }
            java.time.Instant updatedFromInstant = parseDayStart(updatedFrom);
            if (updatedFromInstant != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("updatedAt"), updatedFromInstant));
            }
            java.time.Instant updatedToInstant = parseDayEndExclusive(updatedTo);
            if (updatedToInstant != null) {
                predicates.add(cb.lessThan(root.get("updatedAt"), updatedToInstant));
            }
            return cb.and(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };
    }

    private static final java.time.format.DateTimeFormatter DATE_QUERY_FORMAT =
            java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy");

    /** Parses a "dd/MM/yyyy" filter value into the start-of-day Instant (server local zone). */
    private java.time.Instant parseDayStart(String ddMMyyyy) {
        java.time.LocalDate date = parseDate(ddMMyyyy);
        return date == null ? null : date.atStartOfDay(java.time.ZoneId.systemDefault()).toInstant();
    }

    /** Parses a "dd/MM/yyyy" filter value into the exclusive start of the next day (server local zone). */
    private java.time.Instant parseDayEndExclusive(String ddMMyyyy) {
        java.time.LocalDate date = parseDate(ddMMyyyy);
        return date == null ? null : date.plusDays(1).atStartOfDay(java.time.ZoneId.systemDefault()).toInstant();
    }

    private java.time.LocalDate parseDate(String ddMMyyyy) {
        if (ddMMyyyy == null || ddMMyyyy.isBlank()) return null;
        try {
            return java.time.LocalDate.parse(ddMMyyyy.trim(), DATE_QUERY_FORMAT);
        } catch (java.time.format.DateTimeParseException ex) {
            return null;
        }
    }

    private static final java.time.format.DateTimeFormatter CREATED_DISPLAY_FORMAT =
            java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");

    /** Server-side formatting so the frontend only needs to display the string as-is. */
    private String formatCreatedAtDisplay(java.time.Instant instant) {
        if (instant == null) return null;
        return CREATED_DISPLAY_FORMAT.withZone(java.time.ZoneId.systemDefault()).format(instant);
    }
}
