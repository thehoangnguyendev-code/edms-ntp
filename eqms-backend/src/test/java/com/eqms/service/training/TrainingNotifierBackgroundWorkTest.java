package com.eqms.service.training;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import com.eqms.service.NotificationDispatcher;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/** Slow work for a notice (a PDF made by the converter) never runs inside the request of the person who signed: it waits for the commit and then runs on the background thread. */
class TrainingNotifierBackgroundWorkTest {

    private final TrainingNotifier notifier = new TrainingNotifier(mock(JdbcTemplate.class), mock(NotificationDispatcher.class), mock(PlatformTransactionManager.class));

    @AfterEach
    void clean() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) TransactionSynchronizationManager.clearSynchronization();
    }

    @Test
    void withoutATransactionTheWorkRunsAtOnce() {
        AtomicReference<String> ran = new AtomicReference<>();
        notifier.afterCommitInBackground(() -> ran.set(Thread.currentThread().getName()));
        assertThat(ran.get()).isEqualTo(Thread.currentThread().getName());
    }

    @Test
    void insideATransactionTheWorkWaitsForTheCommitAndThenRunsOnTheBackgroundThread() throws Exception {
        TransactionSynchronizationManager.initSynchronization();
        CountDownLatch done = new CountDownLatch(1);
        AtomicReference<String> thread = new AtomicReference<>();
        notifier.afterCommitInBackground(() -> {
            thread.set(Thread.currentThread().getName());
            done.countDown();
        });
        assertThat(thread.get()).as("not before the commit").isNull();
        for (TransactionSynchronization synchronization : TransactionSynchronizationManager.getSynchronizations()) synchronization.afterCommit();
        assertThat(done.await(5, TimeUnit.SECONDS)).isTrue();
        assertThat(thread.get()).isEqualTo("training-notice-batch").isNotEqualTo(Thread.currentThread().getName());
    }

    @Test
    void aFailureOfTheWorkNeverReachesTheCaller() {
        notifier.afterCommitInBackground(() -> { throw new IllegalStateException("converter is down"); });
    }
}
