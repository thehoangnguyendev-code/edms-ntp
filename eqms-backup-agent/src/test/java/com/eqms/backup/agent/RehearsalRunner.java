package com.eqms.backup.agent;

import com.eqms.backup.agent.exec.CommandRunner;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.HexFormat;
import java.util.List;

/**
 * Stands in for gpg and pg_restore during a rehearsal test. "Decrypting" strips the prefix the fake encryption adds; "restoring"
 * copies the stand-in source database's tables into the scratch database the service created, so the checks run against real
 * rows in a real (scratch) PostgreSQL database.
 */
final class RehearsalRunner implements CommandRunner {

    final String sourceDb;
    final String url;
    final String user;
    final String password;
    List<String> secretKeys = List.of("9E084A71AF15D574");
    boolean restoreFails;
    /** Called after the copy, to damage the restored database in a test. */
    java.util.function.Consumer<Statement> afterRestore = s -> {
    };
    String restoredInto;

    RehearsalRunner(String sourceDb, String url, String user, String password) {
        this.sourceDb = sourceDb;
        this.url = url;
        this.user = user;
        this.password = password;
    }

    private static String target(Command command, String flag) {
        List<String> a = command.argv();
        return a.get(a.indexOf(flag) + 1);
    }

    @Override
    public Result run(Command command, long timeoutSeconds) throws IOException {
        String joined = String.join(" ", command.argv());
        if (joined.contains("--list-secret-keys")) {
            StringBuilder out = new StringBuilder("sec:u:255:22:ABCDEF0123456789:1::::::scESC:::::ed25519:::0:\n");
            for (String id : secretKeys) out.append("ssb:u:255:18:").append(id).append(":1::::::e:::::cv25519::\n");
            return new Result(0, secretKeys.isEmpty() ? "" : out.toString(), "");
        }
        if (joined.contains("--decrypt")) {
            Path file = Path.of(command.argv().get(command.argv().size() - 1));
            return new Result(0, strip(Files.readAllBytes(file)), "");
        }
        return new Result(0, "", "");
    }

    @Override
    public PipelineResult pipelineToFile(List<Command> commands, Path out, long timeoutSeconds) throws IOException {
        if (commands.size() == 1) {
            // one command only: a stored document being decrypted, not a database restore
            byte[] plain = run(commands.get(0), timeoutSeconds).stdout().getBytes(java.nio.charset.StandardCharsets.UTF_8);
            Files.write(out, plain, java.nio.file.StandardOpenOption.CREATE_NEW);
            try {
                return new PipelineResult(List.of(0), HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(plain)), plain.length, "");
            } catch (java.security.NoSuchAlgorithmException e) {
                throw new IllegalStateException(e);
            }
        }
        if (restoreFails) return new PipelineResult(List.of(0, 1), "", 0, "pg_restore: error: could not execute query");
        String db = target(commands.get(1), "-d");
        restoredInto = db;
        String base = url.substring(0, url.lastIndexOf('/') + 1);
        try (Connection src = DriverManager.getConnection(base + sourceDb, user, password); Connection dst = DriverManager.getConnection(base + db, user, password);
             Statement ds = dst.createStatement()) {
            ds.execute("create table documents(id serial primary key, title text)");
            ds.execute("create table audit_logs(id serial primary key, what text, created_at timestamptz default now())");
            ds.execute("create table flyway_schema_history(version text)");
            // the tables the state checks read (SDS 14.3); empty except for one active account
            ds.execute("create table document_revisions(id text primary key, status_code text, source_storage_bucket text, source_storage_object_key text, source_storage_version_id text, source_file_checksum text)");
            ds.execute("create table electronic_signatures(id serial primary key, revision_id text, meaning text, document_checksum_after_sign text, signed_at timestamptz default now())");
            ds.execute("create table app_users(id serial primary key, status text)");
            ds.execute("create table user_access_profiles(user_id int, access_profile_id int)");
            ds.execute("create table report_schedules(id serial primary key, active boolean not null)");
            ds.execute("create table controlled_copy_distribution_jobs(id serial primary key, status text)");
            ds.execute("create table uncontrolled_copy_distribution_jobs(id serial primary key, status text)");
            ds.execute("create table publishing_workspace_jobs(id serial primary key, status text)");
            ds.execute("create table notification_dispatch_queue(id serial primary key, status text)");
            ds.execute("insert into app_users(status) values ('Active')");
            ds.execute("insert into user_access_profiles(user_id, access_profile_id) values (1, 1)");
            try (Statement ss = src.createStatement()) {
                for (String table : List.of("documents", "audit_logs", "flyway_schema_history")) {
                    try (ResultSet rs = ss.executeQuery("select * from " + table)) {
                        int cols = rs.getMetaData().getColumnCount();
                        while (rs.next()) {
                            StringBuilder names = new StringBuilder();
                            StringBuilder values = new StringBuilder();
                            for (int i = 1; i <= cols; i++) {
                                String name = rs.getMetaData().getColumnName(i);
                                if (name.equals("created_at")) continue;
                                names.append(names.length() == 0 ? "" : ",").append(name);
                                values.append(values.length() == 0 ? "" : ",").append(rs.getObject(i) == null ? "null" : "'" + rs.getString(i).replace("'", "''") + "'");
                            }
                            ds.execute("insert into " + table + "(" + names + ") values (" + values + ")");
                        }
                    }
                }
            }
            ds.execute("update audit_logs set created_at = '2000-01-01'");
            ds.execute("create function keep_audit() returns trigger as $$ begin return new; end $$ language plpgsql");
            ds.execute("create trigger trg_audit_logs_immutable before update on audit_logs for each row execute function keep_audit()");
            afterRestore.accept(ds);
        } catch (java.sql.SQLException e) {
            throw new IOException(e);
        }
        return new PipelineResult(List.of(0, 0), "", 0, "");
    }

    @Override
    public StreamResult encryptStream(java.io.InputStream input, Command command, Path out, long timeoutSeconds) {
        throw new UnsupportedOperationException("not used in a rehearsal");
    }

    @Override
    public HashResult hashOutput(Command command, long timeoutSeconds) throws IOException {
        Path file = Path.of(command.argv().get(command.argv().size() - 1));
        if (!Files.exists(file)) return new HashResult(2, "", 0, "gpg: can't open file");
        byte[] plain = strip(Files.readAllBytes(file)).getBytes(StandardCharsets.UTF_8);
        try {
            return new HashResult(0, HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(plain)), plain.length, "");
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String strip(byte[] cipher) {
        String text = new String(cipher, StandardCharsets.UTF_8);
        return text.startsWith("FAKE-ENC|") ? text.substring("FAKE-ENC|".length()) : text;
    }
}
