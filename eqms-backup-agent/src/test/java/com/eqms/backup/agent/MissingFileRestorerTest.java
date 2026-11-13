package com.eqms.backup.agent;

import com.eqms.backup.agent.backup.BackupRepository.Blob;
import com.eqms.backup.agent.restore.MissingFileRestorer;
import com.eqms.backup.agent.restore.RestoreRunEngine;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Adding missing files and checking that every file reference resolves. The store is in memory; the database is a throw-away one. */
class MissingFileRestorerTest {

    static final String SHA_A = "a".repeat(64);
    static final String SHA_B = "b".repeat(64);

    ControlDbTestSupport support;
    Connection restored;
    Set<String> storeVersions;   // bucket/key@version
    java.util.Map<String, Long> storeSizes;
    java.util.Map<String, String> storeHashes;
    int puts;
    String hashToReturn;
    MissingFileRestorer restorer;

    @BeforeEach
    void setUp() throws Exception {
        support = new ControlDbTestSupport();
        String name = support.createSourceDb();
        restored = DriverManager.getConnection("jdbc:postgresql://" + support.host() + ":" + support.port() + "/" + name, support.user(), support.password());
        try (Statement s = restored.createStatement()) {
            s.execute("alter table document_revisions add column if not exists fillable_template_storage_bucket text");
            s.execute("create table report_artifacts_unused(id int)");
        }
        storeVersions = new HashSet<>();
        storeSizes = new java.util.HashMap<>();
        storeHashes = new java.util.HashMap<>();
        puts = 0;
        hashToReturn = null;
        MissingFileRestorer.LiveStore store = new MissingFileRestorer.LiveStore() {
            public boolean hasVersion(String bucket, String key, String version) {
                if (version != null) return storeVersions.contains(bucket + "/" + key + "@" + version);
                return storeVersions.stream().anyMatch(v -> v.startsWith(bucket + "/" + key + "@"));
            }

            public String put(String bucket, String key, Path file) {
                puts++;
                String version = "new-" + puts;
                storeVersions.add(bucket + "/" + key + "@" + version);
                return version;
            }

            public Set<String> writableBuckets() {
                return Set.of("eqms-gmp-records");
            }

            public long sizeOf(String bucket, String key, String version) {
                return storeSizes.getOrDefault(bucket + "/" + key + "@" + version, -1L);
            }

            public String sha256Of(String bucket, String key, String version) {
                return storeHashes.get(bucket + "/" + key + "@" + version);
            }
        };
        MissingFileRestorer.BlobReader reader = (blob, dest) -> {
            Files.writeString(dest, "bytes");
            return hashToReturn != null ? hashToReturn : blob.plainSha256();
        };
        restorer = new MissingFileRestorer(store, reader);
    }

    @AfterEach
    void tearDown() throws Exception {
        restored.close();
        support.close();
    }

    private static Blob blob(String bucket, String key, String version, String sha) {
        return new Blob(bucket, key, version, sha, 5, "c".repeat(64), 9, "objects/x.gpg", UUID.randomUUID());
    }

    private void revision(String id, String bucket, String key, String version) throws Exception {
        try (Statement s = restored.createStatement()) {
            s.execute("insert into document_revisions(id, status_code, source_storage_bucket, source_storage_object_key, source_storage_version_id) values ('" + id + "','EFFECTIVE','" + bucket + "','" + key + "','" + version + "')");
        }
    }

    private int aliases() throws Exception {
        try (Statement s = restored.createStatement(); var rs = s.executeQuery("select count(*) from object_version_alias")) {
            rs.next();
            return rs.getInt(1);
        }
    }

    @Test
    void missingFileIsAddedAndAliasedAndPresentFileIsUntouched() throws Exception {
        revision("r1", "eqms-gmp-records", "docs/a.docx", "v1");
        revision("r2", "eqms-gmp-records", "docs/b.docx", "v2");
        storeVersions.add("eqms-gmp-records/docs/b.docx@v2");
        var result = restorer.run(() -> List.of(blob("eqms-gmp-records", "docs/a.docx", "v1", SHA_A), blob("eqms-gmp-records", "docs/b.docx", "v2", SHA_B)), restored);
        assertThat(result.added()).isEqualTo(1);
        assertThat(result.present()).isEqualTo(1);
        assertThat(puts).isEqualTo(1);
        assertThat(aliases()).isEqualTo(1);
        assertThat(result.references()).isEqualTo(2);
        assertThat(result.notChecked()).isNotEmpty();
    }

    @Test
    void aStoredVersionWithTheRecordedSizeAndContentIsLeftAlone() throws Exception {
        revision("r1", "eqms-gmp-records", "docs/a.docx", "v1");
        storeVersions.add("eqms-gmp-records/docs/a.docx@v1");
        storeSizes.put("eqms-gmp-records/docs/a.docx@v1", 5L);
        storeHashes.put("eqms-gmp-records/docs/a.docx@v1", SHA_A);
        var result = restorer.run(() -> List.of(blob("eqms-gmp-records", "docs/a.docx", "v1", SHA_A)), restored);
        assertThat(result.present()).isEqualTo(1);
        assertThat(result.repaired()).isEmpty();
        assertThat(puts).isZero();
        assertThat(aliases()).isZero();
    }

