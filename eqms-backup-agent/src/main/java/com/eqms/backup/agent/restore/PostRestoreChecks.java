package com.eqms.backup.agent.restore;

import com.fasterxml.jackson.databind.JsonNode;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.TreeSet;

/**
 * The checks of SDS 14.3 that can be run on a restored database alone (C1 to C4). The others (documents against files, the
 * application starting, schedulers, external dependencies, version aliases) need the application or an object store restored
 * next to the database and are not claimed here.
 */
public final class PostRestoreChecks {

    public record Result(String code, String title, boolean required, boolean ok, String detail) {
    }

    private PostRestoreChecks() {
    }

    static List<Result> run(Connection db, JsonNode manifest, Instant snapshotAt) throws SQLException {
        List<Result> out = new ArrayList<>();
        JsonNode database = databaseComponent(manifest);
        out.add(schemaVersion(db, manifest));
        out.add(rowCounts(db, database));
        out.add(foreignKeys(db));
        out.add(auditTrail(db, snapshotAt));
        return out;
    }

    private static JsonNode databaseComponent(JsonNode manifest) {
        for (JsonNode c : manifest.path("components")) {
            if ("DATABASE".equals(c.path("key").asText())) return c;
        }
        return manifest.path("components").path(0);
    }

    /** C1: the newest Flyway migration in the restored database is the one the manifest says the backup was taken at. */
    private static Result schemaVersion(Connection db, JsonNode manifest) throws SQLException {
        String expected = manifest.path("app").path("flywayLatest").asText(null);
        String got = null;
        try (Statement st = db.createStatement(); ResultSet rs = st.executeQuery(
                "select case when to_regclass('public.flyway_schema_history') is null then null "
                        + "else (select max(version::int)::text from flyway_schema_history where version ~ '^[0-9]+$') end")) {
            if (rs.next()) got = rs.getString(1);
        }
        boolean ok = expected != null && expected.equals(got);
        return new Result("C1", "Schema version matches the backup", true, ok, ok ? "Schema version " + got : "The backup was taken at schema " + expected + " but the restored database is at " + got);
    }

    /** C2: every table has exactly the rows the manifest counted, there are no extra or missing tables, and the large objects match. */
    private static Result rowCounts(Connection db, JsonNode database) throws SQLException {
        Map<String, Long> expected = new TreeMap<>();
        Iterator<Map.Entry<String, JsonNode>> fields = database.path("rowCounts").fields();
        while (fields.hasNext()) {
            Map.Entry<String, JsonNode> f = fields.next();
            expected.put(f.getKey(), f.getValue().asLong());
        }
        TreeSet<String> actualTables = new TreeSet<>();
        try (Statement st = db.createStatement(); ResultSet rs = st.executeQuery("select tablename from pg_tables where schemaname = 'public'")) {
            while (rs.next()) actualTables.add(rs.getString(1));
        }
        List<String> problems = new ArrayList<>();
        for (String table : expected.keySet()) {
            if (!actualTables.contains(table)) {
                problems.add(table + " is missing");
                continue;
            }
            long count;
            try (PreparedStatement ps = db.prepareStatement("select count(*) from public." + quote(table)); ResultSet rs = ps.executeQuery()) {
                rs.next();
                count = rs.getLong(1);
            }
            if (count != expected.get(table)) problems.add(table + " has " + count + " rows, the backup counted " + expected.get(table));
        }
        for (String table : actualTables) {
            if (!expected.containsKey(table)) problems.add(table + " was not in the backup");
        }
        long largeObjects;
        try (Statement st = db.createStatement(); ResultSet rs = st.executeQuery("select count(*) from pg_largeobject_metadata")) {
            rs.next();
            largeObjects = rs.getLong(1);
        }
        long wantedLargeObjects = database.path("largeObjectCount").asLong(0);
        if (largeObjects != wantedLargeObjects) problems.add("large objects: " + largeObjects + " restored, " + wantedLargeObjects + " in the backup");
        boolean ok = problems.isEmpty();
        return new Result("C2", "Row counts and large objects match the backup", true, ok,
                ok ? expected.size() + " tables and " + largeObjects + " large objects match" : String.join("; ", problems.subList(0, Math.min(problems.size(), 10))) + (problems.size() > 10 ? " (and " + (problems.size() - 10) + " more)" : ""));
    }

