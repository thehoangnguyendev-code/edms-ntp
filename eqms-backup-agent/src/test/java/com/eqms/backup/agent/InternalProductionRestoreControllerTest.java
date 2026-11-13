package com.eqms.backup.agent;

import com.eqms.backup.agent.api.InternalProductionRestoreController;
import com.eqms.backup.agent.export.ExportException;
import com.eqms.backup.agent.job.JobQueue;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** The queue and the control database accept the three production-restore jobs, and the controller's refusals hold. */
class InternalProductionRestoreControllerTest {

    ControlDbTestSupport db;
    InternalProductionRestoreController controller;

    @BeforeEach
    void setUp() throws Exception {
        db = new ControlDbTestSupport();
        controller = new InternalProductionRestoreController(new JobQueue(db.jdbc), db.jdbc);
    }

    @AfterEach
    void tearDown() throws Exception {
        db.close();
    }

    @SuppressWarnings("unchecked")
    private static java.util.Map<String, Object> pg(java.util.Map<String, Object> page) {
        return (java.util.Map<String, Object>) page.get("pagination");
    }

    @SuppressWarnings("unchecked")
    private static java.util.List<java.util.Map<String, Object>> rows(java.util.Map<String, Object> page) {
        return (java.util.List<java.util.Map<String, Object>>) page.get("data");
    }

    private int jobs(String type) {
        return db.jdbc.queryForObject("select count(*) from backup_job where job_type = ?", Integer.class, type);
    }

    @Test
    void eachActionQueuesItsOwnJobTypeWithPersonAndSignature() {
        assertThat(controller.restore(new InternalProductionRestoreController.RestoreRequest("BK-1", "qa.one", "SIG-1", null)).getStatusCode().value()).isEqualTo(202);
        controller.finalizeRestore("RS-0123456789ab", new InternalProductionRestoreController.ActionRequest("qa.two", "SIG-2"));
        controller.rollBack("RS-0123456789ab", new InternalProductionRestoreController.ActionRequest("admin.one", "SIG-3"));
        assertThat(jobs("RESTORE_PRODUCTION")).isEqualTo(1);
        assertThat(jobs("RESTORE_FINALIZE")).isEqualTo(1);
        assertThat(jobs("RESTORE_ROLLBACK")).isEqualTo(1);
        String payload = db.jdbc.queryForObject("select payload_json::text from backup_job where job_type = 'RESTORE_PRODUCTION'", String.class);
        assertThat(payload).contains("\"by\": \"qa.one\"").contains("\"signatureRef\": \"SIG-1\"").contains("BK-1");
    }

    @Test
    void thePartsToRestoreAreCheckedAndQueued() {
        assertThat(controller.restore(new InternalProductionRestoreController.RestoreRequest("BK-1", "qa.one", "SIG-1", java.util.List.of("OBJECT_STORE", "DATABASE", "DATABASE"))).getStatusCode().value()).isEqualTo(202);
        String payload = db.jdbc.queryForObject("select payload_json::text from backup_job where job_type = 'RESTORE_PRODUCTION'", String.class);
        assertThat(payload).contains("DATABASE").contains("OBJECT_STORE");
        assertThatThrownBy(() -> controller.restore(new InternalProductionRestoreController.RestoreRequest("BK-1", "qa.one", "SIG-1", java.util.List.of())))
                .isInstanceOf(ExportException.class).hasMessageContaining("Choose");
        assertThatThrownBy(() -> controller.restore(new InternalProductionRestoreController.RestoreRequest("BK-1", "qa.one", "SIG-1", java.util.List.of("EVERYTHING"))))
                .isInstanceOf(ExportException.class).hasMessageContaining("Unknown");
    }

