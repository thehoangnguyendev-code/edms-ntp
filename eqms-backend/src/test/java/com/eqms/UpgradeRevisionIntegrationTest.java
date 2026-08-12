package com.eqms;

import com.eqms.auth.AuthenticatedUser;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.UserAccount;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.DocumentRevisionRepository;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.RevisionService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
public class UpgradeRevisionIntegrationTest {

    @Autowired
    private RevisionService revisionService;

    @Autowired
    private DocumentRecordRepository documentRepository;

    @Autowired
    private DocumentRevisionRepository revisionRepository;

    @Autowired
    private UserAccountRepository userAccountRepository;

    @Test
    public void testUpgradeRevisionLifecycle() {
        // Authenticate a seeded user
        UserAccount user = userAccountRepository.findByUsername("user.a.test")
                .or(() -> userAccountRepository.findAll().stream().findFirst())
                .orElseThrow(() -> new AssertionError("No users seeded"));
        AuthenticatedUser principal = new AuthenticatedUser(
                user.getId(),
                UUID.randomUUID(),
                user.getUsername(),
                user.getRoleName() != null ? user.getRoleName() : "USER",
                Collections.emptySet()
        );
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(principal, null, List.of());
        SecurityContextHolder.getContext().setAuthentication(auth);

        // Pick an ACTIVE document whose effective revision is not already blocked
        // by another in-progress revision. Seed data is intentionally reusable and
        // may contain drafts from earlier lifecycle tests.
        DocumentRecord document = documentRepository.findAll().stream()
                .filter(candidate -> candidate.getStatus() != null
                        && "ACTIVE".equals(candidate.getStatus().getCode()))
                .filter(candidate -> {
                    List<DocumentRevisionRecord> candidateRevisions =
                            revisionRepository.findAllByDocument_IdOrderByCreatedAtDesc(candidate.getId());
                    boolean hasEffective = candidateRevisions.stream()
                            .anyMatch(r -> r.getStatus() != null && "EFFECTIVE".equals(r.getStatus().getCode()));
                    boolean hasInProgress = candidateRevisions.stream()
                            .anyMatch(r -> r.getStatus() != null && List.of(
                                    "DRAFT", "PENDING_REVIEW", "PENDING_APPROVAL", "PENDING_TRAINING",
                                    "READY_FOR_PUBLISHING").contains(r.getStatus().getCode()));
                    return hasEffective && !hasInProgress;
                })
                .findFirst()
                .orElseThrow(() -> new AssertionError("No ACTIVE document with an available effective revision"));

        // Print initial status
        System.out.println("Initial Document Status: " + document.getStatus().getCode());
        assertEquals("ACTIVE", document.getStatus().getCode(), "Document status should be ACTIVE");

        List<DocumentRevisionRecord> revisions = revisionRepository.findAllByDocument_IdOrderByCreatedAtDesc(document.getId());
        assertFalse(revisions.isEmpty(), "Should have revisions for POL.0002");

        DocumentRevisionRecord effectiveRevision = revisions.stream()
                .filter(r -> "EFFECTIVE".equals(r.getStatus().getCode()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Should have an EFFECTIVE revision"));
        System.out.println("Initial Revision Status: " + effectiveRevision.getStatus().getCode() + " for " + effectiveRevision.getRevisionNumber());

        // Perform upgrade
        System.out.println("Executing upgradeRevision...");
        var upgradeResponse = revisionService.upgradeRevision(effectiveRevision.getId());
        assertNotNull(upgradeResponse);

        // Fetch fresh status from DB
        DocumentRecord updatedDoc = documentRepository.findById(document.getId()).get();
        List<DocumentRevisionRecord> updatedRevisions = revisionRepository.findAllByDocument_IdOrderByCreatedAtDesc(document.getId());

        System.out.println("Post-Upgrade Document Status: " + updatedDoc.getStatus().getCode());
        System.out.println("Post-Upgrade Revisions:");
        for (DocumentRevisionRecord rev : updatedRevisions) {
            System.out.println("  Revision: " + rev.getRevisionNumber() + " | Status: " + rev.getStatus().getCode());
        }

        // Verify that:
        // 1. The original effective revision is still EFFECTIVE
        DocumentRevisionRecord origRev = revisionRepository.findById(effectiveRevision.getId()).get();
        assertEquals("EFFECTIVE", origRev.getStatus().getCode(), "Original revision must remain EFFECTIVE after upgrade");

        // 2. The document status is still ACTIVE
        assertEquals("ACTIVE", updatedDoc.getStatus().getCode(), "Document must remain ACTIVE after upgrade");

        // 3. There is a new DRAFT revision
        DocumentRevisionRecord draftRev = updatedRevisions.stream()
                .filter(r -> "DRAFT".equals(r.getStatus().getCode()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Should have a new DRAFT revision"));
        assertNotNull(draftRev.getRevisionNumber(), "New draft revision should have a revision number");
    }
}
