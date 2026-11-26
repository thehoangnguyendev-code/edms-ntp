package com.eqms.service;

import org.junit.jupiter.api.Test;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class ControlledCopyBatchNotificationTransactionTest {

    /** Sending writes to the e-mail outbox: in a read-only transaction the database refuses and nobody is told that the batch was cancelled. */
    @Test
    void the_notification_of_a_cancelled_batch_runs_in_a_transaction_that_may_write() throws Exception {
        Transactional transaction = ControlledCopyService.class
                .getMethod("notifyBatchCancelled", UUID.class, UUID.class, int.class, int.class, int.class)
                .getAnnotation(Transactional.class);

        assertThat(transaction).isNotNull();
        assertThat(transaction.readOnly()).isFalse();
    }
}
