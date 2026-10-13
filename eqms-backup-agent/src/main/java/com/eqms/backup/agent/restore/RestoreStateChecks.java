package com.eqms.backup.agent.restore;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

/**
 * The state checks of a restored copy (SDS 14.3, C8 to C10 and C12). They run on the scratch database only; the restored copy is
 * never started here, so C11 (the application answering on the restored data) is not run by the worker.
 */
public final class RestoreStateChecks {

    private RestoreStateChecks() {
    }

    /** C8: the restored copy has active accounts with access profiles. The sign-in of an administrator is not tested by the worker. */
    public static PostRestoreChecks.Result users(Connection scratch) throws SQLException {
        long active = count(scratch, "select count(*) from app_users where status = 'Active'");
        long profiles = count(scratch, "select count(*) from user_access_profiles");
        boolean ok = active > 0 && profiles > 0;
        return new PostRestoreChecks.Result("C8", "Accounts and permissions are present in the restored copy", true, ok,
                active + " active account(s), " + profiles + " access profile assignment(s). Sign-in of an administrator is not tested here (no running application).");
    }

    /**
     * C9: every scheduled report is switched off in the restored copy before anything can start it. The restored copy is the scratch
     * database, so switching off here changes no production schedule.
     */
    public static PostRestoreChecks.Result schedulers(Connection scratch) throws SQLException {
        int switched;
        try (Statement st = scratch.createStatement()) {
            switched = st.executeUpdate("update report_schedules set active = false where active");
        }
        long stillOn = count(scratch, "select count(*) from report_schedules where active");
        return new PostRestoreChecks.Result("C9", "Every scheduler is off in the restored copy", true, stillOn == 0,
                switched + " scheduled report(s) switched off in the restored copy; " + stillOn + " still on");
    }

    /** The job tables and the statuses that end a job. Any other status is a job that was in progress when the backup was taken. */
    private static final String[][] JOBS = {
            {"controlled_copy_distribution_jobs", "COMPLETED", "FAILED", "CANCELLED"},
            {"uncontrolled_copy_distribution_jobs", "COMPLETED", "FAILED", "CANCELLED"},
            {"publishing_workspace_jobs", "COMPLETED", "FAILED", "CANCELLED"},
            {"notification_dispatch_queue", "SENT", "FAILED", "CANCELLED"},
    };

    /** C10: no job is left in progress; each one has to be reviewed by a person before the restored copy is used. */
    public static PostRestoreChecks.Result jobs(Connection scratch) throws SQLException {
        List<String> open = new ArrayList<>();
        for (String[] job : JOBS) {
            StringBuilder terminal = new StringBuilder();
            for (int i = 1; i < job.length; i++) terminal.append(i == 1 ? "'" : ",'").append(job[i]).append("'");
            long n = count(scratch, "select count(*) from " + job[0] + " where status not in (" + terminal + ") or status is null");
            if (n > 0) open.add(job[0] + ": " + n);
        }
        boolean ok = open.isEmpty();
        return new PostRestoreChecks.Result("C10", "No job is left in progress in the restored copy", true, ok,
                ok ? "no job in progress" : "needs review: " + String.join("; ", open));
    }

    /** C12: the external services the application needs can be reached. A warning only: it never fails the rehearsal. */
    public static PostRestoreChecks.Result dependencies(List<String> endpoints, int timeoutMillis) {
        List<String> unreachable = new ArrayList<>();
        for (String endpoint : endpoints) {
            int colon = endpoint.lastIndexOf(':');
            if (colon <= 0) {
                unreachable.add(endpoint + " (not host:port)");
                continue;
            }
            try (Socket socket = new Socket()) {
                socket.connect(new InetSocketAddress(endpoint.substring(0, colon), Integer.parseInt(endpoint.substring(colon + 1))), timeoutMillis);
            } catch (IOException | IllegalArgumentException e) {
                unreachable.add(endpoint);
            }
        }
        boolean ok = unreachable.isEmpty();
        return new PostRestoreChecks.Result("C12", "The external services are reachable from the restore worker", false, ok,
                ok ? endpoints.size() + " service(s) reachable" : "not reachable: " + String.join(", ", unreachable));
    }

    private static long count(Connection scratch, String sql) throws SQLException {
        try (Statement st = scratch.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            rs.next();
            return rs.getLong(1);
        }
    }
}
