package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.user.SodViolationResponse;
import com.eqms.entity.RoleDefinition;
import com.eqms.entity.SodConstraint;
import com.eqms.entity.UserAccessProfile;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.PermissionRepository;
import com.eqms.repository.RoleDefinitionRepository;
import com.eqms.repository.SodConstraintRepository;
import com.eqms.repository.UserAccessProfileRepository;
import com.eqms.repository.UserAccountRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

/**
 * Verifies the SoD "Violation Scanner" catches BOTH real-world violation shapes with a grounded
 * reason, not a guess: (1) a single Access Profile that alone grants both sides of a constraint,
 * and (2) no single profile does, but one user's combined active profiles together do (the
 * previously-missed case -- two individually-clean profiles assigned to the same person).
 */
@ExtendWith(MockitoExtension.class)
class SodConstraintServiceScanViolationsTest {

    @Mock SodConstraintRepository sodRepository;
    @Mock RoleDefinitionRepository roleRepository;
    @Mock EffectivePermissionService effectivePermissionService;
    @Mock PermissionRepository permissionRepository;
    @Mock CurrentUserService currentUserService;
    @Mock AuditTrailService auditTrailService;
    @Mock PermissionEvaluationService permissionEvaluationService;
    @Mock SecurityChangeSignatureService securityChangeSignatureService;
    @Mock UserAccountRepository userAccountRepository;
    @Mock UserAccessProfileRepository userAccessProfileRepository;
    @Mock com.eqms.repository.AccessProfilePermissionSetRepository accessProfilePermissionSetRepository;

    private SodConstraintService service;
    private UserAccount actor;

    private static final String PERM_A = "documents.revision.submit_review";
    private static final String PERM_B = "documents.revision.approve";

    @BeforeEach
    void setUp() {
        service = new SodConstraintService(sodRepository, roleRepository, effectivePermissionService,
                permissionRepository, currentUserService, auditTrailService, permissionEvaluationService,
                securityChangeSignatureService, userAccountRepository, userAccessProfileRepository,
                accessProfilePermissionSetRepository);

        actor = user("qa-reviewer");
        when(currentUserService.requireCurrentUser()).thenReturn(actor);
        lenient().when(permissionEvaluationService.hasAnyPermission(actor, "security.sod.view", "security.sod.manage"))
                .thenReturn(true);
    }

    @Test
    void singleProfileViolation_reportedAsProfileViolation_notCombination() {
        SodConstraint constraint = constraint(PERM_A, PERM_B);
        when(sodRepository.findAllByActiveOrderByNameAsc(true)).thenReturn(List.of(constraint));

        RoleDefinition dangerousProfile = profile("BOTH_SIDES");
        when(roleRepository.findAll()).thenReturn(List.of(dangerousProfile));
        when(effectivePermissionService.getEffectivePermissionCodes(dangerousProfile))
                .thenReturn(Set.of(PERM_A, PERM_B));

        UserAccount holder = user("holder");
        when(userAccountRepository.findAll()).thenReturn(List.of(holder));
        when(userAccessProfileRepository.findByUserId(holder.getId()))
                .thenReturn(List.of(assignment(holder.getId(), dangerousProfile.getId())));

        List<SodViolationResponse> result = service.scanViolations();

        assertThat(result).hasSize(1);
        assertThat(result.get(0).violatingAccessProfiles()).extracting("accessProfileCode").containsExactly("BOTH_SIDES");
        assertThat(result.get(0).violatingUserCombinations()).isEmpty();
    }

    @Test
    void combinationOnlyViolation_reportedAsUserCombination_notDuplicatedAsProfile() {
        SodConstraint constraint = constraint(PERM_A, PERM_B);
        when(sodRepository.findAllByActiveOrderByNameAsc(true)).thenReturn(List.of(constraint));

        RoleDefinition profileA = profile("GRANTS_A");
        RoleDefinition profileB = profile("GRANTS_B");
        when(roleRepository.findAll()).thenReturn(List.of(profileA, profileB));
        when(effectivePermissionService.getEffectivePermissionCodes(profileA)).thenReturn(Set.of(PERM_A));
        when(effectivePermissionService.getEffectivePermissionCodes(profileB)).thenReturn(Set.of(PERM_B));

        UserAccount holder = user("dual-role-holder");
        when(userAccountRepository.findAll()).thenReturn(List.of(holder));
        when(userAccessProfileRepository.findByUserId(holder.getId())).thenReturn(List.of(
                assignment(holder.getId(), profileA.getId()),
                assignment(holder.getId(), profileB.getId())));

        List<SodViolationResponse> result = service.scanViolations();

        assertThat(result).hasSize(1);
        assertThat(result.get(0).violatingAccessProfiles()).isEmpty();
        assertThat(result.get(0).violatingUserCombinations()).hasSize(1);
        SodViolationResponse.ViolatingUserCombination combo = result.get(0).violatingUserCombinations().get(0);
        assertThat(combo.username()).isEqualTo("dual-role-holder");
        assertThat(combo.profilesGrantingA()).extracting("accessProfileCode").containsExactly("GRANTS_A");
        assertThat(combo.profilesGrantingB()).extracting("accessProfileCode").containsExactly("GRANTS_B");
    }

    // ── checkAccessProfileCombination: Mức 2/3 impact-scoped remediation data ─────────────────

