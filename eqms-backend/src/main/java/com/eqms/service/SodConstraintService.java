package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import org.springframework.security.access.AccessDeniedException;
import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.dto.user.SodConstraintRequest;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.dto.user.SodConstraintResponse;
import com.eqms.dto.user.SodViolationResponse;
import com.eqms.entity.ElectronicSignature;
import com.eqms.entity.Permission;
import com.eqms.entity.RoleDefinition;
import com.eqms.entity.SodConstraint;
import com.eqms.entity.UserAccount;
import com.eqms.repository.PermissionRepository;
import com.eqms.repository.RoleDefinitionRepository;
import com.eqms.repository.SodConstraintRepository;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class SodConstraintService {
    private static final String VIEW_PERMISSION = "security.sod.view";
    private static final String MANAGE_PERMISSION = "security.sod.manage";

    private final SodConstraintRepository sodRepository;
    private final RoleDefinitionRepository roleRepository;
    private final EffectivePermissionService effectivePermissionService;
    private final PermissionRepository permissionRepository;
    private final CurrentUserService currentUserService;
    private final AuditTrailService auditTrailService;
    private final PermissionEvaluationService permissionEvaluationService;
    private final SecurityChangeSignatureService securityChangeSignatureService;
    private final com.eqms.repository.UserAccountRepository userAccountRepository;
    private final com.eqms.repository.UserAccessProfileRepository userAccessProfileRepository;
    private final com.eqms.repository.AccessProfilePermissionSetRepository accessProfilePermissionSetRepository;

    public SodConstraintService(
            SodConstraintRepository sodRepository,
            RoleDefinitionRepository roleRepository,
            EffectivePermissionService effectivePermissionService,
            PermissionRepository permissionRepository,
            CurrentUserService currentUserService,
            AuditTrailService auditTrailService,
            PermissionEvaluationService permissionEvaluationService,
            SecurityChangeSignatureService securityChangeSignatureService,
            com.eqms.repository.UserAccountRepository userAccountRepository,
            com.eqms.repository.UserAccessProfileRepository userAccessProfileRepository,
            com.eqms.repository.AccessProfilePermissionSetRepository accessProfilePermissionSetRepository) {
        this.sodRepository = sodRepository;
        this.roleRepository = roleRepository;
        this.effectivePermissionService = effectivePermissionService;
        this.permissionRepository = permissionRepository;
        this.currentUserService = currentUserService;
        this.auditTrailService = auditTrailService;
        this.permissionEvaluationService = permissionEvaluationService;
        this.securityChangeSignatureService = securityChangeSignatureService;
        this.userAccountRepository = userAccountRepository;
        this.userAccessProfileRepository = userAccessProfileRepository;
        this.accessProfilePermissionSetRepository = accessProfilePermissionSetRepository;
    }

    /** Server-side list: search, filters, sort and pagination resolved here. */
    @Transactional
    public com.eqms.dto.user.PageResponse<SodConstraintResponse> listPaged(
            int page, int limit, String search, String severity, String type,
            String status, String createdFrom, String createdTo, String updatedFrom, String updatedTo,
            String sortBy, String sortDir) {
        java.util.List<SodConstraintResponse> filtered = listAll().stream()
                .filter(c -> {
                    if (org.springframework.util.StringUtils.hasText(severity)
                            && !"ALL".equalsIgnoreCase(severity) && !c.severity().equalsIgnoreCase(severity)) return false;
                    if ("SYSTEM".equalsIgnoreCase(type) && !c.system()) return false;
                    if ("CUSTOM".equalsIgnoreCase(type) && c.system()) return false;
                    if ("ACTIVE".equalsIgnoreCase(status) && !c.active()) return false;
                    if ("INACTIVE".equalsIgnoreCase(status) && c.active()) return false;
                    if (!com.eqms.util.DateRangeFilter.matches(c.createdAt(), createdFrom, createdTo)) return false;
                    if (!com.eqms.util.DateRangeFilter.matches(c.updatedAt(), updatedFrom, updatedTo)) return false;
                    String q = search == null ? "" : search.trim().toLowerCase(java.util.Locale.ROOT);
                    if (q.isEmpty()) return true;
                    return (c.name() + " " + (c.description() == null ? "" : c.description()) + " "
                            + c.permissionCodeA() + " " + c.permissionCodeB()
                            + " " + (c.regulationRef() == null ? "" : c.regulationRef()))
                            .toLowerCase(java.util.Locale.ROOT).contains(q);
                })
                .collect(java.util.stream.Collectors.toList());
        java.util.Comparator<SodConstraintResponse> cmp = switch (sortBy == null ? "name" : sortBy) {
            case "severity" -> java.util.Comparator.comparing(SodConstraintResponse::severity);
            case "type" -> java.util.Comparator.comparing(c -> c.system() ? 0 : 1);
            case "permissionCodeA" -> java.util.Comparator.comparing(SodConstraintResponse::permissionCodeA);
            case "permissionCodeB" -> java.util.Comparator.comparing(SodConstraintResponse::permissionCodeB);
            case "createdAt" -> java.util.Comparator.comparing(SodConstraintResponse::createdAt);
            case "updatedAt" -> java.util.Comparator.comparing(SodConstraintResponse::updatedAt);
            default -> java.util.Comparator.comparing(SodConstraintResponse::name, String.CASE_INSENSITIVE_ORDER);
        };
        if ("desc".equalsIgnoreCase(sortDir)) cmp = cmp.reversed();
        filtered.sort(cmp);
        return com.eqms.util.PagedList.paginate(filtered, page, limit);
    }

    /** Dropdown values for the SoD list filters. */
    public java.util.Map<String, java.util.List<String>> getListOptions() {
        return java.util.Map.of(
                "severities", java.util.List.of("WARN", "BLOCK"),
                "types", java.util.List.of("SYSTEM", "CUSTOM"),
                "statuses", java.util.List.of("ACTIVE", "INACTIVE"));
    }

    public List<SodConstraintResponse> listAll() {
        requireView();
        return sodRepository.findAllByOrderByNameAsc()
                .stream().map(this::toResponse).toList();
    }

    public SodConstraintResponse getById(UUID id) {
        requireView();
        return toResponse(require(id));
    }

    /**
     * Check all active Access Profiles for SoD violations against all active constraints -- and,
     * separately, every active user whose *combined* active profiles create a violation that no
     * single one of their profiles has alone (the far more common real-world SoD gap: two clean
     * profiles individually, both assigned to the same person). Grounded in each user's actual
     * assigned profiles and each profile's actual effective permissions -- never inferred.
     */
    @Transactional
    public List<SodViolationResponse> scanViolations() {
        requireView();
        List<SodConstraint> constraints = sodRepository.findAllByActiveOrderByNameAsc(true);
        List<RoleDefinition> accessProfiles = roleRepository.findAll().stream()
                .filter(RoleDefinition::isActive).toList();

        // Build a map: Access Profile ID → effective permission codes.
        Map<UUID, Set<String>> profilePermissionCodes = new HashMap<>();
        for (RoleDefinition profile : accessProfiles) {
            Set<String> codes = effectivePermissionService.getEffectivePermissionCodes(profile);
            profilePermissionCodes.put(profile.getId(), codes);
        }
        Map<UUID, RoleDefinition> profileById = accessProfiles.stream()
                .collect(Collectors.toMap(RoleDefinition::getId, p -> p));

        // Every active user's set of DISTINCT active profile IDs -- only users with 2+ are
        // candidates for a combination-only violation (a single profile alone is already covered
        // by the per-profile scan below).
        List<UserAccount> activeUsers = userAccountRepository.findAll().stream()
                .filter(u -> u.getStatus() == com.eqms.entity.UserStatus.Active)
                .toList();
        Map<UUID, UserAccount> userById = new HashMap<>();
        Map<UUID, List<UUID>> userActiveProfileIds = new HashMap<>();
        for (UserAccount user : activeUsers) {
            List<UUID> ids = userAccessProfileRepository.findByUserId(user.getId()).stream()
                    .map(com.eqms.entity.UserAccessProfile::getAccessProfileId)
                    .filter(profileById::containsKey)
                    .distinct()
                    .toList();
            if (ids.size() > 1) {
                userById.put(user.getId(), user);
                userActiveProfileIds.put(user.getId(), ids);
            }
        }

        List<SodViolationResponse> violations = new ArrayList<>();
        for (SodConstraint c : constraints) {
            List<SodViolationResponse.ViolatingAccessProfile> violatingProfiles = new ArrayList<>();
            Set<UUID> singleProfileViolatorIds = new HashSet<>();
            for (RoleDefinition profile : accessProfiles) {
                Set<String> codes = profilePermissionCodes.getOrDefault(profile.getId(), Set.of());
                if (codes.contains(c.getPermissionCodeA()) && codes.contains(c.getPermissionCodeB())) {
                    violatingProfiles.add(new SodViolationResponse.ViolatingAccessProfile(
                            profile.getId(), profile.getName(), profile.getCode()));
                    singleProfileViolatorIds.add(profile.getId());
                }
            }

            List<SodViolationResponse.ViolatingUserCombination> combinationViolations = new ArrayList<>();
            for (Map.Entry<UUID, List<UUID>> entry : userActiveProfileIds.entrySet()) {
                List<UUID> profileIds = entry.getValue();
                // Already surfaced above via the profile itself -- fixing that profile fixes it
                // for every holder, this user included; don't report it again as a "combination".
                if (profileIds.stream().anyMatch(singleProfileViolatorIds::contains)) continue;

                List<SodViolationResponse.ProfileRef> grantingA = new ArrayList<>();
                List<SodViolationResponse.ProfileRef> grantingB = new ArrayList<>();
                for (UUID profileId : profileIds) {
                    Set<String> codes = profilePermissionCodes.getOrDefault(profileId, Set.of());
                    RoleDefinition profile = profileById.get(profileId);
                    if (profile == null) continue;
                    if (codes.contains(c.getPermissionCodeA())) {
                        grantingA.add(new SodViolationResponse.ProfileRef(profile.getId(), profile.getName(), profile.getCode()));
                    }
                    if (codes.contains(c.getPermissionCodeB())) {
                        grantingB.add(new SodViolationResponse.ProfileRef(profile.getId(), profile.getName(), profile.getCode()));
                    }
                }
                if (!grantingA.isEmpty() && !grantingB.isEmpty()) {
                    UserAccount user = userById.get(entry.getKey());
                    combinationViolations.add(new SodViolationResponse.ViolatingUserCombination(
                            user.getId(), user.getUsername(), user.getFullName(), grantingA, grantingB));
                }
            }

            if (!violatingProfiles.isEmpty() || !combinationViolations.isEmpty()) {
                violations.add(new SodViolationResponse(
                        c.getId(), c.getName(), c.getSeverity(),
                        c.getPermissionCodeA(), c.getPermissionCodeB(),
                        c.getRegulationRef(), violatingProfiles, combinationViolations));
            }
        }
        return violations;
    }

    /**
     * Check a proposed SET of Access Profiles (e.g. the profiles about to be assigned to a user)
     * for SoD violations that only emerge from the combination — including the case where a
     * single profile in the set already contains both sides of a pair. Unlike {@link #checkPermissions},
     * this reports which profile(s) contribute each side of the conflict.
     */
    @Transactional
    public List<com.eqms.dto.user.SodProfileCombinationViolationResponse> checkAccessProfileCombination(List<UUID> accessProfileIds) {
        requireView();
        if (accessProfileIds == null || accessProfileIds.isEmpty()) return List.of();
        List<RoleDefinition> profiles = roleRepository.findAllById(accessProfileIds);
        List<SodConstraint> constraints = sodRepository.findAllByActiveOrderByNameAsc(true);
        Map<String, String> permNames = permissionRepository.findAll().stream()
                .collect(Collectors.toMap(Permission::getCode, Permission::getName, (a, b) -> a));

        Map<UUID, Set<String>> profilePermissionCodes = new HashMap<>();
        for (RoleDefinition profile : profiles) {
            profilePermissionCodes.put(profile.getId(), effectivePermissionService.getEffectivePermissionCodes(profile));
        }

        List<com.eqms.dto.user.SodProfileCombinationViolationResponse> violations = new ArrayList<>();
        for (SodConstraint c : constraints) {
            List<com.eqms.dto.user.SodProfileCombinationViolationResponse.ProfileRef> contributingA = new ArrayList<>();
            List<com.eqms.dto.user.SodProfileCombinationViolationResponse.ProfileRef> contributingB = new ArrayList<>();
            for (RoleDefinition profile : profiles) {
                Set<String> codes = profilePermissionCodes.getOrDefault(profile.getId(), Set.of());
                if (codes.contains(c.getPermissionCodeA())) {
                    contributingA.add(buildProfileRef(profile, c.getPermissionCodeA()));
                }
                if (codes.contains(c.getPermissionCodeB())) {
                    contributingB.add(buildProfileRef(profile, c.getPermissionCodeB()));
                }
            }
            if (!contributingA.isEmpty() && !contributingB.isEmpty()) {
                violations.add(new com.eqms.dto.user.SodProfileCombinationViolationResponse(
                        c.getId(), c.getName(), c.getSeverity(),
                        c.getPermissionCodeA(), permNames.getOrDefault(c.getPermissionCodeA(), c.getPermissionCodeA()),
                        c.getPermissionCodeB(), permNames.getOrDefault(c.getPermissionCodeB(), c.getPermissionCodeB()),
                        c.getRegulationRef(), contributingA, contributingB));
            }
        }
        return violations;
    }

    /** Builds one contributing-profile entry together with its impact-scoped remediation options
     *  (Mức 2/3 -- see the DTO's javadoc; Mức 1, removing the whole profile from just this user,
     *  needs no server data and is rendered by the FE on its own). */
    private com.eqms.dto.user.SodProfileCombinationViolationResponse.ProfileRef buildProfileRef(
            RoleDefinition profile, String permissionCode) {
        long usersHoldingThisProfile = userAccessProfileRepository.countByAccessProfileId(profile.getId());
        List<com.eqms.dto.user.SodProfileCombinationViolationResponse.RemediationPermissionSet> sets =
                accessProfilePermissionSetRepository
                        .findPermissionSetsInProfileGrantingPermission(profile.getId(), permissionCode)
                        .stream()
                        .map(set -> new com.eqms.dto.user.SodProfileCombinationViolationResponse.RemediationPermissionSet(
                                set.getId(),
                                set.getName(),
                                accessProfilePermissionSetRepository.countByPermissionSetId(set.getId()),
                                userAccessProfileRepository.countDistinctUsersAffectedByPermissionSet(set.getId())
                        ))
                        .toList();
        return new com.eqms.dto.user.SodProfileCombinationViolationResponse.ProfileRef(
                profile.getId(), profile.getName(), profile.getCode(), usersHoldingThisProfile, sets);
    }

    /** Check a specific set of permission codes against active constraints (used before saving a role). */
    @Transactional
    public List<SodConstraintResponse> checkPermissions(List<String> permissionCodes) {
        requireView();
        if (permissionCodes == null || permissionCodes.isEmpty()) return List.of();
        List<SodConstraint> constraints = sodRepository.findActiveConstraintsInvolvingAny(permissionCodes);
        Set<String> codeSet = new HashSet<>(permissionCodes);
        return constraints.stream()
                .filter(c -> codeSet.contains(c.getPermissionCodeA()) && codeSet.contains(c.getPermissionCodeB()))
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public SodConstraintResponse create(SodConstraintRequest request) {
        requireManage();
        UserAccount actor = currentUserService.requireCurrentUser();
        securityChangeSignatureService.requireValidToken(actor, request.signatureToken());

        sodRepository.findConflict(request.permissionCodeA(), request.permissionCodeB()).ifPresent(existing -> {
            throw new IllegalArgumentException("A SoD constraint already exists for this permission pair");
        });

        SodConstraint c = new SodConstraint();
        applyRequest(c, request);
        c.setCreatedBy(actor);
        c.setUpdatedBy(actor);
        sodRepository.save(c);

        ElectronicSignature esig = securityChangeSignatureService.record(actor, request.signatureToken(),
                SecurityChangeSignatureService.MEANING_SOD_RULE_CHANGE,
                "SOD_CONSTRAINT", c.getId(), c.getName(), request.reason(),
                null, c.getPermissionCodeA() + " ⊕ " + c.getPermissionCodeB());

        auditTrailService.logAs(actor, "SOD_CONSTRAINT", c.getName(), c.getId(),
                "CREATED", null, "Active",
                withReason("Created SoD constraint: " + c.getPermissionCodeA() + " ⊕ " + c.getPermissionCodeB(), request.reason()),
                List.of(), esig == null ? null : esig.getId());
        return toResponse(c);
    }

    @Transactional
    public SodConstraintResponse update(UUID id, SodConstraintRequest request) {
        requireManage();
        UserAccount actor = currentUserService.requireCurrentUser();
        securityChangeSignatureService.requireValidToken(actor, request.signatureToken());
        SodConstraint c = require(id);

        if (c.isSystem()) {
            throw new IllegalArgumentException("System SoD constraints cannot be modified");
        }

        sodRepository.findConflict(request.permissionCodeA(), request.permissionCodeB()).ifPresent(existing -> {
            if (!existing.getId().equals(id))
                throw new IllegalArgumentException("A SoD constraint already exists for this permission pair");
        });

        String oldStatus = c.isActive() ? "Active" : "Inactive";
        String oldName = c.getName();
        String oldDescription = c.getDescription();
        String oldPermissionCodeA = c.getPermissionCodeA();
        String oldPermissionCodeB = c.getPermissionCodeB();
        String oldSeverity = c.getSeverity();
        String oldRegulationRef = c.getRegulationRef();

        applyRequest(c, request);
        c.setUpdatedBy(actor);
        sodRepository.save(c);

        // Previously recorded only the Active/Inactive status with an empty changes list -- an
        // inspector could see THAT a SoD constraint was updated but never WHAT changed (which
        // permission pair, severity, regulation reference...).
        List<AuditTrailChangeResponse> changes = new ArrayList<>();
        addSodChange(changes, "Name", oldName, c.getName());
        addSodChange(changes, "Description", oldDescription, c.getDescription());
        addSodChange(changes, "Permission A", oldPermissionCodeA, c.getPermissionCodeA());
        addSodChange(changes, "Permission B", oldPermissionCodeB, c.getPermissionCodeB());
        addSodChange(changes, "Severity", oldSeverity, c.getSeverity());
        addSodChange(changes, "Regulation Reference", oldRegulationRef, c.getRegulationRef());
        addSodChange(changes, "Status", oldStatus, c.isActive() ? "Active" : "Inactive");

        ElectronicSignature esig = securityChangeSignatureService.record(actor, request.signatureToken(),
                SecurityChangeSignatureService.MEANING_SOD_RULE_CHANGE,
                "SOD_CONSTRAINT", c.getId(), c.getName(), request.reason(),
                oldStatus, c.isActive() ? "Active" : "Inactive");

        auditTrailService.logAs(actor, "SOD_CONSTRAINT", c.getName(), c.getId(),
                "UPDATED", oldStatus, c.isActive() ? "Active" : "Inactive",
                withReason("Updated SoD constraint", request.reason()),
                changes, esig == null ? null : esig.getId());
        return toResponse(c);
    }

    private void addSodChange(List<AuditTrailChangeResponse> changes, String field, String oldValue, String newValue) {
        if (!Objects.equals(oldValue, newValue)) {
            changes.add(new AuditTrailChangeResponse(field, oldValue, newValue));
        }
    }

    @Transactional
    public void delete(UUID id, com.eqms.dto.settings.SecurityChangeRequest sig) {
        requireManage();
        UserAccount actor = currentUserService.requireCurrentUser();
        sig = com.eqms.dto.settings.SecurityChangeRequest.orEmpty(sig);
        securityChangeSignatureService.requireValidToken(actor, sig.signatureToken());
        SodConstraint c = require(id);
        if (c.isSystem()) {
            throw new IllegalArgumentException("System SoD constraints cannot be deleted");
        }
        ElectronicSignature esig = securityChangeSignatureService.record(actor, sig.signatureToken(),
                SecurityChangeSignatureService.MEANING_SOD_RULE_CHANGE,
                "SOD_CONSTRAINT", id, c.getName(), sig.reason(),
                c.getPermissionCodeA() + " ⊕ " + c.getPermissionCodeB(), null);
        auditTrailService.logAs(actor, "SOD_CONSTRAINT", c.getName(), c.getId(),
                "DELETED", c.isActive() ? "Active" : "Inactive", null,
                withReason("Deleted SoD constraint", sig.reason()),
                List.of(), esig == null ? null : esig.getId());
        sodRepository.delete(c);
    }

    /**
     * The reason typed into the e-signature modal is otherwise only persisted on the
     * ElectronicSignature row and never surfaced in the Audit Trail's own comment/description --
     * fold it into the action's own comment so a reviewer can actually see it.
     */
    private String withReason(String comment, String reason) {
        return org.springframework.util.StringUtils.hasText(reason) ? comment + " Reason: " + reason : comment;
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private void applyRequest(SodConstraint c, SodConstraintRequest req) {
        validatePermissionPair(req.permissionCodeA(), req.permissionCodeB());
        c.setName(req.name());
        c.setDescription(req.description());
        c.setPermissionCodeA(req.permissionCodeA());
        c.setPermissionCodeB(req.permissionCodeB());
        c.setSeverity(req.severity() != null ? req.severity() : "WARN");
        c.setRegulationRef(req.regulationRef());
        c.setActive(req.active());
    }

    private void validatePermissionPair(String permissionCodeA, String permissionCodeB) {
        if (!org.springframework.util.StringUtils.hasText(permissionCodeA)
                || !org.springframework.util.StringUtils.hasText(permissionCodeB)) {
            throw new IllegalArgumentException("Both SoD permission codes are required");
        }
        if (permissionCodeA.trim().equalsIgnoreCase(permissionCodeB.trim())) {
            throw new IllegalArgumentException("An SoD constraint must contain two different permissions");
        }
        if (permissionRepository.findByCode(permissionCodeA.trim()).isEmpty()
                || permissionRepository.findByCode(permissionCodeB.trim()).isEmpty()) {
            throw new IllegalArgumentException("SoD constraints can only reference permissions in the catalog");
        }
    }

    private SodConstraint require(UUID id) {
        return sodRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("SoD constraint not found: " + id));
    }

    private void requireView() {
        UserAccount u = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasAnyPermission(u, VIEW_PERMISSION, MANAGE_PERMISSION)) {
            throw new AccessDeniedException("SoD view permission required");
        }
    }

    private void requireManage() {
        UserAccount u = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasPermission(u, MANAGE_PERMISSION)) {
            throw new AccessDeniedException("SoD management permission required");
        }
    }

    private SodConstraintResponse toResponse(SodConstraint c) {
        Map<String, String> permNames = permissionRepository.findAll().stream()
                .collect(Collectors.toMap(Permission::getCode, Permission::getName, (a, b) -> a));
        return new SodConstraintResponse(
                c.getId(), c.getName(), c.getDescription(),
                c.getPermissionCodeA(), c.getPermissionCodeB(),
                permNames.getOrDefault(c.getPermissionCodeA(), c.getPermissionCodeA()),
                permNames.getOrDefault(c.getPermissionCodeB(), c.getPermissionCodeB()),
                c.getSeverity(), c.getRegulationRef(),
                c.isActive(), c.isSystem(),
                c.getCreatedAt(), c.getUpdatedAt());
    }
}
