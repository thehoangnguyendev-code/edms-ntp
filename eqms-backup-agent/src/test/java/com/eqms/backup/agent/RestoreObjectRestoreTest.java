package com.eqms.backup.agent;

import com.eqms.backup.agent.restore.PostRestoreChecks;
import com.eqms.backup.agent.restore.RestoreObjectRestore;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.sql.Connection;
import java.sql.Statement;
import java.util.HexFormat;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** The alias checks C13 and C7 on a scratch database (SDS 14.3): what passes, and what must fail. */
class RestoreObjectRestoreTest {

    @TempDir
    Path tmp;

    ControlDbTestSupport db;
    InMemoryTestObjectStore store;
    Connection conn;

    @BeforeEach
    void setUp() throws Exception {
        db = new ControlDbTestSupport();
        store = new InMemoryTestObjectStore();
        conn = db.dataSource.getConnection();
        try (Statement st = conn.createStatement()) {
            st.execute("drop table if exists c13_probe");
            st.execute("drop table if exists object_version_alias");
            st.execute("create table c13_probe (note text)");
            st.execute("drop table if exists electronic_signatures");
            st.execute("drop table if exists document_revisions");
            st.execute("create table document_revisions(id text primary key, status_code text, source_storage_bucket text, source_storage_object_key text, source_storage_version_id text, source_file_checksum text)");
            st.execute("create table electronic_signatures(id serial primary key, revision_id text, meaning text, document_checksum_after_sign text, signed_at timestamptz default now())");
            st.execute(RestoreObjectRestore.ALIAS_DDL);
        }
    }

    @AfterEach
    void tearDown() throws Exception {
        conn.close();
        db.close();
    }

