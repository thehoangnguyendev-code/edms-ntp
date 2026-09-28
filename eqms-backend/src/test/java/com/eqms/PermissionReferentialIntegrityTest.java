package com.eqms;

import com.eqms.entity.LifecycleStatePolicy;
import com.eqms.entity.SodConstraint;
import com.eqms.entity.WorkflowActionPolicy;
import com.eqms.repository.LifecycleStatePolicyRepository;
import com.eqms.repository.PermissionRepository;
import com.eqms.repository.SodConstraintRepository;
import com.eqms.repository.WorkflowActionPolicyRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.util.StringUtils;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.fail;

/**
 * Permission catalog forensic review (2026-08-24): the `permissions` table has no FK from the
 * free-text permission-code columns of sod_constraints/workflow_action_policies/
 * lifecycle_state_policies, so a dangling reference (a seeded row pointing at a permission code
 * that was never seeded, renamed, or later removed) is not caught by the schema itself. This
 * happened at least twice in this codebase's history (documents.revision.submit in a V170 SoD
 * constraint; documents.controlled_copy.print silently removed from the catalog while
 * V342's workflow_action_policies row still required it, blocking PRINT_COPY for everyone until
 * V386 restored it). This test closes that gap for the three tables that have a JPA mapping
 * (report_definitions.access_policy has no entity and is intentionally out of scope here).
 */
@SpringBootTest
class PermissionReferentialIntegrityTest {

    @Autowired private PermissionRepository permissionRepository;
    @Autowired private SodConstraintRepository sodConstraintRepository;
    @Autowired private WorkflowActionPolicyRepository workflowActionPolicyRepository;
    @Autowired private LifecycleStatePolicyRepository lifecycleStatePolicyRepository;

    @Test
    void sodConstraints_referenceOnlyExistingPermissionCodes() {
        Set<String> validCodes = allPermissionCodes();
        List<String> dangling = sodConstraintRepository.findAll().stream()
                .flatMap(c -> java.util.stream.Stream.of(c.getPermissionCodeA(), c.getPermissionCodeB()))
                .filter(StringUtils::hasText)
                .filter(code -> !validCodes.contains(code))
                .distinct()
                .collect(Collectors.toList());
        if (!dangling.isEmpty()) {
            fail("sod_constraints references permission code(s) that do not exist in the permissions "
                    + "catalog (never seeded, renamed, or removed without updating this table): " + dangling);
        }
    }

    @Test
    void workflowActionPolicies_referenceOnlyExistingPermissionCodes() {
        Set<String> validCodes = allPermissionCodes();
        List<String> dangling = workflowActionPolicyRepository.findAll().stream()
                .map(WorkflowActionPolicy::getRequiredPermissionCode)
                .filter(StringUtils::hasText)
                .filter(code -> !validCodes.contains(code))
                .distinct()
                .collect(Collectors.toList());
        if (!dangling.isEmpty()) {
            fail("workflow_action_policies references permission code(s) that do not exist in the "
                    + "permissions catalog: " + dangling);
        }
    }

    @Test
    void lifecycleStatePolicies_referenceOnlyExistingPermissionCodes() {
        Set<String> validCodes = allPermissionCodes();
        List<String> dangling = lifecycleStatePolicyRepository.findAll().stream()
                .map(LifecycleStatePolicy::getRequiredPermissionCode)
                .filter(StringUtils::hasText)
                .filter(code -> !validCodes.contains(code))
                .distinct()
                .collect(Collectors.toList());
        if (!dangling.isEmpty()) {
            fail("lifecycle_state_policies references permission code(s) that do not exist in the "
                    + "permissions catalog: " + dangling);
        }
    }

    private Set<String> allPermissionCodes() {
        return new HashSet<>(permissionRepository.findAll().stream()
                .map(p -> p.getCode())
                .collect(Collectors.toSet()));
    }
}