    @Test
    void aStoredVersionOfAnotherSizeIsNotOverwrittenButTheRightContentIsAddedWithAnAlias() throws Exception {
        revision("r1", "eqms-gmp-records", "docs/a.docx", "v1");
        storeVersions.add("eqms-gmp-records/docs/a.docx@v1");
        storeSizes.put("eqms-gmp-records/docs/a.docx@v1", 7L);
        var result = restorer.run(() -> List.of(blob("eqms-gmp-records", "docs/a.docx", "v1", SHA_A)), restored);
        assertThat(result.present()).isZero();
        assertThat(result.repaired()).hasSize(1);
        assertThat(result.repaired().get(0)).contains("its size is 7 bytes").contains("new-1");
        assertThat(puts).isEqualTo(1);
        assertThat(aliases()).isEqualTo(1);
        assertThat(result.unresolved()).isEmpty();
        assertThat(restorer.toDetail(result)).containsEntry("differentFilesRepaired", 1);
    }

    @Test
    void aStoredVersionOfTheSameSizeButOtherContentIsRepairedTheSameWay() throws Exception {
        revision("r1", "eqms-gmp-records", "docs/a.docx", "v1");
        storeVersions.add("eqms-gmp-records/docs/a.docx@v1");
        storeSizes.put("eqms-gmp-records/docs/a.docx@v1", 5L);
        storeHashes.put("eqms-gmp-records/docs/a.docx@v1", SHA_B);
        var result = restorer.run(() -> List.of(blob("eqms-gmp-records", "docs/a.docx", "v1", SHA_A)), restored);
        assertThat(result.repaired().get(0)).contains("content differs");
        assertThat(aliases()).isEqualTo(1);
    }

    @Test
    void whenTheBackupAlsoHoldsOtherContentItIsReportedAsNotRepairedAndNothingIsWritten() throws Exception {
        revision("r1", "eqms-gmp-records", "docs/a.docx", "v1");
        storeVersions.add("eqms-gmp-records/docs/a.docx@v1");
        storeHashes.put("eqms-gmp-records/docs/a.docx@v1", SHA_B);
        hashToReturn = SHA_B;
        var result = restorer.run(() -> List.of(blob("eqms-gmp-records", "docs/a.docx", "v1", SHA_A)), restored);
        assertThat(result.repaired()).isEmpty();
        assertThat(result.unrepairable()).hasSize(1);
        assertThat(result.unrepairable().get(0)).contains("backup does not hold the recorded content");
        assertThat(puts).isZero();
        assertThat(aliases()).isZero();
        assertThat(restorer.toDetail(result)).containsEntry("warningDifferentFilesNotRepaired", 1);
    }

    @Test
    void aDifferentFileInAReadOnlyBucketIsReportedNotWritten() throws Exception {
        storeVersions.add("eqms-legacy/old.pdf@v1");
        storeSizes.put("eqms-legacy/old.pdf@v1", 99L);
        var result = restorer.run(() -> List.of(blob("eqms-legacy", "old.pdf", "v1", SHA_A)), restored);
        assertThat(result.unrepairable()).hasSize(1);
        assertThat(result.unrepairable().get(0)).contains("read only");
        assertThat(puts).isZero();
    }

    @Test
    void referenceToAFileThatNeitherTheBackupNorTheStoreHasIsReportedAsAWarning() throws Exception {
        revision("r1", "eqms-gmp-records", "docs/lost.docx", "v9");
        var result = restorer.run(List::of, restored);
        assertThat(result.unresolved()).hasSize(1);
        assertThat(result.unresolved().get(0)).contains("docs/lost.docx@v9");
        assertThat(restorer.toDetail(result)).containsEntry("warningUnresolvedReferences", 1);
    }

    @Test
    void hashMismatchStopsBeforeAnythingIsWritten() throws Exception {
        revision("r1", "eqms-gmp-records", "docs/a.docx", "v1");
        hashToReturn = SHA_B;
        assertThatThrownBy(() -> restorer.run(() -> List.of(blob("eqms-gmp-records", "docs/a.docx", "v1", SHA_A)), restored))
                .isInstanceOf(RestoreRunEngine.StepFailure.class).hasMessageContaining("different content");
        assertThat(puts).isZero();
        assertThat(aliases()).isZero();
    }

    @Test
    void bucketOutsideTheWritableListIsRefused() throws Exception {
        assertThatThrownBy(() -> restorer.run(() -> List.of(blob("eqms-other", "k", "v", SHA_A)), restored))
                .isInstanceOf(RestoreRunEngine.StepFailure.class).hasMessageContaining("eqms-other");
        assertThat(puts).isZero();
    }

    @Test
    void aFileAlreadyPresentInAReadOnlyBucketIsAccepted() throws Exception {
        storeVersions.add("eqms-legacy/old.pdf@v1");
        var result = restorer.run(() -> List.of(blob("eqms-legacy", "old.pdf", "v1", SHA_A)), restored);
        assertThat(result.present()).isEqualTo(1);
        assertThat(puts).isZero();
    }

    @Test
    void anUnregisteredFileColumnStopsTheStep() throws Exception {
        try (Statement s = restored.createStatement()) {
            s.execute("create table new_scans(id int, scan_object_key text)");
        }
        assertThatThrownBy(() -> restorer.run(List::of, restored)).isInstanceOf(RestoreRunEngine.StepFailure.class)
                .hasMessageContaining("UNREGISTERED file column new_scans.scan_object_key");
    }
}
