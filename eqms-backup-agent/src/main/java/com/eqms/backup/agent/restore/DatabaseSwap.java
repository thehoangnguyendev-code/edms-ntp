package com.eqms.backup.agent.restore;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.regex.Pattern;

/**
 * The swap of SDS-BR-003 step 6 and the rollback of step 8. The restored database (already checked, in a scratch name) takes the name
 * of the live database; the old live database is kept under {@code <live>_pre_<tag>}. Nothing is dropped. A rollback exchanges them back
 * and keeps the failed-forward copy under {@code <live>_post_<tag>}. Each call either completes or leaves the names as they were.
 * The connection must be to a maintenance database (not the live one) with the right to rename databases.
 */
public class DatabaseSwap {

    private static final Pattern NAME = Pattern.compile("[a-z][a-z0-9_-]{0,40}");
    private static final Pattern TAG = Pattern.compile("[a-z0-9_]{1,24}");

    private static final Pattern FUNCTION = Pattern.compile("[a-z_][a-z0-9_]{0,40}");

    private final DataSource maintenance;
    private final String endSessionsFunction;
    private final String ownerRole;

    /** For a login that may end any session itself (a superuser): sessions are ended with pg_terminate_backend directly. */
    public DatabaseSwap(DataSource maintenance) {
        this(maintenance, null, null);
    }

    /**
     * For a login that is not a superuser. {@code endSessionsFunction} is a SECURITY DEFINER function in the maintenance database
     * that ends the sessions of one named database; {@code ownerRole}, when set, becomes the owner of the database that takes the live
     * name, so that the next swap and its rollback can rename it too.
     */
    public DatabaseSwap(DataSource maintenance, String endSessionsFunction, String ownerRole) {
        if (endSessionsFunction != null && !FUNCTION.matcher(endSessionsFunction).matches()) throw new IllegalArgumentException("Invalid function name");
        if (ownerRole != null && !FUNCTION.matcher(ownerRole).matches()) throw new IllegalArgumentException("Invalid role name");
        this.maintenance = maintenance;
        this.endSessionsFunction = endSessionsFunction;
        this.ownerRole = ownerRole;
    }

    public static String preName(String live, String tag) {
        return live + "_pre_" + tag;
    }

    public static String postName(String live, String tag) {
        return live + "_post_" + tag;
    }

    /** restored becomes live; live becomes live_pre_tag. */
    public void swapIn(String live, String restored, String tag) throws SQLException {
        check(live, restored, tag);
        String pre = preName(live, tag);
        if (exists(pre)) throw new SQLException("Kept database already exists: " + pre);
        if (!exists(live)) throw new SQLException("Live database not found: " + live);
        if (!exists(restored)) throw new SQLException("Restored database not found: " + restored);
        exchange(live, pre, restored, live);
    }

    /** True when the old live database of this run is kept, that is, the swap took place. */
    public boolean isSwapped(String live, String tag) throws SQLException {
        check(live, "x", tag);
        return exists(preName(live, tag));
    }

    /** Undo swapIn: the current live goes to live_post_tag, live_pre_tag returns as live. */
    public void rollBack(String live, String tag) throws SQLException {
        check(live, "x", tag);
        String pre = preName(live, tag);
        String post = postName(live, tag);
        if (!exists(pre)) throw new SQLException("Nothing to roll back to: " + pre + " not found");
        if (exists(post)) throw new SQLException("Rollback copy already exists: " + post);
        exchange(live, post, pre, live);
    }

    /** Renames first to firstNew, then second to secondNew; if the second fails the first is renamed back. */
    private void exchange(String first, String firstNew, String second, String secondNew) throws SQLException {
        try (Connection c = maintenance.getConnection(); Statement s = c.createStatement()) {
            c.setAutoCommit(true);
            s.execute("alter database \"" + first + "\" allow_connections false");
            s.execute("alter database \"" + second + "\" allow_connections false");
            try {
                end(s, first);
                end(s, second);
                s.execute("alter database \"" + first + "\" rename to \"" + firstNew + "\"");
                try {
                    s.execute("alter database \"" + second + "\" rename to \"" + secondNew + "\"");
                } catch (SQLException e) {
                    s.execute("alter database \"" + firstNew + "\" rename to \"" + first + "\"");
                    throw e;
                }
                if (ownerRole != null) s.execute("alter database \"" + secondNew + "\" owner to \"" + ownerRole + "\"");
            } finally {
                for (String n : new String[]{first, firstNew, second, secondNew}) {
                    if (exists(s, n)) s.execute("alter database \"" + n + "\" allow_connections true");
                }
            }
        }
    }

    private void end(Statement s, String db) throws SQLException {
        if (endSessionsFunction == null) {
            s.execute("select pg_terminate_backend(pid) from pg_stat_activity where datname = '" + db + "' and pid <> pg_backend_pid()");
        } else {
            s.execute("select public." + endSessionsFunction + "('" + db + "')");
        }
    }

    private boolean exists(String db) throws SQLException {
        try (Connection c = maintenance.getConnection(); Statement s = c.createStatement()) {
            return exists(s, db);
        }
    }

    private static boolean exists(Statement s, String db) throws SQLException {
        try (var rs = s.executeQuery("select 1 from pg_database where datname = '" + db + "'")) {
            return rs.next();
        }
    }

    private static void check(String live, String other, String tag) {
        if (!NAME.matcher(live).matches() || !NAME.matcher(other).matches() || !TAG.matcher(tag).matches())
            throw new IllegalArgumentException("Invalid database name or tag");
    }
}
