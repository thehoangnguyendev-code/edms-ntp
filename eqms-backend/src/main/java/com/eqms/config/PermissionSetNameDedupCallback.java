package com.eqms.config;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import org.flywaydb.core.api.MigrationVersion;
import org.flywaydb.core.api.callback.Callback;
import org.flywaydb.core.api.callback.Context;
import org.flywaydb.core.api.callback.Event;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Lets a database built from nothing reach migration V799.
 *
 * V799 makes a permission-set name unique ({@code lower(btrim(name))}). On the long-lived DEV database that is harmless because the older seed sets of V150
 * ({@code DOCUMENT_AUTHOR}, {@code DOCUMENT_REVIEWER}, {@code DOCUMENT_APPROVER}) had been removed by hand, but V150 and V219 both create a set with those names
 * ({@code PS_DOCUMENT_*}), so on a new database V799 fails and the whole installation stops (found 2026-11-21 by running the backend suite on an empty database).
 *
 * V799 and V150/V219 are already published and applied elsewhere, so they must not change (Flyway checksums, validated records). This callback runs once, just before
 * V799, and only when two permission sets share a normalised name: it keeps the maintained {@code PS_} set, points the Access Profiles of the older one to it and removes
 * the older one. On a database that has no such pair (DEV and every database that already passed V799) it does nothing. Decision recorded as DEC-AUTHZ-2026-11-21-01 in the
 * Decision Log.
 */
@Component
public class PermissionSetNameDedupCallback implements Callback {

    static final String BEFORE_VERSION = "799";
    private static final Logger log = LoggerFactory.getLogger(PermissionSetNameDedupCallback.class);

    /** The set to keep is the maintained {@code PS_} one, then the oldest. */
    private static final String DUPLICATES_CTE = """
            WITH ranked AS (
              SELECT id, lower(btrim(name)) AS norm,
                     first_value(id) OVER w AS keep_id,
                     row_number() OVER w AS rn
              FROM permission_sets
              WINDOW w AS (PARTITION BY lower(btrim(name)) ORDER BY (code LIKE 'PS\\_%') DESC, created_at, code)
            ), dups AS (SELECT id, keep_id FROM ranked WHERE rn > 1)
            """;

    private static final String MOVE_ASSIGNMENTS = DUPLICATES_CTE + """
            INSERT INTO access_profile_permission_sets (access_profile_id, permission_set_id)
            SELECT a.access_profile_id, d.keep_id
            FROM access_profile_permission_sets a JOIN dups d ON d.id = a.permission_set_id
            ON CONFLICT DO NOTHING
            """;

    private static final String DELETE_DUPLICATES = DUPLICATES_CTE + """
            DELETE FROM permission_sets WHERE id IN (SELECT id FROM dups)
            """;

    @Override
    public boolean supports(Event event, Context context) {
        if (event != Event.BEFORE_EACH_MIGRATE || context.getMigrationInfo() == null || context.getMigrationInfo().getVersion() == null) {
            return false;
        }
        return context.getMigrationInfo().getVersion().equals(MigrationVersion.fromVersion(BEFORE_VERSION));
    }

    @Override
    public boolean canHandleInTransaction(Event event, Context context) {
        return true;
    }

    @Override
    public void handle(Event event, Context context) {
        Connection connection = context.getConnection();
        try (PreparedStatement move = connection.prepareStatement(MOVE_ASSIGNMENTS);
             PreparedStatement delete = connection.prepareStatement(DELETE_DUPLICATES)) {
            int moved = move.executeUpdate();
            int removed = delete.executeUpdate();
            // The deletes leave deferred constraint-trigger events pending, and PostgreSQL refuses V799's CREATE INDEX while any are pending in the same transaction.
            try (var settle = connection.createStatement()) {
                settle.execute("SET CONSTRAINTS ALL IMMEDIATE");
            }
            if (removed > 0) {
                log.warn("Before V{}: {} permission set(s) shared a name with a maintained one and were removed ({} profile assignment(s) moved to the kept set).", BEFORE_VERSION, removed, moved);
            }
        } catch (SQLException e) {
            throw new IllegalStateException("Could not make permission-set names unique before V" + BEFORE_VERSION, e);
        }
    }

    @Override
    public String getCallbackName() {
        return "PermissionSetNameDedupCallback";
    }
}
