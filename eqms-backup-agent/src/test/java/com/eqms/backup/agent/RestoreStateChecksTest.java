package com.eqms.backup.agent;

import com.eqms.backup.agent.restore.PostRestoreChecks;
import com.eqms.backup.agent.restore.RestoreStateChecks;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.net.ServerSocket;
import java.sql.Connection;
import java.sql.Statement;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** C8 to C10 and C12 of a restored copy (SDS 14.3). */
class RestoreStateChecksTest {

    ControlDbTestSupport db;
    Connection conn;

    @BeforeEach
    void setUp() throws Exception {
        db = new ControlDbTestSupport();
        conn = db.dataSource.getConnection();
        try (Statement st = conn.createStatement()) {
            st.execute("create table app_users(id serial primary key, status text)");
            st.execute("create table user_access_profiles(user_id int, access_profile_id int)");
            st.execute("create table report_schedules(id serial primary key, active boolean not null)");
            st.execute("create table controlled_copy_distribution_jobs(id serial primary key, status text)");
            st.execute("create table uncontrolled_copy_distribution_jobs(id serial primary key, status text)");
            st.execute("create table publishing_workspace_jobs(id serial primary key, status text)");
            st.execute("create table notification_dispatch_queue(id serial primary key, status text)");
        }
    }

    @AfterEach
    void tearDown() throws Exception {
        conn.close();
        db.close();
    }

    private void exec(String sql) throws Exception {
        try (Statement st = conn.createStatement()) {
            st.execute(sql);
        }
    }

    @Test
    void theRestoredCopyNeedsAnActiveAccountWithAProfile() throws Exception {
        PostRestoreChecks.Result none = RestoreStateChecks.users(conn);
        assertThat(none.ok()).isFalse();
        exec("insert into app_users(status) values ('Active')");
        exec("insert into user_access_profiles values (1, 1)");
        PostRestoreChecks.Result some = RestoreStateChecks.users(conn);
        assertThat(some.ok()).isTrue();
        assertThat(some.detail()).contains("not tested here");
    }

    @Test
    void everyScheduleIsSwitchedOffInTheRestoredCopy() throws Exception {
        exec("insert into report_schedules(active) values (true), (true), (false)");
        PostRestoreChecks.Result c9 = RestoreStateChecks.schedulers(conn);
        assertThat(c9.ok()).isTrue();
        assertThat(c9.detail()).startsWith("2 scheduled report(s) switched off");
    }

    @Test
    void aJobStillInProgressNeedsReviewAndFailsC10() throws Exception {
        exec("insert into publishing_workspace_jobs(status) values ('COMPLETED'), ('RUNNING')");
        PostRestoreChecks.Result c10 = RestoreStateChecks.jobs(conn);
        assertThat(c10.ok()).isFalse();
        assertThat(c10.detail()).contains("needs review").contains("publishing_workspace_jobs: 1");
        exec("update publishing_workspace_jobs set status = 'FAILED' where status = 'RUNNING'");
        assertThat(RestoreStateChecks.jobs(conn).ok()).isTrue();
    }

    @Test
    void anUnreachableServiceIsAWarningAndNeverRequired() throws Exception {
        try (ServerSocket open = new ServerSocket(0)) {
            int closed;
            try (ServerSocket tmp = new ServerSocket(0)) {
                closed = tmp.getLocalPort();
            }
            PostRestoreChecks.Result reachable = RestoreStateChecks.dependencies(List.of("127.0.0.1:" + open.getLocalPort()), 1000);
            assertThat(reachable.ok()).isTrue();
            PostRestoreChecks.Result missing = RestoreStateChecks.dependencies(List.of("127.0.0.1:" + closed), 1000);
            assertThat(missing.ok()).isFalse();
            assertThat(missing.required()).as("C12 is a warning").isFalse();
        }
    }
}
