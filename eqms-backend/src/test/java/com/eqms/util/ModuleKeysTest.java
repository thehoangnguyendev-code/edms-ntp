package com.eqms.util;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** One module has several spellings in the tables of the system; a filter on one finds the rows of the others, and a list shows each module once. */
class ModuleKeysTest {
    @Test
    void theSpellingsOfOneModuleAreTheSameModule() {
        assertThat(ModuleKeys.same("report", "reports")).isTrue();
        assertThat(ModuleKeys.same("REPORTS", "Report")).isTrue();
        assertThat(ModuleKeys.same("app-settings", "settings")).isTrue();
        assertThat(ModuleKeys.same("security-authorization", "security")).isTrue();
        assertThat(ModuleKeys.same("DOCUMENT_CONTROL", "documents")).isTrue();
        assertThat(ModuleKeys.same("Backup & Restore", "BACKUP_RESTORE")).isTrue();
        assertThat(ModuleKeys.same("training", "documents")).isFalse();
        assertThat(ModuleKeys.same(null, "")).isTrue();
        assertThat(ModuleKeys.same(null, "documents")).isFalse();
    }

    @Test
    void aKeyThatIsNotKnownStaysAsItIs() {
        assertThat(ModuleKeys.canonical("  some-new  ")).isEqualTo("some-new");
        assertThat(ModuleKeys.canonical(null)).isNull();
        assertThat(ModuleKeys.canonical("documents")).isEqualTo("documents");
        assertThat(ModuleKeys.canonical("DOCUMENT_CONTROL")).isEqualTo("documents");
    }

    @Test
    void everySpellingToCompareAColumnWithIsListed() {
        assertThat(ModuleKeys.compactSpellingsOf("documents")).contains("documents", "document", "documentcontrol");
        assertThat(ModuleKeys.compactSpellingsOf("BACKUP_RESTORE")).contains("backup", "backuprestore", "backup&restore");
        assertThat(ModuleKeys.compactSpellingsOf("")).isEmpty();
    }
}
