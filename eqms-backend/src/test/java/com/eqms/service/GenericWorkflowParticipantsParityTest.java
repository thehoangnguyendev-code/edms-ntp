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
                auditTrailService, workflowParticipantRepository, authorizationEngineService);
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
