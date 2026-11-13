package com.eqms.service;

import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * The notices that modules still raise as an e-mail message type (document review, approval, publish, controlled copy notices, knowledge sharing). Each is also a
 * registry event, so the Notifications Administration controls it like any other: {@link EmailNotificationService} sends a message of one of these types through
 * the registry event (the in-app notification and the e-mail, to the people the module names), and the wording is the one the event holds. The event is
 * created from the active e-mail message of the type when the system starts, and never overwritten afterwards. A message sent to an external e-mail address (no
 * user) and a message whose sender already names a registry event keep the way they were sent.
 */
public final class LegacyMessageEvents {

    /** @param messageType the type of the e-mail message the module raises */
    public record Event(String messageType, String code, String name, String module, String priority) {
    }

    private static final List<Event> ALL = List.of(
            new Event("document-review", "document.review_request", "Document Review Requested", "DOCUMENT_CONTROL", "MEDIUM"),
            new Event("document-approval", "document.approval_request", "Document Approval Requested", "DOCUMENT_CONTROL", "MEDIUM"),
            new Event("document-publish", "document.publish_notice", "Document Published (Message)", "DOCUMENT_CONTROL", "MEDIUM"),
            new Event("document-ready-for-publishing", "document.ready_for_publishing", "Document Ready for Publishing", "DOCUMENT_CONTROL", "MEDIUM"),
            new Event("document-ready-for-submission", "document.ready_for_submission", "Document Ready for Submission", "DOCUMENT_CONTROL", "MEDIUM"),
            new Event("document-revision-cancelled", "document.revision_cancelled", "Revision Cancelled", "DOCUMENT_CONTROL", "HIGH"),
            new Event("document-edit-online-notification", "document.edit_online", "Document Opened for Online Editing", "DOCUMENT_CONTROL", "LOW"),
            new Event("training-notification", "document.training_required", "Document Training Required", "DOCUMENT_CONTROL", "MEDIUM"),
            new Event("controlled-copy-notification", "controlled_copy.notice", "Controlled Copy Notice", "CONTROLLED_COPIES", "MEDIUM"),
            new Event("controlled-copy-cancellation-notification", "controlled_copy.cancel_notice", "Controlled Copy Cancelled", "CONTROLLED_COPIES", "MEDIUM"),
            new Event("controlled-copy-distribution-notification", "controlled_copy.distribution_notice", "Controlled Copy Distributed (Message)", "CONTROLLED_COPIES", "MEDIUM"),
            new Event("controlled-copy-recall-notification", "controlled_copy.recall_notice", "Controlled Copy Recalled (Message)", "CONTROLLED_COPIES", "HIGH"),
            new Event("controlled-copy-obsoleted-notification", "controlled_copy.obsoleted_notice", "Controlled Copy Obsoleted", "CONTROLLED_COPIES", "HIGH"),
            new Event("controlled-copy-expiry-notification", "controlled_copy.expiry_notice", "Controlled Copy Expiring Soon", "CONTROLLED_COPIES", "HIGH"),
            new Event("knowledge-share-notification", "knowledge.share_notice", "Knowledge Base Sharing by a Delegate", "KNOWLEDGE", "LOW"));

    private LegacyMessageEvents() {
    }

    public static List<Event> all() {
        return ALL;
    }

    /** The event of a message type, if the type has one. */
    public static Optional<Event> forMessageType(String messageType) {
        if (messageType == null) return Optional.empty();
        String type = messageType.trim().toLowerCase(Locale.ROOT);
        return ALL.stream().filter(e -> e.messageType().equals(type)).findFirst();
    }
}
