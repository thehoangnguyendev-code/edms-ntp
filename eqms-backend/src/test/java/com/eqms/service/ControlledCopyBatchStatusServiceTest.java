package com.eqms.service;

import com.eqms.entity.ControlledCopyRecord;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Locks down the aggregate-status invariant: a distribution batch is a summary
 * of its child copies and must never invent a lifecycle state of its own.
 */
class ControlledCopyBatchStatusServiceTest {

    private final ControlledCopyBatchStatusService service = new ControlledCopyBatchStatusService(null, null);

    @Test
    void usesDistributedWhileAnyChildIsStillDistributed() {
        assertThat(service.deriveExpectedStatus(List.of(
                copy("DISTRIBUTED"),
                copy("OBSOLETED"),
                copy("CLOSED_CANCELLED")
        ), "READY_FOR_DISTRIBUTION")).isEqualTo("DISTRIBUTED");
    }

    @Test
    void usesObsoletedOnlyWhenEveryNonCancelledChildIsObsoleted() {
        assertThat(service.deriveExpectedStatus(List.of(
                copy("OBSOLETED"),
                copy("CLOSED_CANCELLED")
        ), "DISTRIBUTED")).isEqualTo("OBSOLETED");
    }

    @Test
    void usesClosedCancelledOnlyWhenEveryChildIsCancelled() {
        assertThat(service.deriveExpectedStatus(List.of(
                copy("CLOSED_CANCELLED"),
                copy("CLOSED_CANCELLED")
        ), "READY_FOR_DISTRIBUTION")).isEqualTo("CLOSED_CANCELLED");
    }

    @Test
    void retainsCurrentStatusWhenChildrenHaveNoRecognisedLifecycleState() {
        assertThat(service.deriveExpectedStatus(List.of(copy("UNKNOWN")), "READY_FOR_DISTRIBUTION"))
                .isEqualTo("READY_FOR_DISTRIBUTION");
    }

    private ControlledCopyRecord copy(String statusCode) {
        ControlledCopyRecord copy = new ControlledCopyRecord();
        copy.setStatusCode(statusCode);
        return copy;
    }
}
