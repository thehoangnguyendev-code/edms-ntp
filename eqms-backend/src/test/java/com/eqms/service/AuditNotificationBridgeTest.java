package com.eqms.service;

import com.eqms.entity.UserAccount;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doThrow;

/**
 * NOTIFICATION-ADMIN-2026-11-12, notifications raised by what the Audit Trail records: which action raises which event, who is told by default, and that the
 * bridge dispatches the event with the person who acted and never lets a failure reach the business change.
 */
class AuditNotificationBridgeTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    private static UserAccount person(String name) {
        UserAccount user = mock(UserAccount.class);
        when(user.getId()).thenReturn(UUID.randomUUID());
        when(user.getFullName()).thenReturn(name);
        return user;
    }

    @Test
    void anActionIsFoundByItsRecordKindWhateverTheCaseOrSpacingAndByItsActionCode() {
        assertThat(AuditNotificationEvents.forAction("BACKUP_RESTORE", "RESTORE_REQUESTED")).extracting(AuditNotificationEvents.Event::code).containsExactly("backup.restore_requested");
        assertThat(AuditNotificationEvents.forAction("Controlled Copy", "REQUEST")).extracting(AuditNotificationEvents.Event::code).containsExactly("controlled_copy.requested");
        assertThat(AuditNotificationEvents.forAction("controlled-copy-distribution-batch", "request")).extracting(AuditNotificationEvents.Event::code).containsExactly("controlled_copy.requested");
        // one action may raise two events: the people who manage it and the person it concerns
        assertThat(AuditNotificationEvents.forAction("ACCESS_REVIEW", "ACCESS_REVIEW_CAMPAIGN_CREATED")).extracting(AuditNotificationEvents.Event::code)
                .containsExactlyInAnyOrder("access_review.campaign_changed", "access_review.campaign_assigned");
        assertThat(AuditNotificationEvents.forAction("DOCUMENT", "REQUEST")).isEmpty();      // the same action code on another kind of record is not this event
        assertThat(AuditNotificationEvents.forAction("BACKUP_RESTORE", "SOMETHING_ELSE")).isEmpty();
        assertThat(AuditNotificationEvents.forAction(null, null)).isEmpty();
    }

    @Test
    void everyEventIsWellFormedAndNoActionOnARecordKindRaisesTwoEvents() {
        var events = AuditNotificationEvents.all();
        assertThat(events.stream().map(AuditNotificationEvents.Event::code)).doesNotHaveDuplicates();
        Set<String> seen = new HashSet<>();
        for (var event : events) {
            assertThat(event.name()).isNotBlank();
            assertThat(event.description()).isNotBlank();
            assertThat(event.priority()).isIn("LOW", "MEDIUM", "HIGH", "CRITICAL");
            assertThat(event.defaultStatus()).isIn("ACTIVE", "DISABLED");
            assertThat(event.actionUrl()).startsWith("/");
            assertThat(event.rules()).as("who is told by default: " + event.code()).isNotEmpty();
            // the default recipients are rules the dispatcher can resolve
            ArrayNode rules = JSON.createArrayNode();
            event.rules().forEach(rule -> {
                var node = rules.addObject().put("type", rule.type());
                if (rule.value() != null) node.put("value", rule.value());
            });
            NotificationRecipientRules.validate(rules);
            for (String type : event.entityTypes()) {
                for (String action : event.actions()) {
                    assertThat(seen.add(event.code() + "|" + type + "|" + action)).as(event.code() + " lists " + type + " " + action + " twice").isTrue();
                }
            }
        }
        // an event raised very often is off until an administrator turns it on
        assertThat(events).filteredOn(e -> "DISABLED".equals(e.defaultStatus())).extracting(AuditNotificationEvents.Event::code).containsExactlyInAnyOrder("system.configuration_changed", "document.legacy_import_finished", "document.editing_lock_changed");
    }

    @Test
    void theBridgeDispatchesTheEventWithTheWordsOfTheActionAndThePersonWhoActed() {
        var dispatcher = mock(NotificationDispatcher.class);
        var bridge = new AuditNotificationBridge(dispatcher, null, null);
        UserAccount actor = person("Nguyen Van A");

        bridge.onAuditedAction(new AuditNotificationBridge.AuditedAction(actor, "BACKUP_RESTORE", "RS-0001", UUID.randomUUID(), "RESTORE_REQUESTED", "for the rehearsal"));

        ArgumentCaptor<Map<String, String>> variables = ArgumentCaptor.forClass(Map.class);
        verify(dispatcher).dispatchIndependently(eq("backup.restore_requested"), eq(List.of(actor)), variables.capture());
        assertThat(variables.getValue()).containsEntry("title", "Restore requested").containsEntry("actorName", "Nguyen Van A").containsEntry("entityName", "RS-0001")
                .containsEntry("actionName", "Restore requested").containsEntry("actionComment", "for the rehearsal").containsEntry("actionUrl", "/settings/administration/backup/restore");
        assertThat(variables.getValue().get("message")).isEqualTo("Nguyen Van A - RS-0001: for the rehearsal");
    }

    @Test
    void theNameOfTheRecordIsAlsoGivenAsCampaignNameForTheWordingOfTheCampaignEvents() {
        var dispatcher = mock(NotificationDispatcher.class);
        var bridge = new AuditNotificationBridge(dispatcher, null, null);
        UserAccount actor = person("Nguyen Van A");

        bridge.onAuditedAction(new AuditNotificationBridge.AuditedAction(actor, "BACKUP_RESTORE", "Q3 Review", UUID.randomUUID(), "RESTORE_REQUESTED", ""));

        ArgumentCaptor<Map<String, String>> variables = ArgumentCaptor.forClass(Map.class);
        verify(dispatcher).dispatchIndependently(anyString(), any(), variables.capture());
        assertThat(variables.getValue()).containsEntry("campaignName", "Q3 Review").containsEntry("entityName", "Q3 Review");
    }

    @Test
    void anActionThatRaisesNothingDispatchesNothing() {
        var dispatcher = mock(NotificationDispatcher.class);
        new AuditNotificationBridge(dispatcher, null, null).onAuditedAction(new AuditNotificationBridge.AuditedAction(person("A"), "DOCUMENT", "SOP.0001", null, "CANCEL", null));
        verify(dispatcher, never()).dispatchIndependently(anyString(), any(), any());
    }

    @Test
    void aFailureToNotifyNeverReachesTheBusinessChange() {
        var dispatcher = mock(NotificationDispatcher.class);
        doThrow(new IllegalStateException("database down")).when(dispatcher).dispatchIndependently(anyString(), any(), any());
        new AuditNotificationBridge(dispatcher, null, null).onAuditedAction(new AuditNotificationBridge.AuditedAction(person("A"), "BACKUP_RESTORE", "RS-1", null, "RESTORE_REQUESTED", null));
    }

    @Test
    void aStatusOrReasonNamedByItsCodeInTheAuditCommentIsToldInWordsBeforeTheCommentIsCut() {
        var dispatcher = mock(NotificationDispatcher.class);
        new AuditNotificationBridge(dispatcher, null, null).onAuditedAction(new AuditNotificationBridge.AuditedAction(person("A"), "BACKUP_RESTORE", "RS-1", null, "RESTORE_REQUESTED",
                "Not published: the revision is READY_FOR_PUBLISHING; Reason: DOCUMENT_OBSOLETED"));
        ArgumentCaptor<Map<String, String>> variables = ArgumentCaptor.forClass(Map.class);
        verify(dispatcher).dispatchIndependently(anyString(), any(), variables.capture());
        assertThat(variables.getValue().get("actionComment")).isEqualTo("Not published: the revision is Ready for Publishing; Reason: Document Obsoleted");
        assertThat(variables.getValue().get("message")).doesNotContain("READY_FOR_PUBLISHING").doesNotContain("DOCUMENT_OBSOLETED");
    }

    @Test
    void aLongCommentIsCutSoThatTheStoredWordingFitsTheNotification() {
        var dispatcher = mock(NotificationDispatcher.class);
        new AuditNotificationBridge(dispatcher, null, null).onAuditedAction(new AuditNotificationBridge.AuditedAction(person("A"), "BACKUP_RESTORE", "RS-1", null, "RESTORE_REQUESTED", "x".repeat(2000)));
        ArgumentCaptor<Map<String, String>> variables = ArgumentCaptor.forClass(Map.class);
        verify(dispatcher).dispatchIndependently(anyString(), any(), variables.capture());
        assertThat(variables.getValue().get("message").length()).isLessThanOrEqualTo(480);
        assertThat(variables.getValue().get("actionComment")).hasSize(300).endsWith("...");
    }

    @Test
    void anEventThatNamesTheRequesterOfTheRecordTellsThemAndNotThePersonWhoActed() {
        var dispatcher = mock(NotificationDispatcher.class);
        var jdbc = mock(org.springframework.jdbc.core.JdbcTemplate.class);
        var users = mock(com.eqms.repository.UserAccountRepository.class);
        UserAccount approver = person("Approver");
        UserAccount requester = person("Requester");
        UUID copy = UUID.randomUUID();
        UUID requesterId = requester.getId();
        UUID approverId = approver.getId();
        when(jdbc.queryForList(anyString(), eq(UUID.class), eq(copy))).thenReturn(List.of(requesterId, approverId));
        when(users.findAllById(List.of(requesterId))).thenReturn(List.of(requester));

        new AuditNotificationBridge(dispatcher, jdbc, users).onAuditedAction(new AuditNotificationBridge.AuditedAction(approver, "Controlled Copy", "CC-1", copy, "APPROVE", null));

        verify(dispatcher).dispatchIndependently(eq("controlled_copy.request_decided"), eq(List.of(requester)), any());
    }

    @Test
    void aRecordWhoseRequesterCannotBeFoundIsToldToNobodyByTheOwnerRule() {
        var dispatcher = mock(NotificationDispatcher.class);
        var jdbc = mock(org.springframework.jdbc.core.JdbcTemplate.class);
        when(jdbc.queryForList(anyString(), eq(UUID.class), any(UUID.class))).thenThrow(new IllegalStateException("no such table"));
        new AuditNotificationBridge(dispatcher, jdbc, mock(com.eqms.repository.UserAccountRepository.class))
                .onAuditedAction(new AuditNotificationBridge.AuditedAction(person("A"), "Controlled Copy", "CC-1", UUID.randomUUID(), "APPROVE", null));
        verify(dispatcher).dispatchIndependently(eq("controlled_copy.request_decided"), eq(List.of()), any());
    }

    @Test
    void theRequesterOfABackupRequestIsFoundFromTheAuditRowThatRecordedTheRequest() {
        var restore = AuditNotificationEvents.forAction("BACKUP_RESTORE", "RESTORE_APPROVED").getFirst();
        assertThat(restore.contextSql()).contains("audit_logs").contains("RESTORE_REQUESTED").contains("entity_id = ?");
        assertThat(restore.rules()).extracting(AuditNotificationEvents.Rule::type).containsExactly("OWNER", "PERMISSION");
        assertThat(AuditNotificationEvents.forAction("BACKUP_EXPORT", "BACKUP_EXPORT_APPROVED").getFirst().contextSql()).contains("BACKUP_EXPORT_REQUESTED");
        assertThat(AuditNotificationEvents.forAction("BACKUP_INSPECTION", "INSPECTION_APPROVED").getFirst().contextSql()).contains("INSPECTION_REQUESTED");
    }

    @Test
    void aQueryThatNamesTheRecordTwiceIsGivenItsIdForEachPlace() {
        var dispatcher = mock(NotificationDispatcher.class);
        var jdbc = mock(org.springframework.jdbc.core.JdbcTemplate.class);
        var users = mock(com.eqms.repository.UserAccountRepository.class);
        UUID revision = UUID.randomUUID();
        UserAccount author = person("Author");
        UUID authorId = author.getId();
        when(jdbc.queryForList(anyString(), eq(UUID.class), eq(revision), eq(revision))).thenReturn(List.of(authorId));
        when(users.findAllById(List.of(authorId))).thenReturn(List.of(author));

        new AuditNotificationBridge(dispatcher, jdbc, users).onAuditedAction(new AuditNotificationBridge.AuditedAction(person("Reviewer"), "Revision", "SOP.0001", revision, "REVIEW_COMMENT_ADDED", "Please check"));

        verify(dispatcher).dispatchIndependently(eq("document.review_comment"), eq(List.of(author)), any());
    }

    @Test
    void oneFailingEventDoesNotStopTheOthersOfTheSameAction() {
        var dispatcher = mock(NotificationDispatcher.class);
        doThrow(new IllegalStateException("database down")).when(dispatcher).dispatchIndependently(eq("access_review.campaign_changed"), any(), any());
        new AuditNotificationBridge(dispatcher, null, null).onAuditedAction(new AuditNotificationBridge.AuditedAction(person("A"), "ACCESS_REVIEW", "Q3", UUID.randomUUID(), "ACCESS_REVIEW_CAMPAIGN_CREATED", null));
        verify(dispatcher).dispatchIndependently(eq("access_review.campaign_assigned"), any(), any());
    }

    /** REPORT-TEMPLATE-REJECT-NOTICE-2026-11-15: the approver rejects a revision with a reason; the person who wrote it is told, in the application and by e-mail. */
    @Test
    void aRejectedReportTemplateIsToldToItsAuthorWithTheReasonAndNotToTheApprover() {
        var events = AuditNotificationEvents.forAction("REPORT_DEFINITION", "REPORT_TEMPLATE_REJECTED");
        assertThat(events).extracting(AuditNotificationEvents.Event::code).containsExactly("report.template_rejected");
        assertThat(events.getFirst().rules()).extracting(AuditNotificationEvents.Rule::type).containsExactly("OWNER");
        assertThat(events.getFirst().contextSql()).contains("audit_logs").contains("entity_id = ?").contains("REPORT_TEMPLATE_UPDATED").contains("REPORT_TEMPLATE_REVISION_UPDATED");
        // in the application and by e-mail from the start
        assertThat(NotificationDefaultChannels.of("report.template_rejected", "IN_APP,EMAIL")).isEqualTo("IN_APP,EMAIL");

        var dispatcher = mock(NotificationDispatcher.class);
        var jdbc = mock(org.springframework.jdbc.core.JdbcTemplate.class);
        var users = mock(com.eqms.repository.UserAccountRepository.class);
        UserAccount author = person("Author");
        UserAccount approver = person("Approver");
        UUID template = UUID.randomUUID();
        UUID authorId = author.getId();
        UUID approverId = approver.getId();
        when(jdbc.queryForList(anyString(), eq(UUID.class), eq(template))).thenReturn(List.of(authorId, approverId));
        when(users.findAllById(List.of(authorId))).thenReturn(List.of(author));

        new AuditNotificationBridge(dispatcher, jdbc, users).onAuditedAction(new AuditNotificationBridge.AuditedAction(approver, "REPORT_DEFINITION", "RPT.0039", template,
                "REPORT_TEMPLATE_REJECTED", "Add the department column before it is used for decisions [signature SIG-2026-0001]"));

        ArgumentCaptor<Map<String, String>> variables = ArgumentCaptor.forClass(Map.class);
        verify(dispatcher).dispatchIndependently(eq("report.template_rejected"), eq(List.of(author)), variables.capture());
        assertThat(variables.getValue()).containsEntry("actionName", "Report template rejected").containsEntry("entityName", "RPT.0039").containsEntry("actorName", "Approver")
                .containsEntry("actionComment", "Add the department column before it is used for decisions");
        assertThat(variables.getValue().get("message")).doesNotContain("signature");
        // nobody else is told by the event that tells the people who manage templates
        verify(dispatcher, never()).dispatchIndependently(eq("report.template_decided"), any(), any());
    }
}
