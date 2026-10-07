package com.eqms;

import com.eqms.auth.AuthenticatedUser;
import com.eqms.dto.document.DocumentReopenRequest;
import com.eqms.dto.security.ResourceCapabilitiesResponse;
import com.eqms.entity.AuditLog;
import com.eqms.entity.ControlledCopyRecord;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.ElectronicSignature;
import com.eqms.entity.UserAccount;
import com.eqms.exception.AuthorizationDeniedException;
import com.eqms.exception.DocumentLifecycleConflictException;
import com.eqms.repository.AuditLogRepository;
import com.eqms.repository.ControlledCopyRepository;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.DocumentRevisionRepository;
import com.eqms.repository.DocumentStatusDefinitionRepository;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.DocumentMasterActionCapabilityService;
import com.eqms.service.DocumentService;
import com.eqms.service.ElectronicSignatureService;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.service.SignatureTokenConsumptionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Reopen of a closed Document, on the real schema and services (one transaction, rolled back): an Administrator, with an
 * e-signature and an audit entry, returns an Obsoleted or Closed - Cancelled Document to the state it had before it was closed,
 * and ONLY the Document moves: its Revisions and Controlled Copies stay exactly as they were.
 */
@SpringBootTest
@Transactional
class DocumentReopenIntegrationTest {

    private static final String PERMISSION = "documents.document.reopen";

    @Autowired private DocumentService documentService;
    @Autowired private DocumentMasterActionCapabilityService capabilityService;
    @Autowired private DocumentRecordRepository documentRepository;
    @Autowired private DocumentRevisionRepository revisionRepository;
    @Autowired private DocumentStatusDefinitionRepository statusRepository;
    @Autowired private com.eqms.repository.RevisionStatusDefinitionRepository revisionStatusRepository;
    @Autowired private ControlledCopyRepository copyRepository;
    @Autowired private AuditLogRepository auditLogRepository;
    @Autowired private UserAccountRepository userAccountRepository;
    @Autowired private PermissionEvaluationService permissionEvaluationService;

    @MockitoBean private SignatureTokenConsumptionService signatureTokenConsumptionService;
    @MockitoBean private ElectronicSignatureService electronicSignatureService;

