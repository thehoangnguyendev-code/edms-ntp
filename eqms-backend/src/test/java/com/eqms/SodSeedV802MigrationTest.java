package com.eqms;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * V802 seeds the SoD constraints of Training, Reports, Backup and Access Profile (owner decision 2026-11-18). It is read as text, never run against a database (the Spring tests of this
 * project migrate the shared DEV database), and checked for what a wrong row would cost: a permission that does not exist (a rule that can never fire), the same pair twice, a pair of
 * one permission with itself, a severity the table refuses, and the restore request/approve pair that the owner kept out of the software.
 */
class SodSeedV802MigrationTest {
    private static final Path MIGRATIONS = Paths.get("src/main/resources/db/migration");
    private static final Pattern ROW = Pattern.compile("'([a-z_]+(?:\\.[a-z_]+)+)',\\s*'([a-z_]+(?:\\.[a-z_]+)+)',\\s*'(WARN|BLOCK)'");
    private static final Pattern CODE = Pattern.compile("'([a-z_]+(?:\\.[a-z_]+){2,})'");

    private static String v802() throws IOException {
        try (Stream<Path> files = Files.list(MIGRATIONS)) {
            Path file = files.filter(p -> p.getFileName().toString().startsWith("V802__")).findFirst().orElseThrow();
            return Files.readString(file);
        }
    }

    private static Set<String> permissionCodesSeededElsewhere() throws IOException {
        Set<String> codes = new HashSet<>();
        try (Stream<Path> files = Files.list(MIGRATIONS)) {
            for (Path file : files.filter(p -> !p.getFileName().toString().startsWith("V802__")).toList()) {
                Matcher m = CODE.matcher(Files.readString(file));
                while (m.find()) codes.add(m.group(1));
            }
        }
        return codes;
    }

    private record Pair(String a, String b, String severity) {}

    private static List<Pair> pairs(String sql) {
        Matcher m = ROW.matcher(sql);
        List<Pair> rows = new java.util.ArrayList<>();
        while (m.find()) rows.add(new Pair(m.group(1), m.group(2), m.group(3)));
        return rows;
    }

    @Test
    void everyRowNamesTwoDifferentPermissionsThatExistInTheCatalogue() throws IOException {
        List<Pair> rows = pairs(v802());
        Set<String> known = permissionCodesSeededElsewhere();

        assertThat(rows).hasSize(10);
        for (Pair row : rows) {
            assertThat(row.a()).as("pair of itself").isNotEqualTo(row.b());
            assertThat(known).as("permission of " + row).contains(row.a(), row.b());
        }
    }

    @Test
    void noPairIsRepeatedInEitherOrderAndTheSeverityIsAskedForByRisk() throws IOException {
        List<Pair> rows = pairs(v802());
        Set<String> unordered = new HashSet<>();
        for (Pair row : rows) {
            String key = row.a().compareTo(row.b()) < 0 ? row.a() + "|" + row.b() : row.b() + "|" + row.a();
            assertThat(unordered.add(key)).as("repeated " + key).isTrue();
        }
        // self-approval pairs are refused, the weaker ones are warned about
        assertThat(rows).filteredOn(r -> r.severity().equals("BLOCK")).hasSize(7);
        assertThat(rows).filteredOn(r -> r.severity().equals("WARN")).extracting(Pair::a)
                .containsExactlyInAnyOrder("training.assignment.manage", "training.content.review", "security.access_profiles.assign");
    }

    @Test
    void theFileIsIdempotentAndMakesSystemRowsThatAreActive() throws IOException {
        String sql = v802();

        assertThat(sql).contains("WHERE NOT EXISTS");
        assertThat(sql).contains("true, true"); // active, system
        assertThat(sql).doesNotContain("DELETE").doesNotContain("UPDATE sod_constraints");
    }

    @Test
    void theRestoreRequestAndApprovePairIsNotSeededBecauseTheSoftwareHasNoRestoreApproval() throws IOException {
        String sql = v802().replaceAll("(?m)^--.*$", "");

        assertThat(sql).doesNotContain("backup.restore.request").doesNotContain("backup.restore.approve").doesNotContain("backup.restore.execute");
    }
}
