package com.eqms.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.eqms.dto.document.WorkflowProgressResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

/** The stages of a backup are worked out on the server; these pin what the screen drew before the move. */
class BackupWorkflowTest {

    @Test
    void aFailedBackupStopsAtFailed() {
        WorkflowProgressResponse p = BackupWorkflow.of("FAILED", "NOT_VERIFIED");
        assertThat(p.steps()).extracting(s -> s.label()).containsExactly("Running", "Failed");
        assertThat(p.currentStepIndex()).isEqualTo(1);
        assertThat(p.steps().get(1).terminal()).isFalse();
    }

    @Test
    void anyOtherBackupRunsCompletesAndIsVerified() {
        assertThat(BackupWorkflow.of("RUNNING", null).steps()).extracting(s -> s.label()).containsExactly("Running", "Completed", "Verified");
        assertThat(BackupWorkflow.of("RUNNING", null).currentStepIndex()).isZero();
        assertThat(BackupWorkflow.of("COMPLETED", "NOT_VERIFIED").currentStepIndex()).isEqualTo(1);
        assertThat(BackupWorkflow.of("COMPLETED", "FAILED").currentStepIndex()).isEqualTo(1);
        assertThat(BackupWorkflow.of("COMPLETED", "VERIFIED").currentStepIndex()).isEqualTo(2);
        assertThat(BackupWorkflow.of("EXPIRED", null).currentStepIndex()).isEqualTo(1);
        assertThat(BackupWorkflow.of("EXPIRED", "VERIFIED").currentStepIndex()).isEqualTo(2);
    }

    @Test
    void itIsWrittenAsTheScreenReadsIt() {
        JsonNode json = new ObjectMapper().valueToTree(BackupWorkflow.of("COMPLETED", "VERIFIED"));
        assertThat(json.path("currentStepIndex").asInt()).isEqualTo(2);
        assertThat(json.path("steps").get(0).path("code").asText()).isEqualTo("RUNNING");
        assertThat(json.path("steps").get(0).path("label").asText()).isEqualTo("Running");
        assertThat(json.path("steps").get(0).path("terminal").isBoolean()).isTrue();
        assertThat(json.path("skippedSteps").isArray()).isTrue();
        assertThat(json.path("terminalProgressStep").asText()).isEmpty();
    }
}
