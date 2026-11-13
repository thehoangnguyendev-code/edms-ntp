package com.eqms.service;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.UserAccountRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
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
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** NOTIFICATION-ADMIN-2026-11-12: a recalled printed copy that is not destroyed is reminded to the holder and Document Control, once for each week. */
class ControlledCopyRecallOverdueSchedulerTest {

    private JdbcTemplate jdbc;
    private UserAccountRepository users;
    private NotificationDispatcher dispatcher;
    private ControlledCopyRecallOverdueScheduler scheduler;
    private UserAccount holder;
    private final UUID copyId = UUID.randomUUID();

    private Map<String, Object> row(UUID holderId) {
        java.util.HashMap<String, Object> row = new java.util.HashMap<>();
        row.put("id", copyId);
        row.put("controlled_copy_number", "CC-0001");
        row.put("document_number", "SOP.0001");
        row.put("document_title", "Cleaning");
        row.put("recipient_user_id", holderId);
        row.put("recalled_at", java.sql.Timestamp.from(Instant.parse("2026-11-01T01:00:00Z")));
        return row;
    }

    @BeforeEach
    void setUp() {
        jdbc = mock(JdbcTemplate.class);
        users = mock(UserAccountRepository.class);
        dispatcher = mock(NotificationDispatcher.class);
        scheduler = new ControlledCopyRecallOverdueScheduler(jdbc, users, dispatcher, mock(DistributedSchedulerLockService.class));
        holder = new UserAccount();
        holder.setId(UUID.randomUUID());
        holder.setStatus(UserStatus.Active);
        when(users.findById(holder.getId())).thenReturn(Optional.of(holder));
        when(jdbc.update(anyString(), eq(copyId), any())).thenReturn(1);
    }

    @Test
    void theHolderIsNamedToTheEventAndTheWordsSayWhichCopyAndWhatToDo() {
        when(jdbc.queryForList(anyString(), any(Object[].class))).thenReturn(List.of(row(holder.getId())));

        assertThat(scheduler.run()).isEqualTo(1);

        ArgumentCaptor<Map<String, String>> variables = ArgumentCaptor.forClass(Map.class);
        verify(dispatcher).dispatchIndependently(eq("controlled_copy.recall_overdue"), eq(List.of(holder)), variables.capture());
        assertThat(variables.getValue()).containsEntry("title", "Recalled copy not returned: CC-0001").containsEntry("actionUrl", "/controlled-copies");
        assertThat(variables.getValue().get("message")).contains("CC-0001").contains("SOP.0001").contains("Return the printed copy to Document Control");
    }

    @Test
    void aCopyWhoseHolderIsGoneIsStillReportedToDocumentControlByTheEventsOwnRules() {
        when(jdbc.queryForList(anyString(), any(Object[].class))).thenReturn(List.of(row(null)));
        assertThat(scheduler.run()).isEqualTo(1);
        verify(dispatcher).dispatchIndependently(eq("controlled_copy.recall_overdue"), eq(List.of()), any());
    }

    @Test
    void aCopyAnotherPassAlreadyClaimedThisWeekIsNotRemindedAgain() {
        when(jdbc.queryForList(anyString(), any(Object[].class))).thenReturn(List.of(row(holder.getId())));
        when(jdbc.update(anyString(), eq(copyId), any())).thenReturn(0);
        assertThat(scheduler.run()).isZero();
        verify(dispatcher, never()).dispatchIndependently(anyString(), any(), any());
    }
}
