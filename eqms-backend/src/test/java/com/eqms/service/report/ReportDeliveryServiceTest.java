package com.eqms.service.report;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.NotificationDispatcher;
import com.eqms.service.PermissionEvaluationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.mockingDetails;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;

/** REPORT-NOTIFICATION-CHANNEL-2026-10-14: link-only notices, a fresh authorization check per recipient, every attempt recorded. */
class ReportDeliveryServiceTest {

    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final UserAccountRepository users = mock(UserAccountRepository.class);
    private final PermissionEvaluationService permissions = mock(PermissionEvaluationService.class);
    private final NotificationDispatcher dispatcher = mock(NotificationDispatcher.class);
    private final UUID runId = UUID.randomUUID();
    private final UUID scheduleId = UUID.randomUUID();
    private final UUID creatorId = UUID.randomUUID();
    private final UUID recipientId = UUID.randomUUID();
    private ReportDeliveryService service;

    /** Typed matcher: keeps JdbcTemplate's varargs overload selected. */
    private static Object anyObj() {
        return org.mockito.ArgumentMatchers.<Object>any();
    }

    private static UserAccount user(UUID id, String email) {
        var account = new UserAccount();
        account.setId(id);
        account.setUsername("user." + id.toString().substring(0, 4));
        account.setFullName("Test Person");
        account.setEmail(email);
        account.setStatus(UserStatus.Active);
        return account;
    }

    @BeforeEach
    void setUp() {
        service = new ReportDeliveryService(jdbc, users, permissions, dispatcher);
        // by default the registry sends both channels
        when(dispatcher.dispatchIndependently(anyString(), any(), any())).thenReturn(new NotificationDispatcher.Outcome(null, true, true, true, true));
        when(jdbc.queryForList(anyString(), anyObj())).thenReturn(List.of(Map.of(
                "schedule_id", scheduleId.toString(), "requester_user_id", creatorId.toString(), "title", "Training status")));
        when(jdbc.queryForList(anyString(), eq(UUID.class), anyObj())).thenReturn(List.of(recipientId));
    }

    private void recipientMayOpen(boolean viewAll, boolean isRequester) {
        var recipient = user(recipientId, "recipient@example.test");
        when(users.findById(recipientId)).thenReturn(Optional.of(recipient));
        when(permissions.hasPermission(any(UserAccount.class), anyString())).thenReturn(false);
        when(permissions.hasPermission(recipient, "report.module.view")).thenReturn(true);
        when(permissions.hasPermission(recipient, "reports.run.view_own")).thenReturn(true);
        when(permissions.hasPermission(recipient, "reports.run.view_all")).thenReturn(viewAll);
        if (isRequester) {
            when(jdbc.queryForList(anyString(), anyObj())).thenReturn(List.of(Map.of(
                    "schedule_id", scheduleId.toString(), "requester_user_id", recipientId.toString(), "title", "Training status")));
        }
    }

    /** One entry per insert into report_delivery_attempts: channel, event, status, reason. */
    private List<List<Object>> attempts() {
        var rows = new ArrayList<List<Object>>();
        for (var invocation : mockingDetails(jdbc).getInvocations()) {
            if (!invocation.getMethod().getName().equals("update")) continue;
            Object[] args = invocation.getArguments();
            if (!String.valueOf(args[0]).contains("report_delivery_attempts")) continue;
            rows.add(List.of(args[2], args[3], args[6], args.length > 7 && args[7] != null ? args[7] : "-"));
        }
        return rows;
    }

    @Test
    void anAuthorizedRecipientGetsAnInAppNoticeAndALinkOnlyEmail() {
        recipientMayOpen(true, false);

        var recipient = users.findById(recipientId).orElseThrow();

        service.notifyRecipientsOfCompletedRun(runId);

        verify(dispatcher).dispatchIndependently(eq("report.ready"), eq(List.of(recipient)),
                org.mockito.ArgumentMatchers.argThat(v -> "Report ready: Training status".equals(v.get("title")) && ("/report/runs/" + runId).equals(v.get("actionUrl"))
                        && v.get("message").contains("The file itself is not sent")));
        assertThat(attempts()).containsExactly(
                List.of("IN_APP", "REPORT_READY", "SENT", "-"),
                List.of("EMAIL", "REPORT_READY", "SENT", "-"));
    }

    @Test
    void aRecipientWhoLostAccessIsSkippedOnBothChannels() {
        recipientMayOpen(false, false);

        service.notifyRecipientsOfCompletedRun(runId);

        verify(dispatcher, never()).dispatchIndependently(any(), any(), any());
        assertThat(attempts()).containsExactly(
                List.of("IN_APP", "REPORT_READY", "SKIPPED_NOT_AUTHORIZED", "-"),
                List.of("EMAIL", "REPORT_READY", "SKIPPED_NOT_AUTHORIZED", "-"));
    }

