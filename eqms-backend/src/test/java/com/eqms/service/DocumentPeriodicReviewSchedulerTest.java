package com.eqms.service;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.UserAccountRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** NOTIFICATION-ADMIN-2026-11-12: the author and the owner are told when the periodic review of a document is due and again when it is overdue, once for each review date. */
class DocumentPeriodicReviewSchedulerTest {

    private JdbcTemplate jdbc;
    private UserAccountRepository users;
    private NotificationDispatcher dispatcher;
    private DocumentPeriodicReviewScheduler scheduler;
    private UserAccount author;
    private UserAccount owner;
    private final UUID documentId = UUID.randomUUID();
    private final LocalDate today = LocalDate.of(2026, 11, 12);

    private UserAccount person(UserStatus status) {
        UserAccount user = new UserAccount();
        user.setId(UUID.randomUUID());
        user.setStatus(status);
        return user;
    }

    private Map<String, Object> row(UUID authorId, UUID ownerId, LocalDate review) {
        Map<String, Object> row = new HashMap<>();
        row.put("id", documentId);
        row.put("document_number", "SOP.0016");
        row.put("document_name", "Gowning");
        row.put("author_user_id", authorId);
        row.put("owner_user_id", ownerId);
        row.put("review_date", java.sql.Date.valueOf(review));
        return row;
    }

    @BeforeEach
    void setUp() {
        jdbc = mock(JdbcTemplate.class);
        users = mock(UserAccountRepository.class);
        dispatcher = mock(NotificationDispatcher.class);
        scheduler = new DocumentPeriodicReviewScheduler(jdbc, users, dispatcher, mock(DistributedSchedulerLockService.class));
        author = person(UserStatus.Active);
        owner = person(UserStatus.Active);
        when(users.findById(author.getId())).thenReturn(Optional.of(author));
        when(users.findById(owner.getId())).thenReturn(Optional.of(owner));
        when(jdbc.update(anyString(), any(), eq(documentId), any())).thenReturn(1);
    }

    @Test
    void theAuthorAndTheOwnerAreToldWhenTheDaysBeforeTheReviewDateAreReached() {
        // the first query is the one of the reminder before the date, the second the one of the overdue reminder
        when(jdbc.queryForList(contains("review_date >= ?"), any(Object[].class))).thenReturn(List.of(row(author.getId(), owner.getId(), today.plusDays(20))));
        when(jdbc.queryForList(contains("review_date < ?"), any(Object[].class))).thenReturn(List.of());

        assertThat(scheduler.run(today)).isEqualTo(1);

        ArgumentCaptor<Map<String, String>> variables = ArgumentCaptor.forClass(Map.class);
        verify(dispatcher).dispatchIndependently(eq("document.periodic_review_due"), eq(List.of(author, owner)), variables.capture());
        assertThat(variables.getValue()).containsEntry("documentNumber", "SOP.0016").containsEntry("reviewDate", "02/12/2026")
                .containsEntry("reviewStatus", "is due for periodic review on").containsEntry("actionUrl", "/documents/" + documentId);
    }

    @Test
    void aReviewThatWasMissedIsToldAsOverdue() {
        when(jdbc.queryForList(contains("review_date >= ?"), any(Object[].class))).thenReturn(List.of());
        when(jdbc.queryForList(contains("review_date < ?"), any(Object[].class))).thenReturn(List.of(row(author.getId(), null, today.minusDays(3))));
        assertThat(scheduler.run(today)).isEqualTo(1);
        ArgumentCaptor<Map<String, String>> variables = ArgumentCaptor.forClass(Map.class);
        verify(dispatcher).dispatchIndependently(eq("document.periodic_review_due"), eq(List.of(author)), variables.capture());
        assertThat(variables.getValue()).containsEntry("reviewStatus", "is overdue for periodic review since").containsEntry("reviewDate", "09/11/2026");
    }

    @Test
    void aDocumentAnotherPassAlreadyClaimedIsNotRemindedTwice() {
        when(jdbc.queryForList(contains("review_date >= ?"), any(Object[].class))).thenReturn(List.of(row(author.getId(), owner.getId(), today.plusDays(5))));
        when(jdbc.queryForList(contains("review_date < ?"), any(Object[].class))).thenReturn(List.of());
        when(jdbc.update(anyString(), any(), eq(documentId), any())).thenReturn(0);
        assertThat(scheduler.run(today)).isZero();
        verify(dispatcher, never()).dispatchIndependently(anyString(), any(), any());
    }

    @Test
    void peopleWhoAreNoLongerActiveAreNotToldAndNobodyLeftMeansNoNotice() {
        author.setStatus(UserStatus.Suspended);
        owner.setStatus(UserStatus.Inactive);
        when(jdbc.queryForList(contains("review_date >= ?"), any(Object[].class))).thenReturn(List.of(row(author.getId(), owner.getId(), today.plusDays(5))));
        when(jdbc.queryForList(contains("review_date < ?"), any(Object[].class))).thenReturn(List.of());
        assertThat(scheduler.run(today)).isZero();
        verify(dispatcher, never()).dispatchIndependently(anyString(), any(), any());
    }
}
