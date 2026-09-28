package com.eqms.service;

import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.RevisionStatusDefinition;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.entity.WorkflowParticipant;
import com.eqms.repository.WorkflowParticipantRepository;
import com.eqms.service.authorization.AuthorizationEngineService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import static org.mockito.Mockito.lenient;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

/** Verifies the canonical, object-scoped workflow participant read model. */
@ExtendWith(MockitoExtension.class)
class GenericWorkflowParticipantsParityTest {

    @Mock private AuditTrailService auditTrailService;
    @Mock private WorkflowParticipantRepository workflowParticipantRepository;
    @Mock private AuthorizationEngineService authorizationEngineService;
    @Mock private SystemConfigurationService systemConfigurationService;

    private RevisionWorkflowAuthorizationService service;
    private UUID userId;
    private UUID revisionId;
    private UserAccount user;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        revisionId = UUID.randomUUID();
        user = new UserAccount();
        user.setId(userId);
        user.setStatus(UserStatus.Active);
        service = new RevisionWorkflowAuthorizationService(
                auditTrailService, workflowParticipantRepository, authorizationEngineService, systemConfigurationService);
        // Default: sequence enforced for both types (Parallel Review/Approval OFF), matching
        // SystemConfigurationService#isSequenceEnforcedForParticipantType's real default.
        lenient().when(systemConfigurationService.isSequenceEnforcedForParticipantType("REVIEWER")).thenReturn(true);
        lenient().when(systemConfigurationService.isSequenceEnforcedForParticipantType("APPROVER")).thenReturn(true);
    }

    private DocumentRevisionRecord revision(String statusCode) {
        DocumentRevisionRecord revision = new DocumentRevisionRecord();
        revision.setId(revisionId);
        RevisionStatusDefinition status = new RevisionStatusDefinition();
        status.setCode(statusCode);
        revision.setStatus(status);
        return revision;
    }

    @Test
    void pendingReviewer_readsCanonicalGenericAssignment() {
        // F-06: isPendingReviewer now reads the sequence-ordered list (and requires being the
        // sequence-next PENDING entry) rather than a single unordered lookup.
        WorkflowParticipant participant = new WorkflowParticipant();
        participant.setActionStatus("PENDING");
        participant.setUser(user);
        when(workflowParticipantRepository
                .findAllByObjectTypeAndObjectIdAndParticipantTypeOrderBySequenceOrderAsc(
                        "DOCUMENT_REVISION", revisionId, "REVIEWER"))
                .thenReturn(List.of(participant));

        assertTrue(service.isPendingReviewer(user, revision("PENDING_REVIEW")));
    }

    @Test
    void completedApprover_isNotPending() {
        WorkflowParticipant participant = new WorkflowParticipant();
        participant.setActionStatus("APPROVED");
        participant.setUser(user);
        when(workflowParticipantRepository
                .findAllByObjectTypeAndObjectIdAndParticipantTypeOrderBySequenceOrderAsc(
                        "DOCUMENT_REVISION", revisionId, "APPROVER"))
                .thenReturn(List.of(participant));

        assertFalse(service.isPendingApprover(user, revision("PENDING_APPROVAL")));
    }

    @Test
    void sequentialReview_blocksOutOfOrderReviewer() {
        // Regression: default (Parallel Review OFF) must keep rejecting a Reviewer who isn't
        // next in the configured sequence, even though they do hold a PENDING assignment.
        WorkflowParticipant first = new WorkflowParticipant();
        first.setActionStatus("PENDING");
        first.setUser(otherUser());
        WorkflowParticipant second = new WorkflowParticipant();
        second.setActionStatus("PENDING");
        second.setUser(user);
        when(workflowParticipantRepository
                .findAllByObjectTypeAndObjectIdAndParticipantTypeOrderBySequenceOrderAsc(
                        "DOCUMENT_REVISION", revisionId, "REVIEWER"))
                .thenReturn(List.of(first, second));

        assertFalse(service.isPendingReviewer(user, revision("PENDING_REVIEW")));
    }

    @Test
    void parallelReviewEnabled_allowsOutOfOrderReviewer() {
        // Document Properties' "Parallel Review" toggle -- once on, the sequence position no
        // longer matters, only whether this user has any PENDING Reviewer assignment.
        when(systemConfigurationService.isSequenceEnforcedForParticipantType("REVIEWER")).thenReturn(false);
        WorkflowParticipant participant = new WorkflowParticipant();
        participant.setActionStatus("PENDING");
        participant.setUser(user);
        when(workflowParticipantRepository
                .findByObjectTypeAndObjectIdAndParticipantTypeAndUser_Id(
                        "DOCUMENT_REVISION", revisionId, "REVIEWER", userId))
                .thenReturn(Optional.of(participant));

        assertTrue(service.isPendingReviewer(user, revision("PENDING_REVIEW")));
    }


    private UserAccount otherUser() {
        UserAccount other = new UserAccount();
        other.setId(UUID.randomUUID());
        other.setStatus(UserStatus.Active);
        return other;
    }

    @Test
    void genericEvaluator_supportsOtherResourceTypesWithoutModuleSpecificCode() {
        UUID trainingAssignmentId = UUID.randomUUID();
        WorkflowParticipant participant = new WorkflowParticipant();
        participant.setActionStatus("PENDING");
        when(workflowParticipantRepository
                .findByObjectTypeAndObjectIdAndParticipantTypeAndUser_Id(
                        "TRAINING_ASSIGNMENT", trainingAssignmentId, "TRAINEE", userId))
                .thenReturn(Optional.of(participant));

        assertTrue(service.isPendingGenericParticipant(
                "TRAINING_ASSIGNMENT", trainingAssignmentId, "TRAINEE", userId));
        assertFalse(service.isPendingGenericParticipant(
                "TRAINING_ASSIGNMENT", UUID.randomUUID(), "TRAINEE", userId));
    }
}