    @Test
    void theRequesterCanAlwaysOpenTheirOwnRun() {
        recipientMayOpen(false, true);

        service.notifyRecipientsOfCompletedRun(runId);

        assertThat(attempts()).extracting(row -> row.get(2)).containsOnly("SENT");
    }

    @Test
    void aFailureOfTheDispatchIsRecordedAsFailedOnBothChannels() {
        recipientMayOpen(true, false);
        when(dispatcher.dispatchIndependently(anyString(), any(), any())).thenThrow(new IllegalStateException("db down"));

        service.notifyRecipientsOfCompletedRun(runId);

        assertThat(attempts()).containsExactly(
                List.of("IN_APP", "REPORT_READY", "FAILED", "IllegalStateException"),
                List.of("EMAIL", "REPORT_READY", "FAILED", "IllegalStateException"));
    }

    @Test
    void aSwitchedOffEventAndAChannelThatIsOffAreSkippedNotFailed() {
        recipientMayOpen(true, false);
        when(dispatcher.dispatchIndependently(anyString(), any(), any())).thenReturn(new NotificationDispatcher.Outcome(null, true, false, true, false));
        service.notifyRecipientsOfCompletedRun(runId);
        assertThat(attempts()).containsExactly(
                List.of("IN_APP", "REPORT_READY", "SENT", "-"),
                List.of("EMAIL", "REPORT_READY", "SKIPPED", "CHANNEL_OFF"));
    }

    @Test
    void aRecipientWithoutAnAddressIsAFailedEmailAsBefore() {
        recipientMayOpen(true, false);
        users.findById(recipientId).orElseThrow().setEmail(null);
        when(dispatcher.dispatchIndependently(anyString(), any(), any())).thenReturn(new NotificationDispatcher.Outcome(null, true, true, true, false));
        service.notifyRecipientsOfCompletedRun(runId);
        assertThat(attempts()).containsExactly(
                List.of("IN_APP", "REPORT_READY", "SENT", "-"),
                List.of("EMAIL", "REPORT_READY", "FAILED", "NO_EMAIL_ADDRESS"));
    }

    @Test
    void aSuspensionNoticeReachesAnActiveOwnerEvenWithoutScheduleScreenPermission() {
        var owner = user(recipientId, "owner@example.test");
        var creator = user(creatorId, "creator@example.test");
        when(users.findById(recipientId)).thenReturn(Optional.of(owner));
        when(users.findById(creatorId)).thenReturn(Optional.of(creator));
        when(jdbc.queryForMap(anyString(), anyObj())).thenReturn(Map.of(
                "name", "Monthly status", "owner_user_id", recipientId.toString(), "creator_user_id", creatorId.toString()));

        service.notifyScheduleSuspended(scheduleId, "SUSPENDED_AUTHORIZATION_CHANGED");

        verify(dispatcher, org.mockito.Mockito.times(2)).dispatchIndependently(eq("report.schedule_suspended"), any(),
                org.mockito.ArgumentMatchers.argThat(v -> "Scheduled report suspended: Monthly status".equals(v.get("title")) && v.get("message").contains("creator's permissions")
                        && "/report/scheduled".equals(v.get("actionUrl"))));
        assertThat(attempts()).extracting(row -> row.get(2)).containsOnly("SENT");
    }

    @Test
    void aSuspensionNoticeAlsoReachesActiveReportAdministrators() {
        var owner = user(recipientId, "owner@example.test");
        var creator = user(creatorId, "creator@example.test");
        var administrator = user(UUID.randomUUID(), "admin@example.test");
        when(users.findById(recipientId)).thenReturn(Optional.of(owner));
        when(users.findById(creatorId)).thenReturn(Optional.of(creator));
        when(users.findAll()).thenReturn(List.of(owner, administrator));
        when(users.findById(administrator.getId())).thenReturn(Optional.of(administrator));
        when(permissions.hasPermission(any(UserAccount.class), anyString())).thenReturn(false);
        when(permissions.hasPermission(administrator, "reports.schedule.manage")).thenReturn(true);
        when(jdbc.queryForMap(anyString(), anyObj())).thenReturn(Map.of(
                "name", "Monthly status", "owner_user_id", recipientId.toString(), "creator_user_id", creatorId.toString()));

        service.notifyScheduleSuspended(scheduleId, "SUSPENDED_AUTHORIZATION_CHANGED");

        verify(dispatcher, org.mockito.Mockito.times(3)).dispatchIndependently(eq("report.schedule_suspended"), any(), any());
        assertThat(attempts()).hasSize(6);
    }

