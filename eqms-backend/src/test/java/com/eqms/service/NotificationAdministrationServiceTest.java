package com.eqms.service;

import com.eqms.dto.notification.NotificationPolicySummaryResponse;
import com.eqms.dto.user.PageResponse;
import com.eqms.dto.user.PaginationResponse;
import com.eqms.entity.EmailTemplate;
import com.eqms.repository.EmailTemplateRepository;
import com.eqms.service.NotificationAdministrationService.Query;
import com.eqms.service.NotificationAdministrationService.Row;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** NOTIFICATION-ADMIN-2026-11-12: one list of in-app notifications and email messages, with the channel as a filter. */
class NotificationAdministrationServiceTest {

    private NotificationPolicyService policies;
    private EmailTemplateRepository emails;
    private NotificationAdministrationService service;

    private static NotificationPolicySummaryResponse event(String code, String name, String module, String status, Instant updated) {
        return new NotificationPolicySummaryResponse(code, name, "About " + name, module, "HIGH", "IN_APP", status, "IN_APP", false, updated);
    }

    private static EmailTemplate email(String name, String type, String status, int sent, Instant updated) {
        EmailTemplate t = org.mockito.Mockito.spy(new EmailTemplate());
        t.setName(name);
        t.setType(type);
        t.setStatus(status);
        t.setDescription("Mail " + name);
        org.mockito.Mockito.doReturn(UUID.nameUUIDFromBytes(name.getBytes())).when(t).getId();
        org.mockito.Mockito.doReturn(sent).when(t).getUsageCount();
        org.mockito.Mockito.doReturn(updated).when(t).getUpdatedDate();
        return t;
    }

    private static Query query(String channel, String status, String module, String type, String usage, String from, String to, String search) {
        return new Query(search, channel, status, module, type, usage, from, to, "name", "asc", 1, 50);
    }

    @BeforeEach
    void setUp() {
        policies = mock(NotificationPolicyService.class);
        emails = mock(EmailTemplateRepository.class);
        service = new NotificationAdministrationService(policies, emails, null);
        var events = List.of(
                event("document.approved", "Document Approved", "DOCUMENT_CONTROL", "ACTIVE", Instant.parse("2026-11-10T05:00:00Z")),
                event("controlled_copy.recalled", "Controlled Copy Recalled", "CONTROLLED_COPIES", "DISABLED", Instant.parse("2026-10-01T05:00:00Z")));
        when(policies.list(any(), any(), any(), any(), any(), any(), anyInt(), anyInt()))
                .thenReturn(new PageResponse<>(events, new PaginationResponse(1, 2, 2, 1)));
        // built first: a stub made while another is being set up is refused
        var reset = email("Password Reset Link", "password-reset", "Active", 5, Instant.parse("2026-11-11T05:00:00Z"));
        var review = email("Review Request", "document-misc", "Draft", 0, Instant.parse("2026-09-01T05:00:00Z"));
        when(emails.findAll()).thenReturn(List.of(reset, review));
    }

    private static List<String> names(PageResponse<Row> page) {
        return page.data().stream().map(Row::name).toList();
    }

    @Test
    void theFirstListHoldsBothKindsAndEachChannelListHoldsItsOwn() {
        assertThat(names(service.list(query(null, null, null, null, null, null, null, null), true, true)))
                .containsExactly("Controlled Copy Recalled", "Document Approved", "Password Reset Link", "Review Request", "Review Request");
        // a message that is also an in-app notification (Review Request) is in both channel lists; a message that is only an e-mail (Password Reset Link) is in one
        assertThat(names(service.list(query("IN_APP", null, null, null, null, null, null, null), true, true)))
                .containsExactly("Controlled Copy Recalled", "Document Approved", "Review Request");
        assertThat(names(service.list(query("EMAIL", null, null, null, null, null, null, null), true, true)))
                .containsExactly("Password Reset Link", "Review Request");
    }

