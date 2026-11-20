package com.eqms;

import com.eqms.entity.ControlledCopyRecord;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.RevisionWorkflowParticipant;
import com.eqms.entity.UserAccount;
import com.eqms.repository.DocumentRelationRepository;
import com.eqms.repository.DocumentRevisionRepository;
import com.eqms.repository.DocumentStakeholderHistoryRepository;
import com.eqms.repository.DocumentWorkflowParticipantRepository;
import com.eqms.repository.RevisionWorkflowParticipantRepository;
import com.eqms.service.DocumentAuthorizationService;
import com.eqms.service.LifecycleStatePolicyEvaluator;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.service.SystemConfigurationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;

/**
 * Who sees a Controlled/Uncontrolled Copy (VISIBILITY-TIERS-2026-11-20): the people named in the flow of the revision the copy belongs to see the
 * RECORD (list, detail, signatures, Audit Trail) when they hold the base copy view permission; the CONTENT (issued PDF, evidence files) stays with
 * the recipient and the view-everything holders. The flow is read per revision, so a person removed from the flow of a newer revision does not see
 * the copies of that revision (and keeps the copies of the older one). A person with only the document view-everything or the department level
 * is not, for that reason, a person who sees the copies.
 */
@ExtendWith(MockitoExtension.class)
class CopyFlowVisibilityTest {

    @Mock private DocumentWorkflowParticipantRepository documentWorkflowParticipantRepository;
    @Mock private RevisionWorkflowParticipantRepository revisionWorkflowParticipantRepository;
    @Mock private DocumentRevisionRepository documentRevisionRepository;
    @Mock private PermissionEvaluationService permissionEvaluationService;
    @Mock private LifecycleStatePolicyEvaluator lifecycleStatePolicyEvaluator;
    @Mock private DocumentRelationRepository documentRelationRepository;
    @Mock private DocumentStakeholderHistoryRepository documentStakeholderHistoryRepository;
    @Mock private SystemConfigurationService systemConfigurationService;

    @InjectMocks
    private DocumentAuthorizationService service;

    private UserAccount person;
    private DocumentRecord document;
    private DocumentRevisionRecord oldRevision;
    private DocumentRevisionRecord newRevision;
    private ControlledCopyRecord copyOfOld;
    private ControlledCopyRecord copyOfNew;

    @BeforeEach
    void setUp() {
        person = new UserAccount();
        person.setId(UUID.randomUUID());

        document = new DocumentRecord();
        document.setId(UUID.randomUUID());

        oldRevision = revision();
        newRevision = revision();
        copyOfOld = copy(oldRevision);
        copyOfNew = copy(newRevision);

        lenient().when(documentWorkflowParticipantRepository.findAllByDocument_IdOrderBySequenceOrderAsc(any())).thenReturn(List.of());
        lenient().when(revisionWorkflowParticipantRepository.findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(any(), any())).thenReturn(List.of());
        lenient().when(systemConfigurationService.getRetainVisibilityForRemovedParticipantTypes()).thenReturn(Set.of());
    }

    private DocumentRevisionRecord revision() {
        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(UUID.randomUUID());
        revision.setDocument(document);
        return revision;
    }

    private ControlledCopyRecord copy(DocumentRevisionRecord revision) {
        ControlledCopyRecord copy = new ControlledCopyRecord();
        copy.setId(UUID.randomUUID());
        copy.setDocument(document);
        copy.setRevision(revision);
        return copy;
    }

    private void reviewerOf(DocumentRevisionRecord revision) {
        RevisionWorkflowParticipant participant = new RevisionWorkflowParticipant();
        participant.setRevision(revision);
        participant.setUser(person);
        participant.setParticipantType("REVIEWER");
        lenient().when(revisionWorkflowParticipantRepository
                .findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(eq(revision.getId()), eq("REVIEWER"))).thenReturn(List.of(participant));
    }

    private void grant(String... codes) {
        for (String code : codes) {
            lenient().when(permissionEvaluationService.hasPermission(person, code)).thenReturn(true);
        }
    }

