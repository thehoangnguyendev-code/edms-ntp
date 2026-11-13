package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import com.eqms.service.NotificationDispatcher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * NOTIFICATION-ADMIN-2026-11-12, Training Management goes through the notification registry: a notice is dispatched under its registry code with the title and
 * text the module composes, the log of the notice says what the dispatch did, a failure never reaches the business change, and every code the module raises is
 * one the registry is seeded with.
 */
class TrainingNotifierRegistryTest {

    private JdbcTemplate jdbc;
    private NotificationDispatcher dispatcher;
    private TrainingNotifier notifier;
    private UserAccount person;

    @BeforeEach
    void setUp() {
        jdbc = mock(JdbcTemplate.class);
        dispatcher = mock(NotificationDispatcher.class);
        notifier = new TrainingNotifier(jdbc, dispatcher, mock(PlatformTransactionManager.class));
        person = mock(UserAccount.class);
        when(person.getId()).thenReturn(UUID.randomUUID());
        when(person.getFullName()).thenReturn("Nguyen Van A");
        when(person.getEmail()).thenReturn("a@example.test");
        // every claim of the log is taken (the notice was not sent before)
        when(jdbc.update(org.mockito.ArgumentMatchers.contains("insert into training_notification_log"), any(Object[].class))).thenReturn(1);
    }

    private void sent(String event) {
        notifier.send(event, person, null, "Training: your action is needed", "Approve the content.", "TRAINING_ACTIVITY", UUID.randomUUID(), null);
    }

    @Test
    void aNoticeIsDispatchedUnderItsRegistryCodeWithTheTitleAndTextTheModuleComposed() {
        when(dispatcher.dispatchIndependently(anyString(), any(), any())).thenReturn(new NotificationDispatcher.Outcome(null, true, true, true, true));
        sent("TRAINING_STEP_ASSIGNED");

        ArgumentCaptor<Map<String, String>> variables = ArgumentCaptor.forClass(Map.class);
        verify(dispatcher).dispatchIndependently(eq("training.step_assigned"), eq(List.of(person)), variables.capture());
        assertThat(variables.getValue()).containsEntry("title", "Training: your action is needed").containsEntry("message", "Approve the content.")
                .containsEntry("recipientName", "Nguyen Van A").containsKey("actionUrl");
        assertThat(variables.getValue().get("actionUrl")).startsWith("/training-management/activities/");
        verify(jdbc, org.mockito.Mockito.times(2)).update(eq("update training_notification_log set status=?, reason_code=? where id=?"), eq("SENT"), eq(null), any(UUID.class));
    }

    @Test
    void whatTheDispatchDidIsWrittenToTheLogOfTheNoticeChannelByChannel() {
        // the policy has the e-mail off and the person gets the in-app notice only
        when(dispatcher.dispatchIndependently(anyString(), any(), any())).thenReturn(new NotificationDispatcher.Outcome(null, true, false, true, false));
        sent("TRAINING_INVITED");
        verify(jdbc).update(eq("update training_notification_log set status=?, reason_code=? where id=?"), eq("SENT"), eq(null), any(UUID.class));
        verify(jdbc).update(eq("update training_notification_log set status=?, reason_code=? where id=?"), eq("SKIPPED"), eq("CHANNEL_OFF"), any(UUID.class));
    }

    @Test
    void aSwitchedOffEventIsSkippedWithTheReasonAndNothingIsSent() {
        when(dispatcher.dispatchIndependently(anyString(), any(), any())).thenReturn(new NotificationDispatcher.Outcome("POLICY_OFF", false, false, false, false));
        sent("TRAINING_DUE_SOON");
        verify(jdbc, org.mockito.Mockito.times(2)).update(eq("update training_notification_log set status=?, reason_code=? where id=?"), eq("SKIPPED"), eq("POLICY_OFF"), any(UUID.class));
    }

    @Test
    void aPersonWithoutAnAddressIsSkippedForTheEmailOnly() {
        when(person.getEmail()).thenReturn(" ");
        when(dispatcher.dispatchIndependently(anyString(), any(), any())).thenReturn(new NotificationDispatcher.Outcome(null, true, true, true, false));
        sent("TRAINING_INVITED");
        verify(jdbc).update(eq("update training_notification_log set status=?, reason_code=? where id=?"), eq("SKIPPED"), eq("NO_EMAIL_ADDRESS"), any(UUID.class));
    }

    @Test
    void aFailureOfTheDispatchIsLoggedAndNeverReachesTheBusinessChange() {
        when(dispatcher.dispatchIndependently(anyString(), any(), any())).thenThrow(new IllegalStateException("database down"));
        sent("TRAINING_OVERDUE");
        verify(jdbc, org.mockito.Mockito.times(2)).update(eq("update training_notification_log set status=?, reason_code=? where id=?"), eq("FAILED"), eq("IllegalStateException"), any(UUID.class));
    }

