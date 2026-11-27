package com.eqms.service;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.UserAccountRepository;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.transaction.PlatformTransactionManager;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** A document is marked "notified" only when the expiry notice was really handled (86 were marked while nobody was told). */
class DocumentExpiryNotifierTest {

    private final NotificationDispatcher dispatcher = Mockito.mock(NotificationDispatcher.class);
    private final UserAccountRepository users = Mockito.mock(UserAccountRepository.class);
    private final DocumentExpiryProcessingService processing = Mockito.mock(DocumentExpiryProcessingService.class);
    private final com.eqms.repository.DocumentRecordRepository documents = Mockito.mock(com.eqms.repository.DocumentRecordRepository.class);
    private final PermissionEvaluationService permissions = Mockito.mock(PermissionEvaluationService.class);
    private final PlatformTransactionManager transactions = Mockito.mock(PlatformTransactionManager.class);
    private final DocumentExpiryNotifier notifier = new DocumentExpiryNotifier(dispatcher, users, documents, permissions, processing, transactions);
    private final UUID documentId = UUID.randomUUID();
    private final Instant now = Instant.now();

    private void oneActiveUserNoCopyHolder() {
        UserAccount user = Mockito.mock(UserAccount.class);
        when(user.getId()).thenReturn(UUID.randomUUID());
        when(users.findAllByStatus(UserStatus.Active)).thenReturn(List.of(user));
        when(permissions.hasPermission(user, "documents.workspace.manage")).thenReturn(true); // Document Control is told
        when(processing.copyHolders(documentId)).thenReturn(List.of());
    }

    private static NotificationDispatcher.Outcome outcome(String blocked) {
        return new NotificationDispatcher.Outcome(blocked, true, true, blocked == null, blocked == null);
    }

    @Test
    void sentNoticeMarksTheDocumentNotified() {
        oneActiveUserNoCopyHolder();
        when(dispatcher.dispatch(eq("document.expired"), anyList(), anyMap())).thenReturn(outcome(null));

        notifier.notifyExpired(documentId, "SOP.0001", "Name", now);

        verify(processing).markNotified(documentId, now);
    }

    @Test
    void noticeWithNoRecipientIsNotMarkedSoItIsTriedAgain() {
        oneActiveUserNoCopyHolder();
        when(dispatcher.dispatch(eq("document.expired"), anyList(), anyMap())).thenReturn(outcome("NO_RECIPIENT"));

        notifier.notifyExpired(documentId, "SOP.0001", "Name", now);

        verify(processing, never()).markNotified(any(), any());
    }

    @Test
    void eventSwitchedOffOnPurposeIsMarkedBecauseThereIsNothingToRetry() {
        oneActiveUserNoCopyHolder();
        when(dispatcher.dispatch(eq("document.expired"), anyList(), anyMap())).thenReturn(outcome("POLICY_OFF"));

        notifier.notifyExpired(documentId, "SOP.0001", "Name", now);

        verify(processing).markNotified(documentId, now);
    }
}