    @Test
    void anInactiveOwnerIsRecordedAsSkipped() {
        var owner = user(recipientId, "owner@example.test");
        owner.setStatus(UserStatus.Suspended);
        when(users.findById(recipientId)).thenReturn(Optional.of(owner));
        when(users.findById(creatorId)).thenReturn(Optional.empty());
        when(jdbc.queryForMap(anyString(), anyObj())).thenReturn(Map.of(
                "name", "Monthly status", "owner_user_id", recipientId.toString(), "creator_user_id", creatorId.toString()));

        service.notifyScheduleSuspended(scheduleId, "SUSPENDED_INVALID_SCHEDULE");

        assertThat(attempts()).extracting(row -> row.get(2)).containsOnly("SKIPPED_NOT_AUTHORIZED");
    }

    @Test
    void aRunWithoutAScheduleTellsOnlyThePersonWhoAskedForIt() {
        var requester = user(creatorId, "creator@example.test");
        when(users.findById(creatorId)).thenReturn(Optional.of(requester));
        when(jdbc.queryForList(anyString(), anyObj())).thenReturn(List.of(Map.of(
                "requester_user_id", creatorId.toString(), "title", "Ad hoc")));
        bothChannelsWork();

        service.notifyRecipientsOfCompletedRun(runId);

        // the in-app notice only tells: no link; the e-mail has the link that downloads the file
        verify(dispatcher).dispatchIndependently(eq("report.ready"), eq(List.of(requester)),
                org.mockito.ArgumentMatchers.argThat(v -> "Report ready: Ad hoc".equals(v.get("title")) && v.get("message").contains("Action menu") && "".equals(v.get("actionUrl"))
                        && !v.get("message").contains("?download")), channels("IN_APP"));
        verify(dispatcher).dispatchIndependently(eq("report.ready"), eq(List.of(requester)),
                org.mockito.ArgumentMatchers.argThat(v -> v.get("message").contains("The report you asked for") && ("/report/runs/" + runId + "?download=1").equals(v.get("actionUrl"))), channels("EMAIL"));
        assertThat(attempts()).extracting(row -> row.get(2)).containsOnly("SENT");
    }

    @Test
    void aRunThatFailedForGoodIsToldToThePersonWhoAskedWithTheCauseAndARunThatWillBeTriedAgainIsNot() {
        var requester = user(creatorId, "creator@example.test");
        when(users.findById(creatorId)).thenReturn(Optional.of(requester));
        var failed = new java.util.HashMap<String, Object>();
        failed.put("schedule_id", null);
        failed.put("requester_user_id", creatorId.toString());
        failed.put("status", "FAILED");
        failed.put("title", "Ad hoc");
        failed.put("reason_code", "REPORT_ROW_LIMIT_EXCEEDED");
        failed.put("error_message", "The result has more rows than a report file may hold. Add a filter to narrow it and start a new request.");
        when(jdbc.queryForList(anyString(), anyObj())).thenReturn(List.of(failed));
        bothChannelsWork();

        service.notifyRequesterOfFailedRun(runId);

        // the cause is in the text of both notices; the in-app one has no link, the e-mail has the run's link
        verify(dispatcher).dispatchIndependently(eq("report.run_failed"), eq(List.of(requester)),
                org.mockito.ArgumentMatchers.argThat(v -> "Report failed: Ad hoc".equals(v.get("title")) && v.get("message").contains("more rows than a report file may hold") && "".equals(v.get("actionUrl"))), channels("IN_APP"));
        verify(dispatcher).dispatchIndependently(eq("report.run_failed"), eq(List.of(requester)),
                org.mockito.ArgumentMatchers.argThat(v -> v.get("message").contains("Cause:") && ("/report/runs/" + runId).equals(v.get("actionUrl"))), channels("EMAIL"));

        // a run that will be tried again is not reported
        failed.put("status", "RETRY_SCHEDULED");
        org.mockito.Mockito.clearInvocations(dispatcher);
        service.notifyRequesterOfFailedRun(runId);
        verify(dispatcher, never()).dispatchIndependently(anyString(), any(), any(), org.mockito.ArgumentMatchers.<java.util.Set<String>>any());
    }


    private static java.util.Set<String> channels(String... names) { return org.mockito.ArgumentMatchers.argThat(set -> set != null && set.equals(java.util.Set.of(names))); }
    private void bothChannelsWork() {
        when(dispatcher.dispatchIndependently(anyString(), any(), any(), org.mockito.ArgumentMatchers.<java.util.Set<String>>any())).thenReturn(new NotificationDispatcher.Outcome(null, true, true, true, true));
        when(dispatcher.dispatchIndependently(anyString(), any(), any(), org.mockito.ArgumentMatchers.<java.util.Set<String>>any(), any(NotificationDispatcher.MailFile.class))).thenReturn(new NotificationDispatcher.Outcome(null, true, true, true, true));
    }