    /** C3: no row points at a row that is not there. Foreign keys with a null column are skipped, as the database itself does. */
    private static Result foreignKeys(Connection db) throws SQLException {
        record Fk(String name, String child, String parent, List<String> cols, List<String> parentCols) {
        }
        List<Fk> keys = new ArrayList<>();
        try (Statement st = db.createStatement(); ResultSet rs = st.executeQuery(
                "select c.conname, cn.nspname || '.' || cl.relname as child, pn.nspname || '.' || pl.relname as parent, "
                        + "(select array_agg(a.attname::text order by k.ord) from unnest(c.conkey) with ordinality k(attnum, ord) join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum) as cols, "
                        + "(select array_agg(a.attname::text order by k.ord) from unnest(c.confkey) with ordinality k(attnum, ord) join pg_attribute a on a.attrelid = c.confrelid and a.attnum = k.attnum) as pcols "
                        + "from pg_constraint c join pg_class cl on cl.oid = c.conrelid join pg_namespace cn on cn.oid = cl.relnamespace "
                        + "join pg_class pl on pl.oid = c.confrelid join pg_namespace pn on pn.oid = pl.relnamespace "
                        + "where c.contype = 'f' and cn.nspname = 'public' order by 1, 2")) {
            while (rs.next()) {
                keys.add(new Fk(rs.getString(1), rs.getString(2), rs.getString(3), List.of((String[]) rs.getArray(4).getArray()), List.of((String[]) rs.getArray(5).getArray())));
            }
        }
        List<String> problems = new ArrayList<>();
        for (Fk fk : keys) {
            StringBuilder sql = new StringBuilder("select count(*) from ").append(qualified(fk.child())).append(" ch where ");
            for (int i = 0; i < fk.cols().size(); i++) sql.append(i == 0 ? "" : " and ").append("ch.").append(quote(fk.cols().get(i))).append(" is not null");
            sql.append(" and not exists (select 1 from ").append(qualified(fk.parent())).append(" p where ");
            for (int i = 0; i < fk.cols().size(); i++) sql.append(i == 0 ? "" : " and ").append("p.").append(quote(fk.parentCols().get(i))).append(" = ch.").append(quote(fk.cols().get(i)));
            sql.append(")");
            try (Statement st = db.createStatement(); ResultSet rs = st.executeQuery(sql.toString())) {
                rs.next();
                long orphans = rs.getLong(1);
                if (orphans > 0) problems.add(fk.name() + ": " + orphans + " row(s) in " + fk.child() + " point nowhere");
            }
        }
        boolean ok = problems.isEmpty();
        return new Result("C3", "No row points at a missing row", true, ok,
                ok ? keys.size() + " foreign keys checked" : String.join("; ", problems.subList(0, Math.min(problems.size(), 10))));
    }

    /**
     * C4: the audit trail is as the backup left it. The table has no sequence number or hash chain, so continuity cannot be
     * proven from the data; what can be shown is that it is there, holds nothing newer than the backup, and still has its
     * protection against change.
     */
    private static Result auditTrail(Connection db, Instant snapshotAt) throws SQLException {
        List<String> problems = new ArrayList<>();
        boolean table;
        try (Statement st = db.createStatement(); ResultSet rs = st.executeQuery("select to_regclass('public.audit_logs') is not null")) {
            rs.next();
            table = rs.getBoolean(1);
        }
        if (!table) {
            return new Result("C4", "Audit trail is intact", true, false, "The audit_logs table is missing");
        }
        try (PreparedStatement ps = db.prepareStatement("select count(*) from public.audit_logs where created_at > ?")) {
            ps.setTimestamp(1, Timestamp.from(snapshotAt));
            try (ResultSet rs = ps.executeQuery()) {
                rs.next();
                if (rs.getLong(1) > 0) problems.add(rs.getLong(1) + " audit row(s) are newer than the backup");
            }
        }
        try (Statement st = db.createStatement(); ResultSet rs = st.executeQuery(
                "select count(*) from pg_trigger t where t.tgrelid = 'public.audit_logs'::regclass and t.tgname = 'trg_audit_logs_immutable' and not t.tgisinternal")) {
            rs.next();
            if (rs.getLong(1) == 0) problems.add("the trigger that forbids changing audit rows is missing");
        }
        boolean ok = problems.isEmpty();
        return new Result("C4", "Audit trail is intact", true, ok,
                ok ? "Nothing newer than the backup and still protected against change. Sequence continuity cannot be proven: the table has no sequence number or hash chain." : String.join("; ", problems));
    }

    private static String quote(String identifier) {
        return "\"" + identifier.replace("\"", "\"\"") + "\"";
    }

    private static String qualified(String name) {
        int dot = name.indexOf('.');
        return quote(name.substring(0, dot)) + "." + quote(name.substring(dot + 1));
    }
}