    private UserAccount admin;
    private final UUID signatureSession = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        admin = userAccountRepository.findByUsername("admin").orElseThrow(() -> new AssertionError("Seeded admin user not found"));
        assumeTrue(permissionEvaluationService.hasPermission(admin, PERMISSION), "The admin account must hold " + PERMISSION);
        authenticateAs(admin);
        when(signatureTokenConsumptionService.requireAndConsume(anyString(), any())).thenReturn(signatureSession);
        ElectronicSignature signature = new ElectronicSignature();
        signature.setId(UUID.randomUUID());
        when(electronicSignatureService.createEntitySignature(anyString(), any(), anyString(), any(), anyString(), anyString(),
                any(), any(), any(), any())).thenReturn(signature);
    }

    private static void authenticateAs(UserAccount user) {
        AuthenticatedUser principal = new AuthenticatedUser(user.getId(), UUID.randomUUID(), user.getUsername(),
                user.getRoleName() != null ? user.getRoleName() : "USER", Collections.emptySet());
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(principal, null, List.of()));
    }

    private static String status(DocumentRecord document) {
        return document.getStatus() == null ? null : document.getStatus().getCode();
    }

    private DocumentRecord documentWithRevisions() {
        for (DocumentRecord document : documentRepository.findAll()) {
            if (!document.isTemplate() && revisionRepository.existsByDocument_Id(document.getId())) {
                return document;
            }
        }
        assumeTrue(false, "Seed data needs a document that has revisions");
        return null;
    }

    private DocumentRecord documentWithoutRevisions() {
        for (DocumentRecord document : documentRepository.findAll()) {
            if (!revisionRepository.existsByDocument_Id(document.getId())) {
                return document;
            }
        }
        assumeTrue(false, "Seed data needs a document that never had a revision");
        return null;
    }

    private void close(DocumentRecord document, String closedStatus, String before) {
        document.setStatus(statusRepository.findById(closedStatus).orElseThrow());
        document.setStatusBeforeClosure(before);
        documentRepository.saveAndFlush(document);
    }

    private List<String> revisionStatuses(DocumentRecord document) {
        return revisionRepository.findAllByDocument_IdOrderByCreatedAtDesc(document.getId()).stream()
                .map(revision -> revision.getStatus() == null ? "-" : revision.getStatus().getCode() + "/" + revision.getId()).sorted().toList();
    }

    private List<String> copyStatuses(DocumentRecord document) {
        return copyRepository.findAll().stream()
                .filter(copy -> copy.getDocument() != null && copy.getDocument().getId().equals(document.getId()))
                .map((ControlledCopyRecord copy) -> copy.getId() + "/" + copy.getStatusCode()).sorted().toList();
    }

    @Test
    void an_obsoleted_document_returns_to_active_signed_and_audited_and_nothing_else_is_reopened() {
        DocumentRecord document = documentWithRevisions();
        close(document, "OBSOLETED", "ACTIVE");
        List<String> revisionsBefore = revisionStatuses(document);
        List<String> copiesBefore = copyStatuses(document);

        documentService.reopenDocument(document.getId(), new DocumentReopenRequest("  Closed by mistake  ", "token"));

        DocumentRecord reopened = documentRepository.findById(document.getId()).orElseThrow();
        assertThat(status(reopened)).isEqualTo("ACTIVE");
        assertThat(reopened.getStatusBeforeClosure()).isNull();
        // One-way: the revisions and the controlled copies are exactly as they were.
        assertThat(revisionStatuses(reopened)).isEqualTo(revisionsBefore);
        assertThat(copyStatuses(reopened)).isEqualTo(copiesBefore);
        // E-signature: the token was consumed once and a signature with its own meaning was recorded.
        verify(signatureTokenConsumptionService).requireAndConsume("token", admin);
        verify(electronicSignatureService).createEntitySignature(eq("documents"), eq(document.getId()), anyString(), eq(admin),
                eq("token"), eq("DOCUMENT_REOPENED"), eq("Closed by mistake"), any(), eq("OBSOLETED"), eq("ACTIVE"));
        // Audit trail: who, from which status to which, why, linked to the signature.
        AuditLog entry = auditLogRepository.findAllByEntityTypeAndEntityIdOrderByCreatedAtDesc("DOCUMENT", document.getId()).stream()
                .filter(log -> "REOPEN".equalsIgnoreCase(log.getAction())).findFirst()
                .orElseThrow(() -> new AssertionError("No REOPEN audit entry"));
        assertThat(entry.getUserId()).isEqualTo(admin.getId());
        // The audit entry summarises its field changes as "Field: value | ...".
        assertThat(entry.getOldValue()).contains("Status: OBSOLETED");
        assertThat(entry.getNewValue()).contains("Status: ACTIVE").contains("Reason: Closed by mistake");
        assertThat(entry.getReason()).isEqualTo("Closed by mistake");
        assertThat(entry.getSignatureId()).isEqualTo(signatureSession);
    }

    @Test
    void a_cancelled_document_returns_to_draft_even_when_it_was_closed_before_the_state_was_recorded() {
        DocumentRecord document = documentWithoutRevisions();
        close(document, "CLOSED_CANCELLED", null);

        documentService.reopenDocument(document.getId(), new DocumentReopenRequest("Cancelled by mistake", "token"));

        assertThat(status(documentRepository.findById(document.getId()).orElseThrow())).isEqualTo("DRAFT");
    }

    @Test
    void the_recorded_state_before_closure_is_what_it_returns_to() {
        DocumentRecord document = documentWithRevisions();
        close(document, "OBSOLETED", "ACTIVE");
        documentService.reopenDocument(document.getId(), new DocumentReopenRequest("reason", "token"));
        assertThat(status(documentRepository.findById(document.getId()).orElseThrow())).isEqualTo("ACTIVE");

        DocumentRecord cancelled = documentWithoutRevisions();
        close(cancelled, "CLOSED_CANCELLED", "DRAFT");
        documentService.reopenDocument(cancelled.getId(), new DocumentReopenRequest("reason", "token"));
        assertThat(status(documentRepository.findById(cancelled.getId()).orElseThrow())).isEqualTo("DRAFT");
    }

    @Test
    void only_a_user_holding_the_permission_can_reopen() {
        DocumentRecord document = documentWithRevisions();
        close(document, "OBSOLETED", "ACTIVE");
        UserAccount other = userAccountRepository.findAll().stream()
                .filter(user -> user.getStatus() == com.eqms.entity.UserStatus.Active && !user.getId().equals(admin.getId()))
                .filter(user -> !permissionEvaluationService.hasPermission(user, PERMISSION))
                .findFirst().orElse(null);
        assumeTrue(other != null, "Seed data needs an active user without the reopen permission");
        authenticateAs(other);

        assertThatThrownBy(() -> documentService.reopenDocument(document.getId(), new DocumentReopenRequest("reason", "token")))
                .isInstanceOf(AuthorizationDeniedException.class);
        assertThat(status(documentRepository.findById(document.getId()).orElseThrow())).isEqualTo("OBSOLETED");
        verify(signatureTokenConsumptionService, never()).requireAndConsume(anyString(), any());
    }

    @Test
    void a_document_that_is_not_closed_cannot_be_reopened_and_no_signature_is_spent() {
        DocumentRecord document = documentWithRevisions();
        DocumentRecord active = documentRepository.findAll().stream().filter(d -> "ACTIVE".equals(status(d))).findFirst().orElse(null);
        assumeTrue(active != null, "Seed data needs an active document");

        // An Active document has no REOPEN policy at all, so the engine itself refuses it.
        assertThatThrownBy(() -> documentService.reopenDocument(active.getId(), new DocumentReopenRequest("reason", "token")))
                .isInstanceOfAny(AuthorizationDeniedException.class, DocumentLifecycleConflictException.class);
        assertThat(status(documentRepository.findById(active.getId()).orElseThrow())).isEqualTo("ACTIVE");
        verify(signatureTokenConsumptionService, never()).requireAndConsume(anyString(), any());
        assertThat(document).isNotNull();
    }

    @Test
    void a_reason_and_an_e_signature_are_both_required_and_neither_failure_spends_the_signature() {
        DocumentRecord document = documentWithRevisions();
        close(document, "OBSOLETED", "ACTIVE");

        assertThatThrownBy(() -> documentService.reopenDocument(document.getId(), new DocumentReopenRequest("   ", "token")))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("reason");
        assertThatThrownBy(() -> documentService.reopenDocument(document.getId(), new DocumentReopenRequest("reason", " ")))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("signature");
        assertThatThrownBy(() -> documentService.reopenDocument(document.getId(), null))
                .isInstanceOf(IllegalArgumentException.class);

        assertThat(status(documentRepository.findById(document.getId()).orElseThrow())).isEqualTo("OBSOLETED");
        verify(signatureTokenConsumptionService, never()).requireAndConsume(anyString(), any());
        verify(electronicSignatureService, never()).createEntitySignature(anyString(), any(), anyString(), any(), anyString(),
                eq("DOCUMENT_REOPENED"), any(), any(), any(), any());
    }

    @Test
    void closing_a_document_records_the_state_to_return_to_and_the_capability_shows_reopen_only_for_a_closed_one() {
        DocumentRecord document = documentWithRevisions();
        close(document, "OBSOLETED", "ACTIVE");

        ResourceCapabilitiesResponse closed = capabilityService.getCapabilities(document.getId());
        assertThat(closed.actions().get("reopen").allowed()).as("reopen on an obsoleted document").isTrue();
        assertThat(closed.actions().get("reopen").requiresESignature()).isTrue();

        documentService.reopenDocument(document.getId(), new DocumentReopenRequest("reason", "token"));
        ResourceCapabilitiesResponse reopened = capabilityService.getCapabilities(document.getId());
        assertThat(reopened.actions().get("reopen").allowed()).as("reopen on an active document").isFalse();
    }

    @Test
    void a_reopened_document_without_an_effective_revision_can_be_prepared_for_its_next_revision() {
        DocumentRecord document = documentWithRevisions();
        // As after an Obsolete: every revision closed, the document closed and then reopened.
        revisionRepository.findAllByDocument_IdOrderByCreatedAtDesc(document.getId()).forEach(revision -> {
            revision.setStatus(revisionStatusRepository.findById("OBSOLETED").orElseThrow());
            revisionRepository.save(revision);
        });
        close(document, "OBSOLETED", "ACTIVE");
        documentService.reopenDocument(document.getId(), new DocumentReopenRequest("reason", "token"));
        assertThat(revisionRepository.findFirstByDocument_IdAndStatus_CodeOrderByCreatedAtDesc(document.getId(), "EFFECTIVE")).isEmpty();

        // It is Active, so the "Effective revision required" guard must not stop the next revision from being configured ...
        assertThatThrownBy(() -> documentService.updateActiveWorkflowConfiguration(document.getId(), null))
                .satisfies(error -> assertThat(String.valueOf(error.getMessage())).doesNotContain("revision is required before configuring"));
        // ... and the screen must not be told that the document is not ready for a new revision for lack of an Effective one.
        ResourceCapabilitiesResponse capabilities = capabilityService.getCapabilities(document.getId());
        assertThat(capabilities.actions().get("uploadRevision").reasonCode()).isNotEqualTo("DOCUMENT_NOT_READY_FOR_UPGRADE");
        // A controlled copy is another matter: there is nothing effective to copy.
        assertThat(capabilities.actions().get("requestControlledCopy").allowed()).isFalse();
    }

    @SuppressWarnings("unused")
    private DocumentRevisionRecord unused;
}