    @Test
    void personNamedInTheFlow_withTheBaseCopyPermission_seesTheRecord_butNotTheContent() {
        reviewerOf(oldRevision);
        grant("documents.controlled_copy.view");
        assertThat(service.canSeeControlledCopyRecord(person, copyOfOld)).isTrue();
        // the content (issued PDF, evidence files) is a separate rule: the recipient and the view-everything holders
        assertThat(service.canViewControlledCopy(person, copyOfOld)).isFalse();
    }

    @Test
    void personNamedInTheFlow_withoutTheBaseCopyPermission_seesNothing() {
        reviewerOf(oldRevision);
        assertThat(service.canSeeControlledCopyRecord(person, copyOfOld)).isFalse();
    }

    @Test
    void flowIsReadPerRevision_aPersonOnlyInTheOldRevisionDoesNotSeeTheCopyOfTheNewOne() {
        reviewerOf(oldRevision);
        grant("documents.controlled_copy.view");
        assertThat(service.canSeeControlledCopyRecord(person, copyOfOld)).isTrue();
        assertThat(service.canSeeControlledCopyRecord(person, copyOfNew)).isFalse();
    }

    @Test
    void recipient_stillSeesTheirOwnCopy_withNoNameInTheFlow() {
        copyOfOld.setRecipientUser(person);
        assertThat(service.canViewControlledCopy(person, copyOfOld)).isTrue();
        assertThat(service.canSeeControlledCopyRecord(person, copyOfOld)).isTrue();
    }

    @Test
    void viewEverythingOfDocuments_isNotTheCopyViewEverything() {
        grant("documents.document.view_all", "documents.controlled_copy.view");
        assertThat(service.canSeeControlledCopyRecord(person, copyOfOld)).isFalse();
    }

    @Test
    void departmentLevel_doesNotShowTheCopies() {
        grant("documents.document.view_department", "documents.document.view", "documents.controlled_copy.view");
        assertThat(service.canSeeControlledCopyRecord(person, copyOfOld)).isFalse();
    }

    @Test
    void copyViewEverything_seesTheRecordAndTheContent() {
        grant("documents.controlled_copy.view_all");
        assertThat(service.canViewControlledCopy(person, copyOfOld)).isTrue();
        assertThat(service.canSeeControlledCopyRecord(person, copyOfOld)).isTrue();
    }

    @Test
    void authorOfTheRevision_isNamedInItsFlow_butNotInANewerRevision() {
        oldRevision.setAuthor(person);
        grant("documents.controlled_copy.view");
        assertThat(service.canSeeControlledCopyRecord(person, copyOfOld)).isTrue();
        assertThat(service.canSeeControlledCopyRecord(person, copyOfNew)).isFalse();
    }

    @Test
    void ownerOfTheDocument_isNamedInEveryRevisionOfIt() {
        document.setOwner(person);
        grant("documents.controlled_copy.view");
        assertThat(service.canSeeControlledCopyRecord(person, copyOfOld)).isTrue();
        assertThat(service.canSeeControlledCopyRecord(person, copyOfNew)).isTrue();
    }

    @Test
    void uncontrolledCopy_sameRule_recordForThePersonNamedInTheFlowWithTheBaseViewPermission() {
        reviewerOf(oldRevision);
        assertThat(service.isNamedInFlowOfUncontrolledCopy(person, oldRevision)).isFalse(); // no base permission
        grant("documents.uncontrolled_copy.view");
        assertThat(service.isNamedInFlowOfUncontrolledCopy(person, oldRevision)).isTrue();
        assertThat(service.isNamedInFlowOfUncontrolledCopy(person, newRevision)).isFalse();
        assertThat(service.isNamedInFlowOfUncontrolledCopy(person, null)).isFalse();
    }

    @Test
    void copyWithoutRevision_isNeverSeenThroughTheFlow() {
        grant("documents.controlled_copy.view");
        ControlledCopyRecord legacy = copy(null);
        assertThat(service.canSeeControlledCopyRecord(person, legacy)).isFalse();
    }
}
