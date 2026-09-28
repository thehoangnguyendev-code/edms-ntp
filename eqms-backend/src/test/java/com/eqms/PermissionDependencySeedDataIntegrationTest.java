package com.eqms;

import com.eqms.entity.PermissionDependency;
import com.eqms.repository.PermissionDependencyRepository;
import com.eqms.repository.PermissionRepository;
import com.eqms.service.PermissionDependencyGraphService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

/**
 * Validates the actual V403 seed data against the live database -- not a synthetic graph (see
 * {@code PermissionDependencyGraphServiceTest} for algorithm-level tests). Confirms:
 *   - the graph is acyclic (PERMISSION_DEPENDENCY_MATRIX_REVIEW_DRAFT.md Section 4 requirement),
 *   - every permission_code/depends_on_code referenced actually exists in the live permissions
 *     catalog (the FK constraint already guarantees this at the DB level; this is a
 *     defense-in-depth application-level check),
 *   - the two IMPLIES rules pending Decision Log (DOC-08/DOC-09) were NOT seeded, so a future
 *     accidental migration can't silently promote them without the required sign-off.
 */
@SpringBootTest
class PermissionDependencySeedDataIntegrationTest {

    @Autowired
    private PermissionDependencyRepository permissionDependencyRepository;
    @Autowired
    private PermissionRepository permissionRepository;
    @Autowired
    private PermissionDependencyGraphService graphService;

    @Test
    void seedData_isAcyclic() {
        List<String> cycle = graphService.findFirstCycle();
        if (!cycle.isEmpty()) {
            fail("Cycle detected in permission_dependencies: " + String.join(" -> ", cycle));
        }
    }

    @Test
    void seedData_everyReferencedPermissionCodeExistsInCatalog() {
        Set<String> catalogCodes = permissionRepository.findAll().stream()
                .map(com.eqms.entity.Permission::getCode)
                .collect(java.util.stream.Collectors.toSet());

        for (PermissionDependency row : permissionDependencyRepository.findAll()) {
            assertTrue(catalogCodes.contains(row.getPermissionCode()),
                    "permission_code not in catalog: " + row.getPermissionCode());
            if (row.getDependsOnCode() != null) {
                assertTrue(catalogCodes.contains(row.getDependsOnCode()),
                        "depends_on_code not in catalog: " + row.getDependsOnCode());
            }
        }
    }

    @Test
    void seedData_doesNotIncludePendingDecisionLogImplies() {
        boolean reviewImpliesRejectReview = permissionDependencyRepository
                .findAllByPermissionCode("documents.revision.review").stream()
                .anyMatch(d -> "IMPLIES".equals(d.getRelationType())
                        && "documents.revision.reject_review".equals(d.getDependsOnCode()));
        boolean approveImpliesRejectApproval = permissionDependencyRepository
                .findAllByPermissionCode("documents.revision.approve").stream()
                .anyMatch(d -> "IMPLIES".equals(d.getRelationType())
                        && "documents.revision.reject_approval".equals(d.getDependsOnCode()));

        assertEquals(false, reviewImpliesRejectReview,
                "DOC-08 IMPLIES requires a Decision Log before being seeded");
        assertEquals(false, approveImpliesRejectApproval,
                "DOC-09 IMPLIES requires a Decision Log before being seeded");
    }

    @Test
    void seedData_containsExpectedRowCount() {
        // 31 rows per PERMISSION_DEPENDENCY_MATRIX_REVIEW_DRAFT.md's Phase 1 filtering decision
        // (2026-08-26): plain "ĐỀ XUẤT" rows only, excluding any row hedged with "cần trace"/
        // "route/API trace" (e.g. SEC-02..13) and excluding the two pending-Decision-Log IMPLIES
        // edges. Update this count (and this comment) only alongside a deliberate change to the
        // draft's Phase 1 scope -- it exists to catch an accidental extra/missing seed row.
        // +8 rows (V429__add_functional_settings_permission_dependencies.sql, SET-10..SET-17):
        // each new granular Application Settings *.manage permission (Business Units, Departments,
        // Positions, Storage Locations, Retention Policies, Countries, Education Degree Levels,
        // Education Schools -- split out of the old catch-all settings.dictionary.* pair) REQUIRES
        // its own matching *.view permission.
        // +1 row (V434__add_email_template_view_permission.sql, SET-18): settings.email_template.manage
        // was a seeded-but-unenforced legacy code (EmailTemplateController actually checked
        // settings.configuration.* only); it's now wired up as a genuinely independent, delegable
        // permission and REQUIRES its own new settings.email_template.view counterpart.
        // +2 rows (V435__add_reports_permission_dependencies_and_schedule_scope_fix.sql, RPT-01/02):
        // reports.definition.manage and reports.schedule.manage were seeded (V359) without a REQUIRES
        // row for their .view counterpart -- found during the system-wide authorization audit.
        assertEquals(42, permissionDependencyRepository.findAll().size());
    }
}