    @Test
    void anEventThatCanBeSentByEmailIsListedOnceForEachChannelAndEachRowSaysWhetherItSendsOnItsChannel() {
        var both = new NotificationPolicySummaryResponse("document.expired", "Document Expired", "About it", "DOCUMENT_CONTROL", "HIGH", "IN_APP,EMAIL", "ACTIVE", "IN_APP",
                false, Instant.parse("2026-11-10T05:00:00Z"));
        var off = new NotificationPolicySummaryResponse("document.obsoleted", "Document Obsoleted", "About it", "DOCUMENT_CONTROL", "HIGH", "IN_APP,EMAIL", "DISABLED", "IN_APP,EMAIL",
                false, Instant.parse("2026-11-10T05:00:00Z"));
        when(policies.list(any(), any(), any(), any(), any(), any(), anyInt(), anyInt())).thenReturn(new PageResponse<>(List.of(both, off), new PaginationResponse(1, 2, 2, 1)));
        when(emails.findAll()).thenReturn(List.of());

        var rows = service.list(query(null, null, null, null, null, null, null, null), true, true).data();
        assertThat(rows).extracting(r -> r.code() + ":" + r.channel() + ":" + r.status()).containsExactlyInAnyOrder(
                "document.expired:IN_APP:ACTIVE", "document.expired:EMAIL:INACTIVE",        // active, but sent in-app only
                "document.obsoleted:IN_APP:INACTIVE", "document.obsoleted:EMAIL:INACTIVE"); // switched off
        assertThat(service.list(query("EMAIL", null, null, null, null, null, null, null), true, true).data()).extracting(Row::channel).containsOnly("EMAIL").hasSize(2);
        assertThat(service.list(query("IN_APP", "active", null, null, null, null, null, null), true, true).data()).extracting(Row::code).containsExactly("document.expired");
    }

    @Test
    void anEventIsDisabledWhereAnEmailMessageIsInactiveAndBothAnswerToOneStatus() {
        assertThat(service.list(query(null, null, null, null, null, null, null, null), true, true).data())
                .filteredOn(r -> r.name().equals("Controlled Copy Recalled")).extracting(Row::status).containsExactly("INACTIVE");
        assertThat(names(service.list(query(null, "inactive", null, null, null, null, null, null), true, true))).containsExactly("Controlled Copy Recalled");
        assertThat(names(service.list(query(null, "Draft", null, null, null, null, null, null), true, true))).containsExactly("Review Request", "Review Request");
    }

    @Test
    void aMessageThatProducesAnInAppNotificationIsListedAmongTheInAppNotificationsAndOpensItsMessage() {
        var inApp = service.list(query("IN_APP", null, null, null, null, null, null, "review request"), true, true).data();
        assertThat(inApp).singleElement().satisfies(row -> {
            assertThat(row.channel()).isEqualTo("IN_APP");
            assertThat(row.type()).isEqualTo("document-misc");   // the screen opens the e-mail message that holds the wording
            assertThat(row.module()).isEqualTo("DOCUMENT_CONTROL");
            assertThat(row.description()).startsWith("The in-app text is taken from this e-mail message.");
        });
        assertThat(NotificationAdministrationService.producesInAppNotification("password-reset")).isFalse();
        assertThat(NotificationAdministrationService.producesInAppNotification("account-activation")).isFalse();
        assertThat(NotificationAdministrationService.producesInAppNotification("preference-notification")).isTrue();
        // a message that is a registry event is listed as that event, not twice
        assertThat(NotificationAdministrationService.producesInAppNotification("controlled-copy-recall-notification")).isFalse();
        assertThat(NotificationAdministrationService.moduleOfType("controlled-copy-recall-notification")).isEqualTo("CONTROLLED_COPIES");
        assertThat(NotificationAdministrationService.moduleOfType("training-notification")).isEqualTo("TRAINING");
        assertThat(NotificationAdministrationService.moduleOfType("preference-notification")).isEqualTo("SYSTEM");
    }

    @Test
    void aFilterThatOnlyOneKindHasLeavesOutTheOtherKind() {
        assertThat(names(service.list(query(null, null, "DOCUMENT_CONTROL", null, null, null, null, null), true, true))).containsExactly("Document Approved", "Review Request");
        assertThat(names(service.list(query(null, null, null, "password-reset", null, null, null, null), true, true))).containsExactly("Password Reset Link");
        assertThat(names(service.list(query(null, null, null, null, "NEVER_SENT", null, null, null), true, true))).containsExactly("Controlled Copy Recalled", "Document Approved", "Review Request", "Review Request");
        assertThat(names(service.list(query(null, null, null, null, "SENT", null, null, null), true, true))).containsExactly("Password Reset Link");
    }

    @Test
    void theUpdatedDateRangeCoversWholeDays() {
        assertThat(names(service.list(query(null, null, null, null, null, "10/11/2026", "11/11/2026", null), true, true)))
                .containsExactly("Document Approved", "Password Reset Link");
        assertThat(names(service.list(query(null, null, null, null, null, "12/11/2026", null, null), true, true))).isEmpty();
        assertThat(names(service.list(query(null, null, null, null, null, null, "01/10/2026", null), true, true))).containsExactly("Controlled Copy Recalled", "Review Request", "Review Request");
        assertThat(service.list(query(null, null, null, null, null, "not a date", "31/02/2026", null), true, true).data()).hasSize(5);
    }

