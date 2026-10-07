package com.eqms;

import com.eqms.auth.AuthenticatedUser;
import com.eqms.dto.document.DocumentListItemResponse;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentWorkflowParticipant;
import com.eqms.entity.UserAccount;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.DocumentWorkflowParticipantRepository;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.DocumentService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Documents list columns Reviewers, Approvers, Required Training and Training Period (Days): shown, filtered and sorted on the server,
 * on the real schema (the reviewer / approver sort keys are computed by the database).
 */
@SpringBootTest
@Transactional
class DocumentListParticipantColumnsIntegrationTest {

    @Autowired private DocumentService documentService;
    @Autowired private DocumentRecordRepository documentRepository;
    @Autowired private DocumentWorkflowParticipantRepository participantRepository;
    @Autowired private UserAccountRepository userAccountRepository;

    private DocumentRecord first;
    private DocumentRecord second;
    private UserAccount alice;
    private UserAccount zoe;

    @BeforeEach
    void setUp() {
        UserAccount admin = userAccountRepository.findByUsername("admin").orElseThrow(() -> new AssertionError("Seeded admin user not found"));
        AuthenticatedUser principal = new AuthenticatedUser(admin.getId(), UUID.randomUUID(), admin.getUsername(),
                admin.getRoleName() != null ? admin.getRoleName() : "USER", Collections.emptySet());
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(principal, null, List.of()));

        List<DocumentRecord> documents = documentRepository.findAll().stream().filter(d -> d.getDocumentNumber() != null).limit(2).toList();
        assumeTrue(documents.size() == 2, "Seed data needs two documents");
        List<UserAccount> users = userAccountRepository.findAll().stream()
                .sorted(Comparator.comparing(UserAccount::getFullName, String.CASE_INSENSITIVE_ORDER)).toList();
        assumeTrue(users.size() >= 2 && !users.get(0).getFullName().equalsIgnoreCase(users.get(users.size() - 1).getFullName()), "Seed data needs two users");
        alice = users.get(0);
        zoe = users.get(users.size() - 1);
        first = documents.get(0);
        second = documents.get(1);

        // first: reviewed by alice, approved by zoe, training required for 14 days.
        // second: reviewed by zoe then alice (two reviewers), no approver, no training.
        for (DocumentRecord document : documents) {
            participantRepository.deleteAllByDocument_Id(document.getId());
        }
        participantRepository.flush();
        add(first, "REVIEWER", alice, 1);
        add(first, "APPROVER", zoe, 1);
        add(second, "REVIEWER", zoe, 1);
        add(second, "REVIEWER", alice, 2);
        first.setRequiresTraining(true);
        first.setTrainingPeriodDays(14);
        second.setRequiresTraining(false);
        second.setTrainingPeriodDays(30); // a stale value on a document that no longer requires training
        documentRepository.saveAllAndFlush(documents);
    }

    private void add(DocumentRecord document, String type, UserAccount user, int order) {
        DocumentWorkflowParticipant participant = new DocumentWorkflowParticipant();
        participant.setDocument(document);
        participant.setParticipantType(type);
        participant.setUser(user);
        participant.setSequenceOrder(order);
        participantRepository.saveAndFlush(participant);
    }

    private List<DocumentListItemResponse> list(String reviewerId, String approverId, String requiresTraining, String sortBy, String direction) {
        String ids = first.getId() + "," + second.getId();
        return documentService.listDocuments("all", null, ids, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, reviewerId, approverId, requiresTraining, sortBy, direction, 1, 50).data();
    }

    private List<String> numbers(List<DocumentListItemResponse> items) {
        return items.stream().map(DocumentListItemResponse::documentNumber).toList();
    }

    @Test
    void each_document_shows_its_reviewers_and_approvers_in_workflow_order_and_its_training() {
        List<DocumentListItemResponse> items = list(null, null, null, "created", "asc");

        DocumentListItemResponse one = items.stream().filter(i -> i.id().equals(first.getId().toString())).findFirst().orElseThrow();
        DocumentListItemResponse two = items.stream().filter(i -> i.id().equals(second.getId().toString())).findFirst().orElseThrow();
        assertThat(one.reviewerNames()).containsExactly(alice.getFullName());
        assertThat(one.approverNames()).containsExactly(zoe.getFullName());
        assertThat(one.requiresTraining()).isTrue();
        assertThat(one.trainingPeriodDays()).isEqualTo(14);
        assertThat(two.reviewerNames()).containsExactly(zoe.getFullName(), alice.getFullName());
        assertThat(two.approverNames()).isEmpty();
        assertThat(two.requiresTraining()).isFalse();
        assertThat(two.trainingPeriodDays()).as("a document without training shows no period, whatever is stored").isNull();
    }

    @Test
    void the_reviewer_and_approver_filters_keep_only_documents_that_list_that_user() {
        assertThat(list(alice.getId().toString(), null, null, "created", "asc")).hasSize(2);
        assertThat(numbers(list(zoe.getId().toString(), null, null, "created", "asc"))).containsExactly(second.getDocumentNumber());
        assertThat(numbers(list(null, zoe.getId().toString(), null, "created", "asc"))).containsExactly(first.getDocumentNumber());
        assertThat(list(null, alice.getId().toString(), null, "created", "asc")).isEmpty();
        assertThat(list(UUID.randomUUID().toString(), null, null, "created", "asc")).isEmpty();
        assertThat(list("All", "All", "All", "created", "asc")).hasSize(2);
        assertThat(list("not-a-user", null, null, "created", "asc")).isEmpty();
    }

    @Test
    void the_training_filter_separates_documents_that_require_training() {
        assertThat(numbers(list(null, null, "yes", "created", "asc"))).containsExactly(first.getDocumentNumber());
        assertThat(numbers(list(null, null, "no", "created", "asc"))).containsExactly(second.getDocumentNumber());
    }

    @Test
    void the_new_columns_sort_both_ways_on_the_server() {
        // reviewers: the first document has "Alice", the second "Zoe, Alice": ascending puts the first document first.
        assertThat(numbers(list(null, null, null, "reviewers", "asc"))).containsExactly(first.getDocumentNumber(), second.getDocumentNumber());
        assertThat(numbers(list(null, null, null, "reviewers", "desc"))).containsExactly(second.getDocumentNumber(), first.getDocumentNumber());
        // approvers: only the first has one; the other sorts by the database default for an empty value, and both stay in the list.
        assertThat(list(null, null, null, "approvers", "asc")).hasSize(2);
        assertThat(list(null, null, null, "approvers", "desc")).hasSize(2);
        // training flag: false before true ascending.
        assertThat(numbers(list(null, null, null, "requiresTraining", "asc"))).containsExactly(second.getDocumentNumber(), first.getDocumentNumber());
        assertThat(numbers(list(null, null, null, "requiresTraining", "desc"))).containsExactly(first.getDocumentNumber(), second.getDocumentNumber());
        assertThat(list(null, null, null, "trainingPeriodDays", "asc")).hasSize(2);
        assertThat(list(null, null, null, "trainingPeriodDays", "desc")).hasSize(2);
    }
}