    private static String sha256(byte[] bytes) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
    }

    private String storeBytes(String bucket, byte[] content) throws Exception {
        store.createVersionedBucket(bucket);
        Path file = Files.write(tmp.resolve("object.bin"), content);
        return store.put(bucket, "controlled-copies/a.pdf", file);
    }

    private void insertAlias(String originalVersion, String currentVersion, String sha, String currentBucket) throws Exception {
        try (Statement st = conn.createStatement()) {
            st.execute("insert into object_version_alias(bucket, object_key, original_version_id, current_version_id, sha256, current_bucket) values ("
                    + "'eqms-gmp-records', 'controlled-copies/a.pdf', '" + originalVersion + "', '" + currentVersion + "', '" + sha + "', '" + currentBucket + "')");
        }
    }

    private void insertReference(String uri) throws Exception {
        try (Statement st = conn.createStatement()) {
            st.execute("insert into c13_probe(note) values ('" + uri + "')");
        }
    }

    private static PostRestoreChecks.Result check(java.util.List<PostRestoreChecks.Result> results, String code) {
        return results.stream().filter(r -> r.code().equals(code)).findFirst().orElseThrow();
    }

    @Test
    void theTestBucketNameIsThePrefixAndTheRehearsalIdInLowerCase() {
        assertThat(RestoreObjectRestore.bucketFor("eqms-test-", "RH-20261009-0001")).isEqualTo("eqms-test-rh-20261009-0001");
        String longId = "RH-" + "9".repeat(80);
        assertThat(RestoreObjectRestore.bucketFor("eqms-test-", longId)).hasSize(63).startsWith("eqms-test-rh-");
    }

    @Test
    void aReferenceIsReadWithItsVersionAndEscapedKey() {
        RestoreObjectRestore.Reference ref = RestoreObjectRestore.parse("minio://eqms-gmp-records/controlled-copies/a%20b.pdf?versionId=V%2D1");
        assertThat(ref.bucket()).isEqualTo("eqms-gmp-records");
        assertThat(ref.key()).isEqualTo("controlled-copies/a b.pdf");
        assertThat(ref.versionId()).isEqualTo("V-1");
    }

    @Test
    void aReferenceWithoutAnAliasFailsC13AndTheStoredObjectIsOnlyListed() throws Exception {
        insertReference("minio://eqms-gmp-records/controlled-copies/a.pdf?versionId=V1");
        RestoreObjectRestore restore = new RestoreObjectRestore(store, null, "eqms-test-");
        store.createVersionedBucket("eqms-test-probe");
        var results = restore.checks(conn, new RestoreObjectRestore.Summary("eqms-test-probe", 0, 0));
        assertThat(check(results, "C13").ok()).isFalse();
        assertThat(check(results, "C13").detail()).contains("resolves to 0 alias");
        assertThat(check(results, "C7").ok()).as("C7 reports, it does not fail the rehearsal").isTrue();
    }

    @Test
    void aReferenceResolvedThroughItsAliasReadsBackTheRecordedBytes() throws Exception {
        byte[] content = "a controlled document".getBytes();
        String current = storeBytes("eqms-test-probe", content);
        insertAlias("V1", current, sha256(content), "eqms-test-probe");
        insertReference("minio://eqms-gmp-records/controlled-copies/a.pdf?versionId=V1");
        var results = new RestoreObjectRestore(store, null, "eqms-test-").checks(conn, new RestoreObjectRestore.Summary("eqms-test-probe", 1, content.length));
        assertThat(check(results, "C13").ok()).as(check(results, "C13").detail()).isTrue();
        assertThat(check(results, "C7").detail()).startsWith("0 orphan(s) of 1");
    }

    @Test
    void anAliasWhoseBytesDoNotMatchTheRecordedSha256FailsC13() throws Exception {
        byte[] content = "a controlled document".getBytes();
        String current = storeBytes("eqms-test-probe", content);
        insertAlias("V1", current, sha256("something else".getBytes()), "eqms-test-probe");
        insertReference("minio://eqms-gmp-records/controlled-copies/a.pdf?versionId=V1");
        var results = new RestoreObjectRestore(store, null, "eqms-test-").checks(conn, new RestoreObjectRestore.Summary("eqms-test-probe", 1, content.length));
        assertThat(check(results, "C13").ok()).isFalse();
        assertThat(check(results, "C13").detail()).contains("different bytes");
    }

    @Test
    void aReferenceWithNoVersionResolvesWhenTheBackupHoldsOneVersionOfThatKey() throws Exception {
        byte[] content = "one version only".getBytes();
        String current = storeBytes("eqms-test-probe", content);
        insertAlias("V1", current, sha256(content), "eqms-test-probe");
        insertReference("minio://eqms-gmp-records/controlled-copies/a.pdf");
        var results = new RestoreObjectRestore(store, null, "eqms-test-").checks(conn, new RestoreObjectRestore.Summary("eqms-test-probe", 1, content.length));
        assertThat(check(results, "C13").ok()).as(check(results, "C13").detail()).isTrue();
        assertThat(check(results, "C7").detail()).startsWith("0 orphan(s) of 1");
    }

    @Test
    void aKeyNamedInAPlainRecordColumnIsNotAnOrphan() throws Exception {
        byte[] content = "named by a record".getBytes();
        String current = storeBytes("eqms-test-probe", content);
        insertAlias("V1", current, sha256(content), "eqms-test-probe");
        try (Statement st = conn.createStatement()) {
            st.execute("insert into c13_probe(note) values ('controlled-copies/a.pdf')");
        }
        var results = new RestoreObjectRestore(store, null, "eqms-test-").checks(conn, new RestoreObjectRestore.Summary("eqms-test-probe", 1, content.length));
        assertThat(check(results, "C7").detail()).startsWith("0 orphan(s) of 1");
    }

    @Test
    void anObjectNoRecordRefersToIsListedAsAnOrphan() throws Exception {
        byte[] content = "unreferenced".getBytes();
        String current = storeBytes("eqms-test-probe", content);
        insertAlias("V9", current, sha256(content), "eqms-test-probe");
        var results = new RestoreObjectRestore(store, null, "eqms-test-").checks(conn, new RestoreObjectRestore.Summary("eqms-test-probe", 1, content.length));
        assertThat(check(results, "C7").detail()).startsWith("1 orphan(s) of 1").contains("ORPHAN controlled-copies/a.pdf");
        assertThat(check(results, "C13").ok()).as("the alias count matches the object count").isTrue();
    }

    private void effectiveRevision(String id, String sha, String currentVersion, String currentBucket) throws Exception {
        try (Statement st = conn.createStatement()) {
            st.execute("insert into document_revisions values ('" + id + "', 'EFFECTIVE', 'eqms-gmp-records', 'controlled-copies/a.pdf', 'V1', '" + sha + "')");
        }
        insertAlias("V1", currentVersion, sha, currentBucket);
    }

    private void signature(String revisionId, String meaning, String checksum) throws Exception {
        try (Statement st = conn.createStatement()) {
            st.execute("insert into electronic_signatures(revision_id, meaning, document_checksum_after_sign) values ('" + revisionId + "', '" + meaning + "', '" + checksum + "')");
        }
    }

    @Test
    void anEffectiveRevisionWithoutASignatureFailsC5() throws Exception {
        byte[] content = "published".getBytes();
        String current = storeBytes("eqms-test-probe", content);
        effectiveRevision("r1", sha256(content), current, "eqms-test-probe");
        var result = new RestoreObjectRestore(store, null, "eqms-test-").signatures(conn);
        assertThat(result.code()).isEqualTo("C5");
        assertThat(result.ok()).isFalse();
        assertThat(result.detail()).contains("1 unsigned");
    }

    @Test
    void aSignedEffectiveRevisionWhoseDocumentReadsBackToTheSignedChecksumPassesC5() throws Exception {
        byte[] content = "published".getBytes();
        String current = storeBytes("eqms-test-probe", content);
        effectiveRevision("r1", sha256(content), current, "eqms-test-probe");
        signature("r1", "PUBLISHED", sha256(content));
        var result = new RestoreObjectRestore(store, null, "eqms-test-").signatures(conn);
        assertThat(result.ok()).as(result.detail()).isTrue();
    }

    @Test
    void aDocumentThatDiffersFromItsSignedChecksumFailsC5() throws Exception {
        byte[] content = "published".getBytes();
        String current = storeBytes("eqms-test-probe", content);
        effectiveRevision("r1", sha256(content), current, "eqms-test-probe");
        signature("r1", "PUBLISHED", sha256("something else".getBytes()));
        var result = new RestoreObjectRestore(store, null, "eqms-test-").signatures(conn);
        assertThat(result.ok()).isFalse();
        assertThat(result.detail()).contains("does not match its recorded checksum");
    }

    @Test
    void onDevAnUnsignedRevisionIsAWarningAndDoesNotFailTheRehearsal() throws Exception {
        byte[] content = "unsigned".getBytes();
        String current = storeBytes("eqms-test-probe", content);
        effectiveRevision("r1", sha256(content), current, "eqms-test-probe");
        var result = new RestoreObjectRestore(store, null, "eqms-test-").signatures(conn, false);
        assertThat(result.ok()).isFalse();
        assertThat(result.required()).isFalse();
        assertThat(result.detail()).startsWith("DEV warning only");
    }

    @Test
    void aBucketOutsideTheTestPrefixIsNeverWritten() {
        RestoreObjectRestore restore = new RestoreObjectRestore(store, null, "eqms-test-");
        assertThatThrownBy(() -> restore.restore("eqms-gmp-records", java.util.UUID.randomUUID(), null, null, null, conn))
                .isInstanceOf(java.io.IOException.class)
                .hasMessageContaining("Refusing to restore objects");
        assertThat(store.exists("eqms-gmp-records")).isFalse();
    }
}