    @Test
    void searchLooksAtNameCodeDescriptionAndChannel() {
        assertThat(names(service.list(query(null, null, null, null, null, null, null, "recalled"), true, true))).containsExactly("Controlled Copy Recalled");
        assertThat(names(service.list(query(null, null, null, null, null, null, null, "password-reset"), true, true))).containsExactly("Password Reset Link");
        assertThat(names(service.list(query(null, null, null, null, null, null, null, "mail"), true, true))).containsExactly("Password Reset Link", "Review Request", "Review Request");
    }

    @Test
    void aPersonSeesOnlyTheKindTheyMayView() {
        assertThat(names(service.list(query(null, null, null, null, null, null, null, null), true, false))).containsExactly("Controlled Copy Recalled", "Document Approved");
        assertThat(names(service.list(query(null, null, null, null, null, null, null, null), false, true))).containsExactly("Password Reset Link", "Review Request", "Review Request");
        assertThat(service.list(query("EMAIL", null, null, null, null, null, null, null), true, false).data()).isEmpty();
    }

    @Test
    void thePlaceholdersAreEveryOneTheModulesSendPlusThoseOfTheEventsAndTheEmailMessagesOnceEach() {
        var ownEvent = new com.eqms.dto.notification.NotificationVariableResponse("eventOnlyThing", "{{eventOnlyThing}}", "Event only thing", "(example)");
        var documentNumber = new com.eqms.dto.notification.NotificationVariableResponse("documentNumber", "{{documentNumber}}", "Document number", "SOP.0001");
        when(policies.allEventVariables()).thenReturn(List.of(documentNumber, ownEvent));
        var mail = email("Mail with its own", "x", "Active", 0, Instant.parse("2026-11-11T05:00:00Z"));
        org.mockito.Mockito.doReturn(List.of("documentNumber", "mailOnlyThing", " ")).when(mail).getVariablesList();
        when(emails.findAll()).thenReturn(List.of(mail));

        var all = service.placeholders(true, true);
        var byName = all.stream().collect(java.util.stream.Collectors.toMap(com.eqms.dto.notification.NotificationVariableResponse::name, v -> v));
        assertThat(all).extracting(com.eqms.dto.notification.NotificationVariableResponse::name).doesNotHaveDuplicates();
        assertThat(all.size()).as("the placeholders of every module").isGreaterThan(100);
        // the modules the senders belong to are there, each with its own placeholders
        assertThat(byName.get("documentNumber").module()).isEqualTo(NotificationPlaceholderCatalog.DOCUMENTS);
        assertThat(byName.get("controlledCopyNumber").module()).isEqualTo(NotificationPlaceholderCatalog.CONTROLLED);
        assertThat(byName.get("uncontrolledCopyNumber").module()).isEqualTo(NotificationPlaceholderCatalog.UNCONTROLLED);
        assertThat(byName.get("trainingPlannedDate").module()).isEqualTo(NotificationPlaceholderCatalog.TRAINING);
        assertThat(byName.get("campaignName").module()).isEqualTo(NotificationPlaceholderCatalog.ACCESS_REVIEW);
        assertThat(byName.get("backupNumber").module()).isEqualTo(NotificationPlaceholderCatalog.BACKUP);
        assertThat(byName.get("knowledgeBase").module()).isEqualTo(NotificationPlaceholderCatalog.KNOWLEDGE);
        assertThat(byName.get("suspendReason").module()).isEqualTo(NotificationPlaceholderCatalog.SECURITY);
        assertThat(byName.get("documentNumber").sample()).isEqualTo("SOP.0001");
        assertThat(byName.get("documentNumber").token()).isEqualTo("{{documentNumber}}");
        // one that only an event or an email message has is kept, under Other
        assertThat(byName.get("eventOnlyThing").module()).isEqualTo(NotificationPlaceholderCatalog.OTHER);
        assertThat(byName.get("mailOnlyThing")).extracting("token", "label", "module").containsExactly("{{mailOnlyThing}}", "Mail only thing", NotificationPlaceholderCatalog.OTHER);
        assertThat(service.placeholders(true, false)).extracting(com.eqms.dto.notification.NotificationVariableResponse::name).contains("eventOnlyThing").doesNotContain("mailOnlyThing");
        assertThat(service.placeholders(false, true)).extracting(com.eqms.dto.notification.NotificationVariableResponse::name).contains("mailOnlyThing").doesNotContain("eventOnlyThing");
        assertThat(service.placeholders(false, false)).isEmpty();
    }

