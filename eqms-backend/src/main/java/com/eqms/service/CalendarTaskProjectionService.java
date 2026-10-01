package com.eqms.service;

import com.eqms.dto.calendar.CalendarEventResponse;
import com.eqms.dto.security.RevisionWorkflowAuthorizationContext;
import com.eqms.entity.*;
import com.eqms.enums.RevisionWorkflowAction;
import com.eqms.repository.*;
import org.springframework.stereotype.Service;
import java.time.*;
import java.util.*;

/** Read-only projection. Reading a notification is deliberately never evidence of completing work. */
@Service
public class CalendarTaskProjectionService {
    private final DocumentRevisionRepository revisions;
    private final RevisionWorkflowHistoryRepository history;
    private final WorkflowParticipantRepository participants;
    private final DocumentAuthorizationService objects;
    private final RevisionWorkflowAuthorizationService workflow;

    public CalendarTaskProjectionService(DocumentRevisionRepository revisions, RevisionWorkflowHistoryRepository history,
            WorkflowParticipantRepository participants, DocumentAuthorizationService objects,
            RevisionWorkflowAuthorizationService workflow) {
        this.revisions = revisions; this.history = history; this.participants = participants;
        this.objects = objects; this.workflow = workflow;
    }

    private record Task(String kind, String role, RevisionWorkflowAction action, Set<String> completion,
                        String stage, String label, String route) { }
    private Task task(String type) {
        if (type == null) return null;
        return switch (type) {
            case "document-review" -> new Task("REVIEW", "REVIEWER", RevisionWorkflowAction.COMPLETE_REVIEW,
                    Set.of("REVIEW_COMPLETE", "REVIEW_REJECT"), "PENDING_REVIEW", "Review document", "review/");
            case "document-approval" -> new Task("APPROVAL", "APPROVER", RevisionWorkflowAction.COMPLETE_APPROVAL,
                    Set.of("APPROVE_COMPLETE", "APPROVE_REJECT"), "PENDING_APPROVAL", "Approve document", "approval/");
            case "document-edit-online-notification", "document-review-rejected", "document-approval-rejected" ->
                    new Task("AUTHORING", "CO_AUTHOR", RevisionWorkflowAction.COMPLETE_AUTHORING,
                    Set.of("COMPLETE_EDITING"), "DRAFT", "Continue authoring", "edit/");
            case "document-ready-for-submission" -> new Task("SUBMISSION", "AUTHOR", RevisionWorkflowAction.SUBMIT_FOR_REVIEW,
                    Set.of("SUBMIT_FOR_REVIEW"), "DRAFT", "Submit for review", "");
            case "document-ready-for-publishing" -> new Task("PUBLISHING", "PUBLISHER", RevisionWorkflowAction.OPEN_PUBLISHING_WORKSPACE,
                    Set.of("PUBLISH"), "READY_FOR_PUBLISHING", "Open publishing", null);
            default -> null;
        };
    }

    public List<CalendarEventResponse> project(UserAccount user, List<UserNotification> notifications, ZoneId zone) {
        Map<UUID, Optional<DocumentRevisionRecord>> records = new HashMap<>();
        Map<UUID, List<RevisionWorkflowHistory>> histories = new HashMap<>();
        List<CalendarEventResponse> result = new ArrayList<>();
        for (UserNotification notification : notifications) {
            // Defense in depth: no foreign-recipient data even if a caller supplies an unscoped list.
            if (notification.getRecipientUser() == null || !Objects.equals(user.getId(), notification.getRecipientUser().getId())
                    || notification.getDeletedAt() != null) continue;
            Task task = task(notification.getType());
            UUID id = revisionId(notification);
            CalendarEventResponse item = notice(notification, zone);
            if (task != null && id != null) {
                DocumentRevisionRecord revision = records.computeIfAbsent(id, revisions::findById).orElse(null);
                if (revision != null && objects.canViewRevision(user, revision)) {
                    List<RevisionWorkflowHistory> actions = histories.computeIfAbsent(id, history::findAllByRevision_IdOrderByCreatedAtAsc);
                    boolean completed = actions.stream().anyMatch(h -> h.getActedBy() != null
                            && Objects.equals(user.getId(), h.getActedBy().getId()) && h.getCreatedAt() != null
                            && !h.getCreatedAt().isBefore(notification.getCreatedAt()) && task.completion().contains(h.getActionType()));
                    boolean assigned = "PUBLISHER".equals(task.role()) ? false :
                            workflow.isRevisionAuthor(user, revision) && Set.of("AUTHOR", "CO_AUTHOR").contains(task.role())
                            || participants.findByObjectTypeAndObjectIdAndParticipantTypeAndUser_Id(
                                    "DOCUMENT_REVISION", id, task.role(), user.getId()).isPresent();
                    var decision = workflow.check(user, revision, task.action(), RevisionWorkflowAuthorizationContext.of(revision));
                    boolean template = "PUBLISHER".equals(task.role()) && revision.getDocument() != null && revision.getDocument().isTemplate();
                    if (template)
                        decision = workflow.check(user, revision, RevisionWorkflowAction.PUBLISH, RevisionWorkflowAuthorizationContext.of(revision));
                    // Publishing is permission-based, not an invented participant role. Engine is the authority.
                    if (completed || assigned || ("PUBLISHER".equals(task.role()) && decision.allowed())) {
                        String stage = revision.getStatus() == null ? "" : revision.getStatus().getCode();
                        String status = completed ? "COMPLETED" : decision.allowed() ? "PENDING"
                                : task.stage().equals(stage) ? "WAITING" : "UNAVAILABLE";
                        String url = completed || !decision.allowed() || template ? "/documents/revisions/" + id : task.route() == null
                                ? "/documents/revisions/" + id + "/publishing" : "/documents/revisions/" + task.route() + id;
                        item = new CalendarEventResponse(item.id(), "EQMS", task.kind(), notification.getTitle(),
                                revision.getDocumentNumber() + " · " + revision.getRevisionName(), item.start(), item.end(),
                                false, false, null, url, "TASK", status, completed || !decision.allowed() ? "View record" : template ? "Open document" : task.label());
                    }
                }
            }
            result.add(item);
        }
        return result;
    }

    private UUID revisionId(UserNotification n) {
        try {
            if (n.getMetadata() != null && n.getMetadata().hasNonNull("revisionId"))
                return UUID.fromString(n.getMetadata().get("revisionId").asText());
            return "revision".equalsIgnoreCase(n.getRelatedEntityType()) ? n.getRelatedEntityId() : null;
        } catch (IllegalArgumentException ignored) { return null; }
    }
    private CalendarEventResponse notice(UserNotification n, ZoneId zone) {
        LocalDateTime start = LocalDateTime.ofInstant(n.getCreatedAt(), zone);
        return new CalendarEventResponse("notification:" + n.getId(), "NOTIFICATION", n.getType(), n.getTitle(), n.getMessage(),
                start, start.plusSeconds(1), false, false, null, "/notifications", "NOTIFICATION", null, "Open notifications");
    }
}