    @Test
    void personAndSignatureAreRequired() {
        assertThatThrownBy(() -> controller.restore(new InternalProductionRestoreController.RestoreRequest("BK-1", "qa.one", " ", null)))
                .isInstanceOf(ExportException.class).hasMessageContaining("signature");
        assertThatThrownBy(() -> controller.restore(new InternalProductionRestoreController.RestoreRequest("BK-1", "", "SIG", null)))
                .isInstanceOf(ExportException.class);
        assertThatThrownBy(() -> controller.finalizeRestore("RS-0123456789ab", new InternalProductionRestoreController.ActionRequest("qa", null)))
                .isInstanceOf(ExportException.class);
        assertThat(jobs("RESTORE_PRODUCTION") + jobs("RESTORE_FINALIZE")).isZero();
    }

    @Test
    void aRestoreIsRefusedWhileAnotherWaitsForFinalization() {
        db.jdbc.update("insert into restore_outcome(run_code, backup_number, live_db, tag, kept_old_db, status, restored_by, restore_signature) "
                + "values ('RS-x', 'BK-0', 'eqms-database', 't1', 'eqms-database_pre_t1', 'PENDING_FINALIZATION', 'qa.one', 'SIG-0')");
        assertThatThrownBy(() -> controller.restore(new InternalProductionRestoreController.RestoreRequest("BK-1", "qa.one", "SIG-1", null)))
                .isInstanceOf(ExportException.class).hasMessageContaining("not been finalized");
        assertThat(jobs("RESTORE_PRODUCTION")).isZero();
        var page = controller.outcomes(null, null, null, null, null, null, null, "restoredAt", "desc", 1, 10, null);
        assertThat(rows(page)).hasSize(1);
        assertThat(rows(page).get(0)).containsEntry("status", "PENDING_FINALIZATION").containsEntry("restored_by", "qa.one");
    }

    @Test
    void thePartAndTheDateRangesFilterOnTheServerAndBadValuesAreRefused() {
        db.jdbc.update("insert into restore_outcome(run_code, backup_number, live_db, tag, kept_old_db, status, restored_by, restore_signature, restored_at, components, closed_by, closed_at, close_signature) "
                + "values ('RS-a', 'BK-1', 'db', 'a', 'k1', 'FINALIZED', 'qa.one', 'S', '2026-11-01T01:00:00Z', 'DATABASE,OBJECT_STORE', 'qa.two', '2026-11-02T01:00:00Z', 'S2')");
        db.jdbc.update("insert into restore_outcome(run_code, backup_number, live_db, tag, kept_old_db, status, restored_by, restore_signature, restored_at, components) "
                + "values ('RS-b', 'BK-2', 'db', 'b', 'k2', 'PENDING_FINALIZATION', 'qa.one', 'S', '2026-11-05T01:00:00Z', 'DATABASE')");
        db.jdbc.update("update restore_outcome set status = 'ROLLED_BACK', closed_by = 'qa.one', closed_at = '2026-11-06T01:00:00Z', close_signature = 'S3' where run_code = 'RS-b'");
        assertThat(rows(controller.outcomes(null, null, "OBJECT_STORE", null, null, null, null, "restoredAt", "desc", 1, 10, null))).extracting(r -> r.get("run_code")).containsExactly("RS-a");
        assertThat(rows(controller.outcomes(null, null, "database", null, null, null, null, "restoredAt", "desc", 1, 10, null))).hasSize(2);
        assertThat(rows(controller.outcomes(null, null, null, "2026-11-04T00:00:00Z", null, null, null, "restoredAt", "desc", 1, 10, null))).extracting(r -> r.get("run_code")).containsExactly("RS-b");
        assertThat(rows(controller.outcomes(null, null, null, null, "2026-11-03T00:00:00Z", null, null, "restoredAt", "desc", 1, 10, null))).extracting(r -> r.get("run_code")).containsExactly("RS-a");
        assertThat(rows(controller.outcomes(null, null, null, null, null, "2026-11-05T00:00:00Z", "2026-11-07T00:00:00Z", "closedAt", "asc", 1, 10, null))).extracting(r -> r.get("run_code")).containsExactly("RS-b");
        assertThat(rows(controller.outcomes(null, null, null, null, null, null, null, "closedBy", "asc", 1, 10, null))).hasSize(2);
        assertThatThrownBy(() -> controller.outcomes(null, null, "x'; drop table restore_outcome; --", null, null, null, null, "restoredAt", "desc", 1, 10, null))
                .isInstanceOf(ExportException.class);
        assertThatThrownBy(() -> controller.outcomes(null, null, null, "yesterday", null, null, null, "restoredAt", "desc", 1, 10, null)).isInstanceOf(ExportException.class);
        assertThat(db.jdbc.queryForObject("select count(*) from restore_outcome", Integer.class)).isEqualTo(2);
    }