    @Test
    void aKeyedNoticeAlreadySentIsNotDispatchedAgain() {
        when(jdbc.update(org.mockito.ArgumentMatchers.contains("insert into training_notification_log"), any(Object[].class))).thenReturn(0);
        notifier.send("TRAINING_DUE_SOON", person, null, "Training: due soon", "In 3 days.", "TRAINING_ACTIVITY", UUID.randomUUID(), "due-soon:2026-11-12");
        verify(dispatcher, never()).dispatchIndependently(anyString(), any(), any());
    }

    @Test
    void aNoticeWhoseEmailCarriesAFileGoesThroughTheRegistryWithTheFile() {
        when(dispatcher.dispatchIndependently(anyString(), any(), any(), any(NotificationDispatcher.MailFile.class))).thenReturn(new NotificationDispatcher.Outcome(null, true, true, true, true));
        notifier.send("TRAINING_ATTENDANCE_SENT", person, null, "Training: attendance list received", "The list is attached.", "TRAINING_ACTIVITY", UUID.randomUUID(), null,
                "list.pdf", new byte[] {1, 2, 3});

        ArgumentCaptor<NotificationDispatcher.MailFile> file = ArgumentCaptor.forClass(NotificationDispatcher.MailFile.class);
        verify(dispatcher).dispatchIndependently(eq("training.attendance_sent"), eq(List.of(person)), any(), file.capture());
        assertThat(file.getValue().name()).isEqualTo("list.pdf");
        assertThat(file.getValue().content()).containsExactly(1, 2, 3);
        verify(dispatcher, never()).dispatchIndependently(anyString(), any(), any());
        verify(jdbc, org.mockito.Mockito.times(2)).update(eq("update training_notification_log set status=?, reason_code=? where id=?"), eq("SENT"), eq(null), any(UUID.class));
    }

    // ------------------------------------------------------------------ the codes the module raises are the codes the registry is seeded with

    @Test
    void theRegistryCodeIsTheModuleCodeInLowerCase() {
        assertThat(TrainingNotificationEvents.registryCode("TRAINING_STEP_ASSIGNED")).isEqualTo("training.step_assigned");
        assertThat(TrainingNotificationEvents.registryCode("TRAINING_QA_LIST_LATE")).isEqualTo("training.qa_list_late");
    }

    @Test
    void everyEventIsSeededOnceWithAWording() {
        var events = TrainingNotificationEvents.all();
        assertThat(events.stream().map(TrainingNotificationEvents.Event::registryCode)).doesNotHaveDuplicates().allMatch(code -> code.startsWith("training."));
        assertThat(events).allSatisfy(event -> {
            assertThat(event.name()).isNotBlank();
            assertThat(event.description()).isNotBlank();
            assertThat(event.priority()).isIn("LOW", "MEDIUM", "HIGH");
            assertThat(event.registryCode().length()).isLessThanOrEqualTo(60);
        });
        // every Training notice is sent on both channels by default, including the two whose e-mail carries a PDF
        assertThat(events).extracting(TrainingNotificationEvents.Event::channels).containsOnly("IN_APP,EMAIL");
    }

    @Test
    void everyCodeTheTrainingServicesRaiseIsInTheRegistrySeed() throws IOException {
        // the event is the first argument of send and tell, or the third argument of the helpers of the matrix and the requirement; a call that passes it on in a variable is the helper itself
        Pattern direct = Pattern.compile("(?:notifier\\.send|\\btell)\\(\\s*\"(TRAINING_[A-Z_]+)\"|\\b(?:tell|tellPreparer)\\([^,\\n]+,[^,\\n]+,\\s*\"(TRAINING_[A-Z_]+)\"");
        Pattern either = Pattern.compile("notifier\\.send\\(\\s*\\w+\\s*\\?\\s*\"(TRAINING_[A-Z_]+)\"\\s*:\\s*\"(TRAINING_[A-Z_]+)\"");
        Set<String> raised = new HashSet<>();
        try (Stream<Path> files = Files.walk(Path.of("src/main/java/com/eqms/service/training"))) {
            for (Path file : files.filter(f -> f.toString().endsWith(".java")).toList()) {
                String source = Files.readString(file);
                for (Matcher m = direct.matcher(source); m.find(); ) raised.add(m.group(1) != null ? m.group(1) : m.group(2));
                for (Matcher m = either.matcher(source); m.find(); ) { raised.add(m.group(1)); raised.add(m.group(2)); }
            }
        }
        Set<String> seeded = TrainingNotificationEvents.all().stream().map(TrainingNotificationEvents.Event::code).collect(Collectors.toSet());
        assertThat(raised).as("the scan found the notices the module raises").hasSizeGreaterThan(35);
        assertThat(raised).as("codes the module raises that the registry is not seeded with (add them to TrainingNotificationEvents)").isSubsetOf(seeded);
        assertThat(seeded).as("seeded events nothing raises").isSubsetOf(raised);
    }
}
