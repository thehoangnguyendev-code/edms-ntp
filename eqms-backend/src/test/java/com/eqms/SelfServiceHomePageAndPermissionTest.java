package com.eqms;

import com.eqms.dto.user.UpdateUserRequest;
import com.eqms.dto.user.UserManagementResponse;
import com.eqms.entity.UserAccount;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.UserManagementService;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Real-DB evidence for the Self-Service menu move's two backend changes:
 * (1) V459 backfilled self_service.knowledge.view to every Permission Set that already held
 *     documents.module.view, so Knowledge visibility didn't silently regress when it stopped
 *     riding on the broader Documents permission.
 * (2) The per-user Home Page preference (UserAccount.homePage / CreateUserRequest.homePage /
 *     UpdateUserRequest.homePage / UserManagementResponse.homePage) round-trips through
 *     update -> get correctly, and rejects an invalid value.
 */
@SpringBootTest
class SelfServiceHomePageAndPermissionTest {

    @Autowired private EntityManager entityManager;
    @Autowired private UserManagementService userManagementService;
    @Autowired private UserAccountRepository userAccountRepository;

    private UserAccount actor;
    private String originalHomePage;

    @BeforeEach
    void setUp() {
        actor = userAccountRepository.findAll().stream()
                .filter(u -> "admin".equals(u.getUsername()))
                .findFirst().orElseThrow();
        originalHomePage = actor.getHomePage();
        runAsActor(actor);
    }

    @AfterEach
    void cleanup() {
        actor.setHomePage(originalHomePage == null ? "DASHBOARD" : originalHomePage);
        userAccountRepository.save(actor);
        SecurityContextHolder.clearContext();
    }

    private void runAsActor(UserAccount who) {
        var principal = new com.eqms.auth.AuthenticatedUser(
                who.getId(), UUID.randomUUID(), who.getUsername(),
                who.getRoleName() != null ? who.getRoleName() : "USER", java.util.Collections.emptySet());
        var auth = new UsernamePasswordAuthenticationToken(principal, null, List.of());
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    @Test
    @SuppressWarnings("unchecked")
    void v459Migration_backfilledSelfServiceKnowledgePermission_toEveryPermissionSetHoldingDocumentsModuleView() {
        List<UUID> documentsModuleViewSets = entityManager.createNativeQuery("""
                SELECT DISTINCT psi.permission_set_id
                FROM permission_set_items psi
                JOIN permissions p ON p.id = psi.permission_id
                JOIN permission_sets ps ON ps.id = psi.permission_set_id
                WHERE p.code = 'documents.module.view'
                  -- Only sets that already existed when V459 ran: the migration is a one-time backfill, so a
                  -- Permission Set created afterwards (e.g. a test fixture) is not covered by it.
                  AND ps.created_at <= (SELECT installed_on FROM flyway_schema_history WHERE version = '459')
                """).getResultList();
        assertTrue(documentsModuleViewSets.size() > 0,
                "Expected at least one Permission Set holding documents.module.view in this dev DB");

        List<UUID> selfServiceKnowledgeSets = entityManager.createNativeQuery("""
                SELECT DISTINCT psi.permission_set_id
                FROM permission_set_items psi
                JOIN permissions p ON p.id = psi.permission_id
                WHERE p.code = 'self_service.knowledge.view'
                """).getResultList();

        assertTrue(selfServiceKnowledgeSets.containsAll(documentsModuleViewSets),
                "Every Permission Set holding documents.module.view must also hold "
                        + "self_service.knowledge.view after the V459 backfill -- missing: "
                        + documentsModuleViewSets.stream().filter(id -> !selfServiceKnowledgeSets.contains(id)).toList());
    }

    @Test
    void homePage_roundTripsThroughUpdateAndGet() {
        UserManagementResponse updated = userManagementService.updateUser(
                actor.getId(), updateRequest("KNOWLEDGE"), new MockHttpServletRequest());
        assertEquals("KNOWLEDGE", updated.homePage());

        UserManagementResponse fetched = userManagementService.getUser(actor.getId());
        assertEquals("KNOWLEDGE", fetched.homePage());

        UserManagementResponse updatedAgain = userManagementService.updateUser(
                actor.getId(), updateRequest("NOTIFICATIONS"), new MockHttpServletRequest());
        assertEquals("NOTIFICATIONS", updatedAgain.homePage());
    }

    @Test
    void homePage_rejectsAnInvalidValue() {
        UpdateUserRequest invalid = updateRequest("NOT_A_REAL_PAGE");
        org.junit.jupiter.api.Assertions.assertThrows(IllegalArgumentException.class,
                () -> userManagementService.updateUser(actor.getId(), invalid, new MockHttpServletRequest()));
    }

    private UpdateUserRequest updateRequest(String homePage) {
        return new UpdateUserRequest(
                null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, homePage, null
        );
    }
}
