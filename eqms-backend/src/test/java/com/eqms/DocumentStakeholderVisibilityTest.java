package com.eqms;

import com.eqms.dto.document.DocumentDraftCreateRequest;
import com.eqms.dto.document.DocumentListItemResponse;
import com.eqms.dto.user.SystemConfigurationRequest;
import com.eqms.entity.*;
import com.eqms.repository.*;
import com.eqms.service.DocumentAuthorizationService;
import com.eqms.service.DocumentService;
import com.eqms.service.SystemConfigurationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Real-DB evidence for the "Retain Visibility for Removed Participants" system setting (Document
 * Properties > Protection & Distribution) and the permanent document_stakeholder_history table
 * backing it (V458). Exercises DocumentAuthorizationService.canViewDocument/isDirectStakeholder
 * directly against a genuine Author reassignment, rather than routing through
 * updateActiveWorkflowConfiguration's Active+Effective-revision prerequisite (already covered by
 * DocumentLifecycleBaselineTest et al.) -- this is the narrowest real exercise of the mechanism
 * itself: a user assigned then removed as Author, with no other role on the Document.
 */
@SpringBootTest
class DocumentStakeholderVisibilityTest {

    @Autowired private DocumentService documentService;
    @Autowired private DocumentAuthorizationService documentAuthorizationService;
    @Autowired private SystemConfigurationService systemConfigurationService;
    @Autowired private DocumentRecordRepository documentRepository;
    @Autowired private DocumentStakeholderHistoryRepository documentStakeholderHistoryRepository;
    @Autowired private DocumentTypeRepository documentTypeRepository;
    @Autowired private BusinessUnitRepository businessUnitRepository;
    @Autowired private DepartmentRepository departmentRepository;
    @Autowired private UserAccountRepository userAccountRepository;
    @Autowired private PlatformTransactionManager transactionManager;

    private DocumentType type;
    private BusinessUnit businessUnit;
    private Department department;
    private UserAccount actor;
    private UserAccount formerAuthor;
    private UserAccount newAuthor;
    private final List<UUID> createdDocumentIds = new java.util.ArrayList<>();
    private java.util.Set<String> originalEnabledTypes;

    @BeforeEach
    void setUp() {
        type = documentTypeRepository.findAll().stream().filter(DocumentType::isActive).findFirst().orElseThrow();
        businessUnit = businessUnitRepository.findAll().stream().filter(BusinessUnit::isActive).findFirst().orElseThrow();
        department = departmentRepository.findAll().stream().filter(Department::isActive).findFirst().orElseThrow();
        actor = userAccountRepository.findAll().stream()
                .filter(u -> "admin".equals(u.getUsername()))
                .findFirst().orElseThrow();

        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        formerAuthor = tx.execute(status -> {
            UserAccount u = new UserAccount();
            u.setUsername("stakeholder.former." + UUID.randomUUID());
            u.setEmail(UUID.randomUUID() + "@example.test");
            u.setFullName("Former Author Test User");
            u.setStatus(UserStatus.Active);
            u.setPasswordHash("$2a$10$Q7q0y6qz3nQ2QF6cGqk8n.T4mDx9J1Xb6mQpMwqzYh8kK1uT9y8gG");
            u.setRoleName("USER");
            return userAccountRepository.save(u);
        });
        newAuthor = tx.execute(status -> {
            UserAccount u = new UserAccount();
            u.setUsername("stakeholder.new." + UUID.randomUUID());
            u.setEmail(UUID.randomUUID() + "@example.test");
            u.setFullName("New Author Test User");
            u.setStatus(UserStatus.Active);
            u.setPasswordHash("$2a$10$Q7q0y6qz3nQ2QF6cGqk8n.T4mDx9J1Xb6mQpMwqzYh8kK1uT9y8gG");
            u.setRoleName("USER");
            return userAccountRepository.save(u);
        });

        originalEnabledTypes = systemConfigurationService.getRetainVisibilityForRemovedParticipantTypes();
        runAsActor(actor);
    }

    @AfterEach
    void cleanup() {
        setEnabledParticipantTypes(originalEnabledTypes);
        SecurityContextHolder.clearContext();
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        tx.executeWithoutResult(status -> {
            for (UserAccount u : List.of(formerAuthor, newAuthor)) {
                if (u != null) {
                    userAccountRepository.findById(u.getId()).ifPresent(found -> {
                        found.setStatus(UserStatus.Suspended);
                        userAccountRepository.save(found);
                    });
                }
            }
        });
    }

