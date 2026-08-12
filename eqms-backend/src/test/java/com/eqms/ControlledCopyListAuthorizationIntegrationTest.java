package com.eqms;

import com.eqms.auth.AuthenticatedUser;
import com.eqms.dto.document.ControlledCopyListItemResponse;
import com.eqms.dto.user.PageResponse;
import com.eqms.entity.ControlledCopyRecord;
import com.eqms.entity.UserAccount;
import com.eqms.repository.ControlledCopyRepository;
import com.eqms.repository.RevisionWorkflowParticipantRepository;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.ControlledCopyService;
import com.eqms.service.DocumentAuthorizationService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Verifies the database-side authorization pushdown in
 * {@link ControlledCopyService#list} (added to replace an in-memory "load everything, then
 * filter+paginate in Java" implementation) against real seeded data, since the existing
 * mock-based authorization tests cannot exercise a JPA Criteria/Specification predicate.
 */
@SpringBootTest
@Transactional
public class ControlledCopyListAuthorizationIntegrationTest {

    @Autowired
    private ControlledCopyService controlledCopyService;

    @Autowired
    private ControlledCopyRepository controlledCopyRepository;

    @Autowired
    private UserAccountRepository userAccountRepository;

    @Autowired
    private RevisionWorkflowParticipantRepository revisionWorkflowParticipantRepository;

    @Autowired
    private DocumentAuthorizationService documentAuthorizationService;

    private void authenticateAs(UserAccount user) {
        AuthenticatedUser principal = new AuthenticatedUser(
                user.getId(),
                UUID.randomUUID(),
                user.getUsername(),
                user.getRoleName() != null ? user.getRoleName() : "USER",
                Collections.emptySet()
        );
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, List.of()));
    }

    @Test
    void list_includesRecordsRequestedByCurrentUser() {
        UserAccount requester = userAccountRepository.findByUsername("admin")
                .orElseThrow(() -> new AssertionError("Seeded 'admin' user not found"));

        // Independently confirmed straight from the repository (not via the method under test),
        // so the assertion below is not vacuously true.
        List<ControlledCopyRecord> requestedByAdmin = controlledCopyRepository.findAll().stream()
                .filter(copy -> copy.getRequestedBy() != null && requester.getId().equals(copy.getRequestedBy().getId()))
                .toList();
        assertFalse(requestedByAdmin.isEmpty(), "Seed data must contain at least one controlled copy requested by 'admin'");

        authenticateAs(requester);
        PageResponse<ControlledCopyListItemResponse> page = controlledCopyService.list(
                1, 1000, null, null, null, null, null, null, null, null, null, null, null, null, "created", "desc");

        List<String> visibleIds = page.data().stream().map(ControlledCopyListItemResponse::id).toList();
        for (ControlledCopyRecord copy : requestedByAdmin) {
            assertTrue(visibleIds.contains(copy.getId().toString()),
                    "Controlled copy " + copy.getControlledCopyNumber() + " requested by the current user must be visible to them");
        }
    }

    @Test
    void list_paginationReturnsExactPageSize_andTotalMatchesFullResultCount() {
        UserAccount requester = userAccountRepository.findByUsername("admin")
                .orElseThrow(() -> new AssertionError("Seeded 'admin' user not found"));
        authenticateAs(requester);

        PageResponse<ControlledCopyListItemResponse> fullPage = controlledCopyService.list(
                1, 1000, null, null, null, null, null, null, null, null, null, null, null, null, "created", "desc");
        long total = fullPage.pagination().total();
        assertTrue(total >= 2, "Test requires at least 2 visible controlled copies for this user; adjust seed data if this fails");

        PageResponse<ControlledCopyListItemResponse> firstPageOfTwo = controlledCopyService.list(
                1, 2, null, null, null, null, null, null, null, null, null, null, null, null, "created", "desc");

        assertEquals(2, firstPageOfTwo.data().size(), "A page size of 2 must return exactly 2 rows when more are available");
        assertEquals(total, firstPageOfTwo.pagination().total(), "Total count must reflect all visible rows, not just the current page");
        assertEquals((int) Math.ceil(total / 2.0), firstPageOfTwo.pagination().totalPages());
    }

    @Test
    void list_excludesRecordsTheCurrentUserHasNoRelationshipTo() {
        // Pick a copy requested by 'admin', then find some other seeded user who is provably
        // unrelated to it (not the requester/recipient/any lifecycle actor on the copy, not the
        // revision's author or a CO_AUTHOR/REVIEWER/APPROVER participant, and not granted
        // blanket document-admin visibility) — that user must not see it in the list.
        UserAccount admin = userAccountRepository.findByUsername("admin")
                .orElseThrow(() -> new AssertionError("Seeded 'admin' user not found"));
        ControlledCopyRecord targetCopy = controlledCopyRepository.findAll().stream()
                .filter(copy -> copy.getRequestedBy() != null && admin.getId().equals(copy.getRequestedBy().getId()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Seed data must contain at least one controlled copy requested by 'admin'"));
        UUID revisionId = targetCopy.getRevision().getId();
        UUID revisionAuthorId = targetCopy.getRevision().getAuthor() == null ? null : targetCopy.getRevision().getAuthor().getId();

        UserAccount unrelatedUser = userAccountRepository.findAll().stream()
                .filter(candidate -> !documentAuthorizationService.canViewAllDocuments(candidate))
                .filter(candidate -> !candidate.getId().equals(revisionAuthorId))
                .filter(candidate -> revisionWorkflowParticipantRepository.countByRevision_IdAndUser_Id(revisionId, candidate.getId()) == 0)
                .filter(candidate -> !isAnyActorOnCopy(targetCopy, candidate))
                .findFirst()
                .orElse(null);
        org.junit.jupiter.api.Assumptions.assumeTrue(unrelatedUser != null,
                "No seeded user is unrelated to this controlled copy/revision; cannot exercise the negative case with current seed data");

        authenticateAs(unrelatedUser);
        PageResponse<ControlledCopyListItemResponse> page = controlledCopyService.list(
                1, 1000, null, null, null, null, null, null, null, null, null, null, null, null, "created", "desc");

        List<String> visibleIds = page.data().stream().map(ControlledCopyListItemResponse::id).toList();
        assertFalse(visibleIds.contains(targetCopy.getId().toString()),
                "User '" + unrelatedUser.getUsername() + "' has no relationship to this controlled copy or its revision and must not see it");
    }

    private boolean isAnyActorOnCopy(ControlledCopyRecord copy, UserAccount user) {
        UUID userId = user.getId();
        return matchesActor(copy.getRecipientUser(), userId)
                || matchesActor(copy.getRequestedBy(), userId)
                || matchesActor(copy.getApprovedBy(), userId)
                || matchesActor(copy.getPrintedBy(), userId)
                || matchesActor(copy.getDistributedBy(), userId)
                || matchesActor(copy.getRecalledBy(), userId)
                || matchesActor(copy.getDestroyedBy(), userId)
                || matchesActor(copy.getCancelledBy(), userId)
                || matchesActor(copy.getObsoletedBy(), userId)
                || (copy.getRecipientName() != null && (
                        copy.getRecipientName().trim().equalsIgnoreCase(user.getFullName())
                        || copy.getRecipientName().trim().equalsIgnoreCase(user.getUsername())
                        || copy.getRecipientName().trim().equalsIgnoreCase(user.getEmail())));
    }

    private boolean matchesActor(UserAccount actor, UUID userId) {
        return actor != null && actor.getId() != null && actor.getId().equals(userId);
    }
}
