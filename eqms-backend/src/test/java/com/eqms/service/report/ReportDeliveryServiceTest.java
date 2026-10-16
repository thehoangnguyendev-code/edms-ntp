package com.eqms.service.report;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.EmailNotificationService;
import com.eqms.service.NotificationService;
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
    private final NotificationService notifications = mock(NotificationService.class);
    private final EmailNotificationService email = mock(EmailNotificationService.class);
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
        service = new ReportDeliveryService(jdbc, users, permissions, notifications, email);
        when(email.resolvePublicAppBaseUrl()).thenReturn("https://eqms.example");
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
        when(email.sendRenderedEmailWithTracking(eq("recipient@example.test"), anyString(), anyString(), anyString(), anyString(), any()))
                .thenReturn(true);

        service.notifyRecipientsOfCompletedRun(runId);

        verify(notifications).recordNotification(any(), any(), eq("personal"), eq("Report"), eq("report-ready"), eq("Report ready: Training status"),
                anyString(), eq("/report/runs/" + runId), eq("REPORT_RUN"), eq(runId), any(), any(), any(), any());
        verify(email).sendRenderedEmailWithTracking(eq("recipient@example.test"), eq("EQMS: Report ready: Training status"),
                org.mockito.ArgumentMatchers.contains("https://eqms.example/report/runs/" + runId), eq("REPORT_READY"), eq("REPORT"), any());
        assertThat(attempts()).containsExactly(
                List.of("IN_APP", "REPORT_READY", "SENT", "-"),
                List.of("EMAIL", "REPORT_READY", "SENT", "-"));
    }

    @Test
    void aRecipientWhoLostAccessIsSkippedOnBothChannels() {
        recipientMayOpen(false, false);

        service.notifyRecipientsOfCompletedRun(runId);

        verify(notifications, never()).recordNotification(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
        verify(email, never()).sendRenderedEmailWithTracking(any(), any(), any(), any(), any(), any());
        assertThat(attempts()).containsExactly(
                List.of("IN_APP", "REPORT_READY", "SKIPPED_NOT_AUTHORIZED", "-"),
                List.of("EMAIL", "REPORT_READY", "SKIPPED_NOT_AUTHORIZED", "-"));
    }

    @Test
    void theRequesterCanAlwaysOpenTheirOwnRun() {
        recipientMayOpen(false, true);
        when(email.sendRenderedEmailWithTracking(any(), any(), any(), any(), any(), any())).thenReturn(true);

        service.notifyRecipientsOfCompletedRun(runId);

        assertThat(attempts()).extracting(row -> row.get(2)).containsOnly("SENT");
    }

    @Test
    void aFailedInAppNoticeDoesNotStopTheEmail() {
        recipientMayOpen(true, false);
        when(notifications.recordNotification(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenThrow(new IllegalStateException("db down"));
        when(email.sendRenderedEmailWithTracking(any(), any(), any(), any(), any(), any())).thenReturn(true);

        service.notifyRecipientsOfCompletedRun(runId);

        assertThat(attempts()).containsExactly(
                List.of("IN_APP", "REPORT_READY", "FAILED", "IllegalStateException"),
                List.of("EMAIL", "REPORT_READY", "SENT", "-"));
    }

    @Test
    void anEmailThatTheProviderRejectsIsRecordedAsFailed() {
        recipientMayOpen(true, false);
        when(email.sendRenderedEmailWithTracking(any(), any(), any(), any(), any(), any())).thenReturn(false);

        service.notifyRecipientsOfCompletedRun(runId);

        assertThat(attempts()).containsExactly(
                List.of("IN_APP", "REPORT_READY", "SENT", "-"),
                List.of("EMAIL", "REPORT_READY", "FAILED", "EMAIL_NOT_SENT"));
    }

    @Test
    void aSuspensionNoticeReachesAnActiveOwnerEvenWithoutScheduleScreenPermission() {
        var owner = user(recipientId, "owner@example.test");
        var creator = user(creatorId, "creator@example.test");
        when(users.findById(recipientId)).thenReturn(Optional.of(owner));
        when(users.findById(creatorId)).thenReturn(Optional.of(creator));
        when(jdbc.queryForMap(anyString(), anyObj())).thenReturn(Map.of(
                "name", "Monthly status", "owner_user_id", recipientId.toString(), "creator_user_id", creatorId.toString()));
        when(email.sendRenderedEmailWithTracking(any(), any(), any(), any(), any(), any())).thenReturn(true);

        service.notifyScheduleSuspended(scheduleId, "SUSPENDED_AUTHORIZATION_CHANGED");

        verify(notifications, org.mockito.Mockito.times(2)).recordNotification(any(), any(), eq("personal"), eq("Report"),
                eq("report-schedule-suspended"), eq("Scheduled report suspended: Monthly status"),
                org.mockito.ArgumentMatchers.contains("creator's permissions"), eq("/report/scheduled"),
                eq("REPORT_SCHEDULE"), eq(scheduleId), any(), any(), any(), any());
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
        when(email.sendRenderedEmailWithTracking(any(), any(), any(), any(), any(), any())).thenReturn(true);

        service.notifyScheduleSuspended(scheduleId, "SUSPENDED_AUTHORIZATION_CHANGED");

        verify(notifications, org.mockito.Mockito.times(3)).recordNotification(any(), any(), eq("personal"), eq("Report"),
                eq("report-schedule-suspended"), any(), any(), any(), any(), any(), any(), any(), any(), any());
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
    void aRunWithoutASchedulePostsNothing() {
        when(jdbc.queryForList(anyString(), anyObj())).thenReturn(List.of(Map.of(
                "requester_user_id", creatorId.toString(), "title", "Ad hoc")));

        service.notifyRecipientsOfCompletedRun(runId);

        verify(notifications, never()).recordNotification(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
        assertThat(attempts()).isEmpty();
    }
}
