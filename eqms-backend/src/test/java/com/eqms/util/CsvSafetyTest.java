package com.eqms.util;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class CsvSafetyTest {

    @Test
    void escapeCell_neutralizesAllSpreadsheetFormulaPrefixesBeforeCsvEscaping() {
        for (String value : new String[]{"=1+1", "+1+1", "-1+1", "@SUM(A1)", "\t=1+1", "\r=1+1"}) {
            assertThat(CsvSafety.escapeCell(value)).startsWith("'");
        }
        assertThat(CsvSafety.escapeCell("normal, value")).isEqualTo("\"normal, value\"");
    }
}
