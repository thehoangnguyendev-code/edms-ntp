package com.eqms;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Real-DB evidence for V461/V462: training.admin.view (V461) and its four sub-screen
 * permissions (V462 -- Training Properties, Requirement Templates, Create a Quiz, Curriculums)
 * exist and were backfilled so nobody who could already see Training Administration loses
 * visibility into any of its "coming soon" children.
 */
@SpringBootTest
class TrainingAdministrationPermissionTest {

    @Autowired private EntityManager entityManager;

    @Test
    void v461Migration_backfilledTrainingAdminViewPermission_toEveryPermissionSetHoldingTrainingModuleView() {
        List<UUID> trainingModuleViewSets = permissionSetsHolding("training.module.view");
        assertTrue(trainingModuleViewSets.size() > 0,
                "Expected at least one Permission Set holding training.module.view in this dev DB");

        List<UUID> trainingAdminViewSets = permissionSetsHolding("training.admin.view");

        assertTrue(trainingAdminViewSets.containsAll(trainingModuleViewSets),
                "Every Permission Set holding training.module.view must also hold "
                        + "training.admin.view after the V461 backfill -- missing: "
                        + trainingModuleViewSets.stream().filter(id -> !trainingAdminViewSets.contains(id)).toList());
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "training.admin.properties.view",
            "training.admin.requirement_templates.view",
            "training.admin.quiz.view",
            "training.admin.curriculums.view",
    })
    void v462Migration_backfilledSubScreenPermission_toEveryPermissionSetHoldingTrainingAdminView(String subScreenCode) {
        List<UUID> trainingAdminViewSets = permissionSetsHolding("training.admin.view");
        assertTrue(trainingAdminViewSets.size() > 0,
                "Expected at least one Permission Set holding training.admin.view in this dev DB");

        List<UUID> subScreenSets = permissionSetsHolding(subScreenCode);

        assertTrue(subScreenSets.containsAll(trainingAdminViewSets),
                "Every Permission Set holding training.admin.view must also hold " + subScreenCode
                        + " after the V462 backfill -- missing: "
                        + trainingAdminViewSets.stream().filter(id -> !subScreenSets.contains(id)).toList());
    }

    @SuppressWarnings("unchecked")
    private List<UUID> permissionSetsHolding(String permissionCode) {
        return entityManager.createNativeQuery("""
                SELECT DISTINCT psi.permission_set_id
                FROM permission_set_items psi
                JOIN permissions p ON p.id = psi.permission_id
                WHERE p.code = :code
                """)
                .setParameter("code", permissionCode)
                .getResultList();
    }
}