    private void runAsActor(UserAccount who) {
        var principal = new com.eqms.auth.AuthenticatedUser(
                who.getId(), UUID.randomUUID(), who.getUsername(),
                who.getRoleName() != null ? who.getRoleName() : "USER", java.util.Collections.emptySet());
        var auth = new UsernamePasswordAuthenticationToken(principal, null, List.of());
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    private static final java.util.Map<String, String> CONFIG_KEY_BY_TYPE = java.util.Map.of(
            "AUTHOR", "retainVisibilityForRemovedAuthor",
            "CO_AUTHOR", "retainVisibilityForRemovedCoAuthor",
            "REVIEWER", "retainVisibilityForRemovedReviewer",
            "APPROVER", "retainVisibilityForRemovedApprover"
    );

    private void setEnabledParticipantTypes(java.util.Set<String> enabledTypes) {
        ObjectNode documentsNode = new ObjectMapper().createObjectNode();
        for (var entry : CONFIG_KEY_BY_TYPE.entrySet()) {
            documentsNode.put(entry.getValue(), enabledTypes.contains(entry.getKey()));
        }
        systemConfigurationService.updateConfiguration(
                new SystemConfigurationRequest(null, null, documentsNode, null, null, null));
    }

    private DocumentDraftCreateRequest draftRequest(String name, String authorId) {
        return new DocumentDraftCreateRequest(
                name, null, type.getId().toString(), authorId,
                businessUnit.getId().toString(), department.getId().toString(),
                null, null, null, null, "English", false, null, "Not applicable for test", null, null,
                null, null, null, false, null, null, null, null, null,
                null, null, null
        );
    }

    @Test
    void stakeholderHistory_isRecordedAssoonAsAUserIsAssignedAuthor() {
        DocumentListItemResponse created = documentService.createDocumentDraft(
                draftRequest("Stakeholder History Test " + UUID.randomUUID(), formerAuthor.getId().toString()));
        UUID documentId = UUID.fromString(created.id());
        createdDocumentIds.add(documentId);

        assertTrue(documentStakeholderHistoryRepository
                        .existsByDocument_IdAndUser_IdAndParticipantType(documentId, formerAuthor.getId(), "AUTHOR"),
                "A permanent stakeholder-history row must exist the moment a user becomes Author, "
                        + "regardless of whether the retain-visibility setting is on");
    }

    @Test
    void removedAuthor_losesVisibility_whenRetainVisibilitySettingIsDisabled() {
        setEnabledParticipantTypes(java.util.Set.of());
        DocumentListItemResponse created = documentService.createDocumentDraft(
                draftRequest("Removed Author No Retain Test " + UUID.randomUUID(), formerAuthor.getId().toString()));
        UUID documentId = UUID.fromString(created.id());
        createdDocumentIds.add(documentId);

        DocumentRecord document = documentRepository.findById(documentId).orElseThrow();
        assertTrue(documentAuthorizationService.canViewDocument(formerAuthor, document),
                "The current Author must be able to view their own Document");

        // Reassign Author directly at the repository level -- the narrowest exercise of "this user
        // is no longer a current participant", without needing the full Active+Effective
        // prerequisite updateActiveWorkflowConfiguration enforces (covered elsewhere).
        reassignAuthor(documentId, newAuthor);
        DocumentRecord reassigned = documentRepository.findById(documentId).orElseThrow();

        assertFalse(documentAuthorizationService.canViewDocument(formerAuthor, reassigned),
                "With the setting disabled, a removed Author with no other role on the Document "
                        + "must lose visibility -- unchanged, pre-existing behavior");
        assertTrue(documentAuthorizationService.canViewDocument(newAuthor, reassigned),
                "The newly-assigned Author must be able to view the Document");
    }

    @Test
    void removedAuthor_keepsReadOnlyVisibility_whenRetainVisibilitySettingIsEnabled() {
        setEnabledParticipantTypes(java.util.Set.of("AUTHOR"));
        DocumentListItemResponse created = documentService.createDocumentDraft(
                draftRequest("Removed Author Retain Test " + UUID.randomUUID(), formerAuthor.getId().toString()));
        UUID documentId = UUID.fromString(created.id());
        createdDocumentIds.add(documentId);

        reassignAuthor(documentId, newAuthor);
        DocumentRecord reassigned = documentRepository.findById(documentId).orElseThrow();

        assertTrue(documentAuthorizationService.canViewDocument(formerAuthor, reassigned),
                "With the setting enabled, a removed Author must retain read-only visibility via "
                        + "the permanent stakeholder history");
        assertTrue(documentAuthorizationService.isDirectStakeholder(formerAuthor, reassigned),
                "isDirectStakeholder must also report true -- e.g. so the Preview/Audit Trail tabs "
                        + "granted to direct stakeholders remain visible too, not just the base view");
    }

    @Test
    void perRoleToggles_areIndependent_enablingCoAuthorAloneDoesNotRetainAuthorVisibility() {
        // The whole point of splitting one checkbox into 4: enabling Co-Author's toggle must not
        // accidentally retain visibility for a removed AUTHOR too.
        setEnabledParticipantTypes(java.util.Set.of("CO_AUTHOR"));
        DocumentListItemResponse created = documentService.createDocumentDraft(
                draftRequest("Per-Role Independence Test " + UUID.randomUUID(), formerAuthor.getId().toString()));
        UUID documentId = UUID.fromString(created.id());
        createdDocumentIds.add(documentId);

        reassignAuthor(documentId, newAuthor);
        DocumentRecord reassigned = documentRepository.findById(documentId).orElseThrow();

        assertFalse(documentAuthorizationService.canViewDocument(formerAuthor, reassigned),
                "Only Co-Author's toggle is on -- a removed AUTHOR must NOT retain visibility from it");
    }

    private void reassignAuthor(UUID documentId, UserAccount author) {
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        tx.executeWithoutResult(status -> {
            DocumentRecord document = documentRepository.findById(documentId).orElseThrow();
            document.setAuthor(author);
            documentRepository.save(document);
        });
    }
}
