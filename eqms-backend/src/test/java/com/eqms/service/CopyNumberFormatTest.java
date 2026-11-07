package com.eqms.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** The number of a copy: Controlled is CC.SOP.0007.001, Uncontrolled is the same with a U in front (UCC.SOP.0007.001). */
class CopyNumberFormatTest {
    @Test
    void aControlledAndAnUncontrolledCopyOfTheSameDocumentDifferOnlyByTheU() {
        String base = CopyNumberFormat.baseCode("SOP.0007");
        assertThat(CopyNumberFormat.controlled(base, 1)).isEqualTo("CC.SOP.0007.001");
        assertThat(CopyNumberFormat.uncontrolled(base, 1)).isEqualTo("UCC.SOP.0007.001");
        assertThat("U" + CopyNumberFormat.controlled(base, 12)).isEqualTo(CopyNumberFormat.uncontrolled(base, 12));
    }

    @Test
    void theDocumentNumberIsCutAtEverySeparatorAndJoinedWithDots() {
        assertThat(CopyNumberFormat.baseCode("SOP-0007")).isEqualTo("SOP.0007");
        assertThat(CopyNumberFormat.baseCode("SOP_0007")).isEqualTo("SOP.0007");
        assertThat(CopyNumberFormat.baseCode("  SOP 0007  ")).isEqualTo("SOP.0007");
        assertThat(CopyNumberFormat.baseCode("SOP.EXT.0007")).isEqualTo("SOP.0007");
        assertThat(CopyNumberFormat.baseCode("QA.SOP.0037")).isEqualTo("QA.SOP.0037");
        assertThat(CopyNumberFormat.baseCode(null)).isEmpty();
        assertThat(CopyNumberFormat.baseCode("   ")).isEmpty();
    }

    @Test
    void theSerialHasThreeDigitsAndGrowsPastThem() {
        assertThat(CopyNumberFormat.uncontrolled("SOP.0007", 7)).isEqualTo("UCC.SOP.0007.007");
        assertThat(CopyNumberFormat.uncontrolled("SOP.0007", 1000)).isEqualTo("UCC.SOP.0007.1000");
    }
}
