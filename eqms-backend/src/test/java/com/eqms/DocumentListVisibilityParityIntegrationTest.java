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

    private Set<String> allDocumentIdsInList() {
        Set<String> ids = new HashSet<>();
        for (int page = 1; ; page++) {
            List<DocumentListItemResponse> data = documentService.listDocuments(
                    null, null, null, null, null, null, null, null, null, null, null, null,
                    null, null, null, null, null, null, null, null, null, null, null, page, PAGE_SIZE).data();
            if (data.isEmpty()) break;
            data.forEach(item -> ids.add(item.id()));
        }
        return ids;
    }

    private Set<String> allRevisionIdsInList() {
        Set<String> ids = new HashSet<>();
        for (int page = 1; ; page++) {
            List<RevisionListItemResponse> data = revisionService.listRevisions(
                    null, null, null, null, null, null, null, null, null, null, null, null,
                    null, null, null, null, null, false, false, null, null, page, PAGE_SIZE).data();
            if (data.isEmpty()) break;
            data.forEach(item -> ids.add(item.id()));
        }
        return ids;
    }

    @Test
    void documentAndRevisionLists_matchDetailVisibility_forEveryNonAdminUser() {
        List<DocumentRecord> documents = documentRecordRepository.findAll();
        List<DocumentRevisionRecord> revisions = documentRevisionRepository.findAll();
        int checkedUsers = 0;

        for (UserAccount user : userAccountRepository.findAll()) {
            if (documentAuthorizationService.canViewAllDocuments(user)) {
                continue;
            }
            checkedUsers++;
            authenticateAs(user);

            Set<String> expectedDocuments = documents.stream()
                    .filter(document -> documentAuthorizationService.isDirectStakeholder(user, document))
                    .map(document -> document.getId().toString())
                    .collect(Collectors.toSet());
            assertEquals(expectedDocuments, allDocumentIdsInList(),
                    "Document list differs from detail visibility for user " + user.getUsername());

            Set<String> expectedRevisions = revisions.stream()
                    .filter(revision -> documentAuthorizationService.isDirectStakeholder(user, revision))
                    .map(revision -> revision.getId().toString())
                    .collect(Collectors.toSet());
            assertEquals(expectedRevisions, allRevisionIdsInList(),
                    "Revision list differs from detail visibility for user " + user.getUsername());
        }
        assertEquals(true, checkedUsers > 0, "Seed data must include at least one user without a blanket view grant");
    }
}