    // ---- REPORT-READY-FILE-2026-11-16: the e-mail of a report a person asked for themselves carries the file
    private UserAccount ownRun() {
        var requester = user(recipientId, "requester@example.test");
        when(users.findById(recipientId)).thenReturn(Optional.of(requester));
        var row = new java.util.HashMap<String, Object>();
        row.put("schedule_id", null);
        row.put("requester_user_id", recipientId.toString());
        row.put("title", "Audit report");
        when(jdbc.queryForList(anyString(), anyObj())).thenReturn(List.of(row));
        when(permissions.hasPermission(any(UserAccount.class), anyString())).thenReturn(false);
        when(permissions.hasPermission(requester, "report.module.view")).thenReturn(true);
        when(permissions.hasPermission(requester, "reports.run.view_own")).thenReturn(true);
        when(dispatcher.dispatchIndependently(anyString(), any(), any(), any(NotificationDispatcher.MailFile.class))).thenReturn(new NotificationDispatcher.Outcome(null, true, true, true, true));
        return requester;
    }

    @Test
    void theEmailOfAReportAPersonAskedForCarriesTheFileAndALinkThatDownloadsIt() {
        var requester = ownRun();
        bothChannelsWork();
        byte[] file = new byte[1024];

        service.notifyRecipientsOfCompletedRun(runId, "rpt-0001.xlsx", file);

        verify(dispatcher).dispatchIndependently(eq("report.ready"), eq(List.of(requester)),
                org.mockito.ArgumentMatchers.argThat(v -> ("/report/runs/" + runId + "?download=1").equals(v.get("actionUrl")) && v.get("message").contains("attached")),
                channels("EMAIL"),
                org.mockito.ArgumentMatchers.argThat((NotificationDispatcher.MailFile f) -> f != null && "rpt-0001.xlsx".equals(f.name()) && f.content() == file));
        // the in-app notice has neither the file nor a link
        verify(dispatcher).dispatchIndependently(eq("report.ready"), eq(List.of(requester)),
                org.mockito.ArgumentMatchers.argThat(v -> "".equals(v.get("actionUrl")) && !v.get("message").contains("attached")), channels("IN_APP"));
        assertThat(attempts()).containsExactly(List.of("IN_APP", "REPORT_READY", "SENT", "-"), List.of("EMAIL", "REPORT_READY", "SENT", "-"));
    }

    @Test
    void aFileLargerThanTheLimitIsNotAttachedAndTheEmailSaysSo() {
        var requester = ownRun();
        bothChannelsWork();

        service.notifyRecipientsOfCompletedRun(runId, "big.csv", new byte[ReportDeliveryService.MAX_ATTACHMENT_BYTES + 1]);

        verify(dispatcher, never()).dispatchIndependently(anyString(), any(), any(), org.mockito.ArgumentMatchers.<java.util.Set<String>>any(), any(NotificationDispatcher.MailFile.class));
        verify(dispatcher).dispatchIndependently(eq("report.ready"), eq(List.of(requester)),
                org.mockito.ArgumentMatchers.argThat(v -> v.get("message").contains("larger than 10 MB") && ("/report/runs/" + runId + "?download=1").equals(v.get("actionUrl"))), channels("EMAIL"));
        verify(dispatcher).dispatchIndependently(eq("report.ready"), eq(List.of(requester)),
                org.mockito.ArgumentMatchers.argThat(v -> "".equals(v.get("actionUrl"))), channels("IN_APP"));
    }

    @Test
    void aRequesterWhoMayNoLongerOpenRunsGetsNoFileByEmail() {
        var requester = ownRun();
        when(permissions.hasPermission(requester, "reports.run.view_own")).thenReturn(false);
        bothChannelsWork();

        service.notifyRecipientsOfCompletedRun(runId, "rpt.csv", new byte[10]);

        // the e-mail is the plain one (a link, which still asks for sign-in and the permission); the file is not attached
        verify(dispatcher, never()).dispatchIndependently(anyString(), any(), any(), org.mockito.ArgumentMatchers.<java.util.Set<String>>any(), any(NotificationDispatcher.MailFile.class));
        verify(dispatcher).dispatchIndependently(eq("report.ready"), eq(List.of(requester)), any(), channels("EMAIL"));
    }

    @Test
    void theRecipientsOfAScheduleStillGetALinkOnlyEmailEvenWhenTheFileIsGiven() {
        recipientMayOpen(true, false);

        service.notifyRecipientsOfCompletedRun(runId, "rpt.xlsx", new byte[10]);

        verify(dispatcher, never()).dispatchIndependently(anyString(), any(), any(), any(NotificationDispatcher.MailFile.class));
    }
}
