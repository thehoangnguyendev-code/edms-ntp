package com.eqms.backup.agent.restore;

import com.eqms.backup.agent.ControlDbTestSupport;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

/** C4: an audit row newer than the backup is a failure, but a row from the same second as the snapshot is inside the snapshot. */
class PostRestoreAuditCheckTest {

    private PostRestoreChecks.Result c4(String createdAtSql, Instant snapshotAt) throws Exception {
        try (ControlDbTestSupport support = new ControlDbTestSupport()) {
            String name = support.createSourceDb();
            try (Connection c = DriverManager.getConnection("jdbc:postgresql://" + support.host() + ":" + support.port() + "/" + name, support.user(), support.password());
                 Statement s = c.createStatement()) {
                s.execute("delete from audit_logs");
                s.execute("create or replace function forbid_audit_change() returns trigger as $$ begin return new; end $$ language plpgsql");
                s.execute("create trigger trg_audit_logs_immutable before update or delete on audit_logs for each row execute function forbid_audit_change()");
                s.execute("insert into audit_logs(what, created_at) values ('x', " + createdAtSql + ")");
                return PostRestoreChecks.run(c, new ObjectMapper().createObjectNode(), snapshotAt).stream().filter(r -> r.code().equals("C4")).findFirst().orElseThrow();
            }
        }
    }

    @Test
    void aRowFromTheSameSecondAsTheSnapshotIsInsideIt() throws Exception {
        Instant snapshot = Instant.parse("2026-11-09T16:20:56Z");
        PostRestoreChecks.Result r = c4("timestamptz '2026-11-09 16:20:56.866+00'", snapshot);
        assertThat(r.ok()).as(r.detail()).isTrue();
    }

    @Test
    void aRowClearlyNewerThanTheSnapshotFails() throws Exception {
        Instant snapshot = Instant.parse("2026-11-09T16:20:56Z");
        PostRestoreChecks.Result r = c4("timestamptz '2026-11-09 16:20:58+00'", snapshot);
        assertThat(r.ok()).isFalse();
        assertThat(r.detail()).contains("newer than the backup");
    }
}