    @Test
    void everyPlaceholderOfTheCatalogHasAModuleALabelAndAnExampleAndTheNamesAreNotRepeated() {
        var entries = NotificationPlaceholderCatalog.all();
        assertThat(entries).extracting(NotificationPlaceholderCatalog.Entry::name).doesNotHaveDuplicates();
        assertThat(entries).allSatisfy(e -> {
            assertThat(e.name()).matches("[a-zA-Z][a-zA-Z0-9]*");
            assertThat(e.module()).isNotBlank();
            assertThat(e.label()).isNotBlank();
            assertThat(e.sample()).isNotBlank();
        });
        assertThat(entries).extracting(NotificationPlaceholderCatalog.Entry::module).contains(
                NotificationPlaceholderCatalog.GENERAL, NotificationPlaceholderCatalog.TRAINING, NotificationPlaceholderCatalog.BACKUP);
    }

    @Test
    void sortingAndPagingAreDoneHere() {
        Query byUpdatedDesc = new Query(null, null, null, null, null, null, null, null, "updatedAt", "desc", 1, 2);
        PageResponse<Row> page = service.list(byUpdatedDesc, true, true);
        assertThat(names(page)).containsExactly("Password Reset Link", "Document Approved");
        assertThat(page.pagination().total()).isEqualTo(5);
        assertThat(page.pagination().totalPages()).isEqualTo(3);
        assertThat(names(service.list(new Query(null, null, null, null, null, null, null, null, "updatedAt", "desc", 2, 2), true, true)))
                .containsExactly("Controlled Copy Recalled", "Review Request");
    }

    @Test
    void everyRowOfAnEventSaysHowManyNotificationsItSentOnItsChannel() {
        var jdbc = mock(org.springframework.jdbc.core.JdbcTemplate.class);
        org.mockito.Mockito.doAnswer(invocation -> {
            String sql = invocation.getArgument(0);
            org.springframework.jdbc.core.RowCallbackHandler handler = invocation.getArgument(1);
            var rs = mock(java.sql.ResultSet.class);
            if (sql.contains("user_notifications")) {
                when(rs.getString(1)).thenReturn("document.expired");
                when(rs.getInt(2)).thenReturn(7);
            } else {
                when(rs.getString(1)).thenReturn("document.expired");
                when(rs.getInt(2)).thenReturn(3);
            }
            handler.processRow(rs);
            return null;
        }).when(jdbc).query(anyString(), org.mockito.ArgumentMatchers.<org.springframework.jdbc.core.RowCallbackHandler>any());
        var both = new NotificationPolicySummaryResponse("document.expired", "Document Expired", "About it", "DOCUMENT_CONTROL", "HIGH", "IN_APP,EMAIL", "ACTIVE", "IN_APP,EMAIL",
                false, Instant.parse("2026-11-10T05:00:00Z"));
        var never = new NotificationPolicySummaryResponse("document.obsoleted", "Document Obsoleted", "About it", "DOCUMENT_CONTROL", "HIGH", "IN_APP,EMAIL", "ACTIVE", "IN_APP,EMAIL",
                false, Instant.parse("2026-11-10T05:00:00Z"));
        when(policies.list(any(), any(), any(), any(), any(), any(), anyInt(), anyInt())).thenReturn(new PageResponse<>(List.of(both, never), new PaginationResponse(1, 2, 2, 1)));
        when(emails.findAll()).thenReturn(List.of());
        var counted = new NotificationAdministrationService(policies, emails, jdbc);

        var rows = counted.list(query(null, null, null, null, null, null, null, null), true, true).data();
        assertThat(rows).extracting(r -> r.code() + ":" + r.channel() + ":" + r.sent()).containsExactlyInAnyOrder(
                "document.expired:IN_APP:7", "document.expired:EMAIL:3", "document.obsoleted:IN_APP:0", "document.obsoleted:EMAIL:0");
        // the filter on whether it was ever sent works for events too
        assertThat(counted.list(query(null, null, null, null, "NEVER_SENT", null, null, null), true, true).data()).extracting(Row::code).containsOnly("document.obsoleted");
        assertThat(counted.list(query(null, null, null, null, "SENT", null, null, null), true, true).data()).extracting(Row::code).containsOnly("document.expired");
    }
    /** NOTIFICATION-PRIORITY-2026-11-20: the list can be narrowed to one priority; email messages carry none, so they drop out of a priority filter. */
    @Test
    void theListCanBeFilteredByPriority() {
        var high = service.list(new Query(null, null, null, null, null, null, null, null, "name", "asc", 1, 50, "high"), true, true);
        assertThat(high.data()).isNotEmpty().allMatch(r -> "HIGH".equals(r.priority()));
        var low = service.list(new Query(null, null, null, null, null, null, null, null, "name", "asc", 1, 50, "LOW"), true, true);
        assertThat(low.data()).isEmpty();
    }
}