    @Test
    void thePageIsFilteredSortedAndCutOnTheServer() {
        for (int i = 1; i <= 5; i++) {
            db.jdbc.update("insert into restore_outcome(run_code, backup_number, live_db, tag, kept_old_db, status, restored_by, restore_signature) values (?, ?, 'db', ?, ?, ?, 'qa.one', 'SIG')",
                    "RS-00000000000" + i, "BK-" + i, "t" + i, "db_pre_t" + i, i == 5 ? "PENDING_FINALIZATION" : "FINALIZED");
        }
        var first = controller.outcomes(null, null, null, null, null, null, null, "backupNumber", "asc", 1, 2, null);
        assertThat(pg(first)).containsEntry("total", 5L).containsEntry("totalPages", 3);
        assertThat(rows(first).get(0)).containsEntry("backup_number", "BK-1");
        var pending = controller.outcomes(null, "PENDING_FINALIZATION", null, null, null, null, null, "restoredAt", "desc", 1, 10, null);
        assertThat(pg(pending)).containsEntry("total", 1L);
        var found = controller.outcomes("bk-3", null, null, null, null, null, null, "restoredAt", "desc", 1, 10, null);
        assertThat(pg(found)).containsEntry("total", 1L);
        var none = controller.outcomes("100%", null, null, null, null, null, null, "restoredAt", "desc", 1, 10, null);
        assertThat(pg(none)).containsEntry("total", 0L);
        var beyond = controller.outcomes(null, null, null, null, null, null, null, "restoredAt", "desc", 99, 2, null);
        assertThat(pg(beyond)).containsEntry("page", 3);
    }

    @Test
    void theSearchFindsWhatTheScreenShowsAndPeopleTypedByTheirFullName() {
        for (int i = 1; i <= 3; i++) {
            db.jdbc.update("insert into restore_outcome(run_code, backup_number, live_db, tag, kept_old_db, status, restored_by, restore_signature) values (?, ?, 'db', ?, ?, ?, 'qa.one', 'SIG')",
                    "RS-00000000000" + i, "BK-" + i, "t" + i, "db_pre_t" + i, i == 3 ? "PENDING_FINALIZATION" : "ROLLED_BACK");
        }
        assertThat(pg(controller.outcomes("waiting", null, null, null, null, null, null, "restoredAt", "desc", 1, 10, null))).containsEntry("total", 1L);
        assertThat(pg(controller.outcomes("rolled back", null, null, null, null, null, null, "restoredAt", "desc", 1, 10, null))).containsEntry("total", 2L);
        assertThat(pg(controller.outcomes("database", null, null, null, null, null, null, "restoredAt", "desc", 1, 10, null))).containsEntry("total", 3L);
        // the full name matches nothing here; the user names behind it, sent by the backend, do
        assertThat(pg(controller.outcomes("Nguyen The Hoang", null, null, null, null, null, null, "restoredAt", "desc", 1, 10, null))).containsEntry("total", 0L);
        assertThat(pg(controller.outcomes("Nguyen The Hoang", null, null, null, null, null, null, "restoredAt", "desc", 1, 10, "qa.one"))).containsEntry("total", 3L);
    }
}
