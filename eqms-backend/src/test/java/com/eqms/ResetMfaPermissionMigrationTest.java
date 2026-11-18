package com.eqms;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * V805 gives Reset MFA a permission of its own and hands it to every permission set that holds Reset Password (owner decision 2026-11-18). It is read as text (the Spring
 * tests of this project migrate the shared DEV database): the permission must be created once, depend on seeing users, and reach exactly the sets that hold Reset Password,
 * so that nobody loses the ability on the day it is applied.
 */
class ResetMfaPermissionMigrationTest {
    private static String v805() throws IOException {
        try (Stream<Path> files = Files.list(Paths.get("src/main/resources/db/migration"))) {
            return Files.readString(files.filter(p -> p.getFileName().toString().startsWith("V805__")).findFirst().orElseThrow());
        }
    }

    @Test
    void thePermissionIsCreatedOnceAndDoesNotTouchThePermissionDependencyTableThatV747Dropped() throws IOException {
        String sql = v805();

        assertThat(sql).contains("'settings.user.reset_mfa'").contains("ON CONFLICT (code) DO NOTHING");
        // the first run on DEV failed on "relation permission_dependencies does not exist": V747 dropped that table
        assertThat(sql.replaceAll("(?m)^--.*$", "")).doesNotContain("permission_dependencies");
    }

    @Test
    void everySetThatHoldsResetPasswordGetsItAndNothingElseDoes() throws IOException {
        String sql = v805();

        assertThat(sql).contains("held.code = 'settings.user.reset_password'");
        assertThat(sql).contains("mfa.code = 'settings.user.reset_mfa'");
        assertThat(sql).contains("ON CONFLICT (permission_set_id, permission_id) DO NOTHING");
        assertThat(sql).doesNotContain("DELETE").doesNotContain("UPDATE ");
    }
}