    @Test
    void checkAccessProfileCombination_reportsRemediationOptionsWithImpactCounts() {
        SodConstraint constraint = constraint(PERM_A, PERM_B);
        when(sodRepository.findAllByActiveOrderByNameAsc(true)).thenReturn(List.of(constraint));

        RoleDefinition profileA = profile("GRANTS_A");
        RoleDefinition profileB = profile("GRANTS_B");
        when(roleRepository.findAllById(List.of(profileA.getId(), profileB.getId())))
                .thenReturn(List.of(profileA, profileB));
        when(effectivePermissionService.getEffectivePermissionCodes(profileA)).thenReturn(Set.of(PERM_A));
        when(effectivePermissionService.getEffectivePermissionCodes(profileB)).thenReturn(Set.of(PERM_B));

        com.eqms.entity.PermissionSet setA = permissionSet("Reviewer Set");
        when(accessProfilePermissionSetRepository.findPermissionSetsInProfileGrantingPermission(profileA.getId(), PERM_A))
                .thenReturn(List.of(setA));
        when(accessProfilePermissionSetRepository.findPermissionSetsInProfileGrantingPermission(profileB.getId(), PERM_B))
                .thenReturn(List.of());

        when(userAccessProfileRepository.countByAccessProfileId(profileA.getId())).thenReturn(3L);
        when(userAccessProfileRepository.countByAccessProfileId(profileB.getId())).thenReturn(1L);
        when(accessProfilePermissionSetRepository.countByPermissionSetId(setA.getId())).thenReturn(2L);
        when(userAccessProfileRepository.countDistinctUsersAffectedByPermissionSet(setA.getId())).thenReturn(5L);

        List<com.eqms.dto.user.SodProfileCombinationViolationResponse> result =
                service.checkAccessProfileCombination(List.of(profileA.getId(), profileB.getId()));

        assertThat(result).hasSize(1);
        var violation = result.get(0);
        assertThat(violation.contributingProfilesA()).hasSize(1);
        var profileARef = violation.contributingProfilesA().get(0);
        assertThat(profileARef.usersHoldingThisProfile()).isEqualTo(3L);
        assertThat(profileARef.permissionSets()).hasSize(1);
        var remediationSet = profileARef.permissionSets().get(0);
        assertThat(remediationSet.permissionSetName()).isEqualTo("Reviewer Set");
        assertThat(remediationSet.profilesUsingThisSet()).isEqualTo(2L);
        assertThat(remediationSet.usersAffectedIfEditedAtSetLevel()).isEqualTo(5L);

        // GRANTS_B contributes no Permission Set for this permission in the mock -- Mức 1 (remove
        // the profile from just this user) is still the only option surfaced for it.
        assertThat(violation.contributingProfilesB()).hasSize(1);
        assertThat(violation.contributingProfilesB().get(0).permissionSets()).isEmpty();
    }

    @Test
    void noOverlap_noViolationReported() {
        SodConstraint constraint = constraint(PERM_A, PERM_B);
        when(sodRepository.findAllByActiveOrderByNameAsc(true)).thenReturn(List.of(constraint));

        RoleDefinition profileA = profile("GRANTS_A_ONLY");
        when(roleRepository.findAll()).thenReturn(List.of(profileA));
        when(effectivePermissionService.getEffectivePermissionCodes(profileA)).thenReturn(Set.of(PERM_A));

        UserAccount holder = user("single-profile-user");
        when(userAccountRepository.findAll()).thenReturn(List.of(holder));
        when(userAccessProfileRepository.findByUserId(holder.getId()))
                .thenReturn(List.of(assignment(holder.getId(), profileA.getId())));

        List<SodViolationResponse> result = service.scanViolations();

        assertThat(result).isEmpty();
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private SodConstraint constraint(String codeA, String codeB) {
        SodConstraint c = new SodConstraint();
        try {
            var field = SodConstraint.class.getDeclaredField("id");
            field.setAccessible(true);
            field.set(c, UUID.randomUUID());
        } catch (ReflectiveOperationException e) {
            throw new RuntimeException(e);
        }
        c.setName("Submitter vs Approver");
        c.setPermissionCodeA(codeA);
        c.setPermissionCodeB(codeB);
        c.setSeverity("BLOCK");
        c.setActive(true);
        return c;
    }

    private RoleDefinition profile(String code) {
        RoleDefinition role = new RoleDefinition();
        role.setId(UUID.randomUUID());
        role.setCode(code);
        role.setName(code);
        role.setActive(true);
        return role;
    }

    private com.eqms.entity.PermissionSet permissionSet(String name) {
        com.eqms.entity.PermissionSet set = new com.eqms.entity.PermissionSet();
        try {
            var field = com.eqms.entity.PermissionSet.class.getDeclaredField("id");
            field.setAccessible(true);
            field.set(set, UUID.randomUUID());
        } catch (ReflectiveOperationException e) {
            throw new RuntimeException(e);
        }
        set.setName(name);
        set.setCode(name.toUpperCase(java.util.Locale.ROOT).replace(" ", "_"));
        return set;
    }

    private UserAccessProfile assignment(UUID userId, UUID profileId) {
        UserAccessProfile a = new UserAccessProfile();
        a.setUserId(userId);
        a.setAccessProfileId(profileId);
        return a;
    }

    private UserAccount user(String username) {
        UserAccount u = new UserAccount();
        u.setId(UUID.randomUUID());
        u.setUsername(username);
        u.setEmail(username + "@example.test");
        u.setFullName(username);
        u.setStatus(UserStatus.Active);
        u.setPasswordHash("hash");
        return u;
    }
}
