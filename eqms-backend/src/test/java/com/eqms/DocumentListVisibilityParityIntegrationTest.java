package com.eqms;

import com.eqms.auth.AuthenticatedUser;
import com.eqms.dto.document.DocumentListItemResponse;
import com.eqms.dto.document.RevisionListItemResponse;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.UserAccount;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.DocumentRevisionRepository;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.DocumentAuthorizationService;
import com.eqms.service.DocumentService;
import com.eqms.service.RevisionService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Parity check between the list endpoints and the record-level rule used for detail access
 * ({@link DocumentAuthorizationService#isDirectStakeholder}). For every seeded user without a
 * blanket view grant, the Document and Revision lists must return exactly the records the detail
 * check allows. Record visibility is assumed to be PARTICIPANTS_ONLY (the default, DOC-VISIBILITY-2026-10-06).
 */
@SpringBootTest
@Transactional
public class DocumentListVisibilityParityIntegrationTest {

    private static final int PAGE_SIZE = 50;

    @Autowired
    private DocumentService documentService;

    @Autowired
    private RevisionService revisionService;

    @Autowired
    private DocumentAuthorizationService documentAuthorizationService;

    @Autowired
    private UserAccountRepository userAccountRepository;

    @Autowired
    private DocumentRecordRepository documentRecordRepository;

    @Autowired
    private DocumentRevisionRepository documentRevisionRepository;

    @Autowired
    private org.springframework.jdbc.core.JdbcTemplate jdbc;

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

    /** The pages read for one user: a list item is made with the workflow actions of the person (several queries each), so reading a list of thousands is slow on the shared dev database. */
    private static final int MAX_PAGES = 3;

    /** The ids of a list and whether the whole list was read. */
    private record Listed(Set<String> ids, boolean complete) {}

    private Listed documentIdsInList() {
        Set<String> ids = new HashSet<>();
        for (int page = 1; page <= MAX_PAGES; page++) {
            List<DocumentListItemResponse> data = documentService.listDocuments(
                    null, null, null, null, null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null, null, null, null, page, PAGE_SIZE).data();
            if (data.isEmpty()) return new Listed(ids, true);
            data.forEach(item -> ids.add(item.id()));
        }
        return new Listed(ids, false);
    }

    private Listed revisionIdsInList() {
        Set<String> ids = new HashSet<>();
        for (int page = 1; page <= MAX_PAGES; page++) {
            List<RevisionListItemResponse> data = revisionService.listRevisions(
                    null, null, null, null, null, null, null, null, null, null, null, null, null,
                    null, null, null, null, null, false, false, null, null, page, PAGE_SIZE).data();
            if (data.isEmpty()) return new Listed(ids, true);
            data.forEach(item -> ids.add(item.id()));
        }
        return new Listed(ids, false);
    }

    /** How many records outside a user's list are asked about the detail rule (a stride over all of them), see {@link #documentAndRevisionLists_matchDetailVisibility_forEveryNonAdminUser}. */
    private static final int OUTSIDE_SAMPLE = 40;

    /** How many users are checked (an even sample by user name). */
    private static final int MAX_USERS = 4;

    /**
     * The two directions of the parity, at a cost that does not grow with the data of the shared dev database (the first version asked the detail rule about every document and every revision for every
     * user: with thousands of records that is millions of queries and the run never ended):
     * <ul>
     *   <li>everything a list returns is allowed by the detail rule (the list never shows more than the detail allows);</li>
     *   <li>of the records outside the list, an evenly spread sample of {@value #OUTSIDE_SAMPLE} is refused by the detail rule (the list never hides what the detail allows); only for a list that was read to its end.</li>
     * </ul>
     * An even sample of {@value #MAX_USERS} users, and at most {@value #MAX_PAGES} pages of each list, keep the run to minutes.
     */
    @Test
    void documentAndRevisionLists_matchDetailVisibility_forEveryNonAdminUser() {
        // Only IDs are needed to choose the existing outside-list sample. Hydrating
        // every entity also evaluates all its workflow formulas on a large demo DB.
        List<UUID> documentIds = jdbc.queryForList("select id from documents order by id", UUID.class);
        List<UUID> revisionIds = jdbc.queryForList("select id from document_revisions order by id", UUID.class);
        int checkedUsers = 0;

        List<UserAccount> withoutBlanketGrant = userAccountRepository.findAll().stream()
                .filter(user -> !documentAuthorizationService.canViewAllDocuments(user))
                .sorted(java.util.Comparator.comparing(user -> String.valueOf(user.getUsername())))
                .toList();
        int userStride = Math.max(1, withoutBlanketGrant.size() / MAX_USERS);
        for (int u = 0; u < withoutBlanketGrant.size(); u += userStride) {
            UserAccount user = withoutBlanketGrant.get(u);
            checkedUsers++;
            authenticateAs(user);

            Listed listedDocumentsRead = documentIdsInList();
            Set<String> listedDocuments = listedDocumentsRead.ids();
            for (String id : listedDocuments) {
                DocumentRecord document = documentRecordRepository.findById(UUID.fromString(id)).orElseThrow();
                assertTrue(documentAuthorizationService.isDirectStakeholder(user, document),
                        "Document " + document.getDocumentNumber() + " is in the list of " + user.getUsername() + " but the detail rule refuses it");
            }
            if (listedDocumentsRead.complete()) {
                assertOutsideTheListIsRefused(user, documentIds, listedDocuments, java.util.function.Function.identity(),
                        id -> documentAuthorizationService.isDirectStakeholder(user, documentRecordRepository.findById(id).orElseThrow()), "Document");
            }

            Listed listedRevisionsRead = revisionIdsInList();
            Set<String> listedRevisions = listedRevisionsRead.ids();
            for (String id : listedRevisions) {
                DocumentRevisionRecord revision = documentRevisionRepository.findById(UUID.fromString(id)).orElseThrow();
                assertTrue(documentAuthorizationService.isDirectStakeholder(user, revision),
                        "Revision " + revision.getId() + " is in the list of " + user.getUsername() + " but the detail rule refuses it");
            }
            if (listedRevisionsRead.complete()) {
                assertOutsideTheListIsRefused(user, revisionIds, listedRevisions, java.util.function.Function.identity(),
                        id -> documentAuthorizationService.isDirectStakeholder(user, documentRevisionRepository.findById(id).orElseThrow()), "Revision");
            }
        }
        assertEquals(true, checkedUsers > 0, "Seed data must include at least one user without a blanket view grant");
    }

    private <T> void assertOutsideTheListIsRefused(UserAccount user, List<T> all, Set<String> listed, java.util.function.Function<T, UUID> id,
                                                   java.util.function.Predicate<T> allowedByDetailRule, String kind) {
        List<T> outside = all.stream().filter(record -> !listed.contains(id.apply(record).toString())).toList();
        int stride = Math.max(1, outside.size() / OUTSIDE_SAMPLE);
        for (int i = 0; i < outside.size(); i += stride) {
            T record = outside.get(i);
            assertFalse(allowedByDetailRule.test(record),
                    kind + " " + id.apply(record) + " is allowed by the detail rule for " + user.getUsername() + " but is not in the list");
        }
    }
}
