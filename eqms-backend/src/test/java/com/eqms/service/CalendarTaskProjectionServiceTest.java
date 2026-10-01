package com.eqms.service;

import com.eqms.dto.security.WorkflowAuthorizationDecision;
import com.eqms.entity.*;
import com.eqms.enums.RevisionWorkflowAction;
import com.eqms.repository.*;
import org.junit.jupiter.api.*;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class CalendarTaskProjectionServiceTest {
    DocumentRevisionRepository revisions;
    RevisionWorkflowHistoryRepository history;
    WorkflowParticipantRepository participants;
    DocumentAuthorizationService objects;
    RevisionWorkflowAuthorizationService workflow;
    CalendarTaskProjectionService service;
    UserAccount user;
    DocumentRevisionRecord revision;
    UserNotification notice;
    UUID id;
    Instant received = Instant.parse("2026-09-30T18:00:00Z");

    @BeforeEach void setup() {
        revisions = mock(DocumentRevisionRepository.class); history = mock(RevisionWorkflowHistoryRepository.class);
        participants = mock(WorkflowParticipantRepository.class); objects = mock(DocumentAuthorizationService.class);
        workflow = mock(RevisionWorkflowAuthorizationService.class);
        service = new CalendarTaskProjectionService(revisions, history, participants, objects, workflow);
        user = new UserAccount(); user.setId(UUID.randomUUID()); id = UUID.randomUUID();
        revision = mock(DocumentRevisionRecord.class); when(revision.getId()).thenReturn(id);
        when(revision.getDocumentNumber()).thenReturn("SOP.001"); when(revision.getRevisionName()).thenReturn("Revision A");
        notice = new UserNotification(); notice.setId(UUID.randomUUID()); notice.setRecipientUser(user);
        notice.setCreatedAt(received); notice.setType("document-review"); notice.setTitle("Review assigned");
        notice.setRelatedEntityType("revision"); notice.setRelatedEntityId(id);
        when(revisions.findById(id)).thenReturn(Optional.of(revision)); when(objects.canViewRevision(user, revision)).thenReturn(true);
        when(participants.findByObjectTypeAndObjectIdAndParticipantTypeAndUser_Id("DOCUMENT_REVISION", id, "REVIEWER", user.getId()))
                .thenReturn(Optional.of(new WorkflowParticipant()));
        when(workflow.check(eq(user), eq(revision), any(), any())).thenReturn(
                WorkflowAuthorizationDecision.allowed(RevisionWorkflowAction.COMPLETE_REVIEW, id, "PENDING_REVIEW", false, false));
    }
    private com.eqms.dto.calendar.CalendarEventResponse result() {
        return service.project(user, List.of(notice), ZoneId.of("UTC+7")).getFirst();
    }
    private RevisionWorkflowHistory action(UserAccount actor, Instant date, String kind) {
        var action = new RevisionWorkflowHistory(); action.setActedBy(actor); action.setCreatedAt(date); action.setActionType(kind);
        return action;
    }
    @Test void receiptDayNotDeadlineAndActionComesFromServer() {
        var item = result(); assertEquals(LocalDate.of(2026,10,1), item.start().toLocalDate());
        assertEquals("TASK", item.category()); assertEquals("PENDING", item.taskStatus());
        assertEquals("/documents/revisions/review/" + id, item.actionUrl());
    }
    @Test void readingNotificationDoesNotCompleteTask() {
        notice.setStatus("read"); notice.setReadAt(received.plusSeconds(1));
        assertEquals("PENDING", result().taskStatus());
    }
    @Test void ownLaterWorkflowActionCompletesWithoutMovingReceiptDay() {
        when(history.findAllByRevision_IdOrderByCreatedAtAsc(id)).thenReturn(List.of(action(user, received.plusSeconds(86400), "REVIEW_COMPLETE")));
        var item = result(); assertEquals("COMPLETED", item.taskStatus());
        assertEquals(LocalDate.of(2026,10,1), item.start().toLocalDate()); assertEquals("View record", item.actionLabel());
    }
    @Test void earlierRoundAndOtherActorCannotCompleteTask() {
        UserAccount other = new UserAccount(); other.setId(UUID.randomUUID());
        when(history.findAllByRevision_IdOrderByCreatedAtAsc(id)).thenReturn(List.of(
                action(user, received.minusSeconds(1), "REVIEW_COMPLETE"), action(other, received.plusSeconds(1), "REVIEW_COMPLETE")));
        assertEquals("PENDING", result().taskStatus());
    }
    @Test void anotherRecipientsDataNeverDisclosed() {
        UserAccount other = new UserAccount(); other.setId(UUID.randomUUID()); notice.setRecipientUser(other);
        assertTrue(service.project(user, List.of(notice), ZoneId.of("UTC+7")).isEmpty()); verifyNoInteractions(revisions);
    }
    @Test void invisibleRevisionIsNotEnrichedOrTurnedIntoTask() {
        when(objects.canViewRevision(user, revision)).thenReturn(false);
        assertEquals("NOTIFICATION", result().category()); verifyNoInteractions(history, participants, workflow);
    }
    @Test void unknownCodeDoesNotInferTaskFromTitle() {
        notice.setType("informational"); notice.setTitle("Please review and approve");
        assertEquals("NOTIFICATION", result().category()); verifyNoInteractions(revisions);
    }
    @Test void deniedActionIsViewOnlyWithoutFakeSuccess() {
        when(workflow.check(eq(user), eq(revision), any(), any())).thenReturn(
                WorkflowAuthorizationDecision.denied("STATUS_CHANGED", "Denied", null, RevisionWorkflowAction.COMPLETE_REVIEW, id, "CANCELLED"));
        var item = result(); assertEquals("UNAVAILABLE", item.taskStatus()); assertEquals("View record", item.actionLabel());
    }
    @Test void deletedNotificationExcluded() {
        notice.setDeletedAt(received.plusSeconds(1));
        assertTrue(service.project(user, List.of(notice), ZoneId.of("UTC+7")).isEmpty());
    }
    @Test void broadAdminPermissionDoesNotInventReviewerAssignment() {
        when(participants.findByObjectTypeAndObjectIdAndParticipantTypeAndUser_Id(anyString(), any(), anyString(), any())).thenReturn(Optional.empty());
        assertEquals("NOTIFICATION", result().category());
    }
    @Test void nextReviewerWaitsRatherThanBeingMarkedCompleted() {
        var status = new RevisionStatusDefinition(); status.setCode("PENDING_REVIEW"); when(revision.getStatus()).thenReturn(status);
        when(workflow.check(eq(user), eq(revision), any(), any())).thenReturn(
                WorkflowAuthorizationDecision.denied("NOT_NEXT_PARTICIPANT", "Wait", null, RevisionWorkflowAction.COMPLETE_REVIEW, id, "PENDING_REVIEW"));
        assertEquals("WAITING", result().taskStatus()); assertEquals("View record", result().actionLabel());
    }
    @Test void authoringTaskCompletesOnlyWithAuthoringEvidence() {
        notice.setType("document-edit-online-notification"); when(workflow.isRevisionAuthor(user, revision)).thenReturn(true);
        when(history.findAllByRevision_IdOrderByCreatedAtAsc(id)).thenReturn(List.of(action(user, received.plusSeconds(1), "COMPLETE_EDITING")));
        assertEquals("COMPLETED", result().taskStatus()); assertEquals("AUTHORING", result().kind());
    }
    @Test void approvalTaskUsesApprovalHistoryAndRoute() {
        notice.setType("document-approval");
        when(participants.findByObjectTypeAndObjectIdAndParticipantTypeAndUser_Id("DOCUMENT_REVISION", id, "APPROVER", user.getId())).thenReturn(Optional.of(new WorkflowParticipant()));
        assertEquals("/documents/revisions/approval/" + id, result().actionUrl());
        when(history.findAllByRevision_IdOrderByCreatedAtAsc(id)).thenReturn(List.of(action(user, received.plusSeconds(1), "APPROVE_COMPLETE")));
        assertEquals("COMPLETED", result().taskStatus());
    }
}
