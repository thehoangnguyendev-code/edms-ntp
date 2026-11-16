package com.eqms.util;

import com.eqms.service.report.ReportPresentationRenderer;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class CsvBomTest {

    @Test
    void aReportCsvStartsWithTheUtf8ByteOrderMarkAndKeepsItsText() {
        byte[] file = ReportPresentationRenderer.csvText(List.of(List.of("Tên", "Trạng thái"), List.of("Nguyễn Văn A", "Hoạt động"))).getBytes(StandardCharsets.UTF_8);

        assertThat(file[0] & 0xFF).isEqualTo(0xEF);
        assertThat(file[1] & 0xFF).isEqualTo(0xBB);
        assertThat(file[2] & 0xFF).isEqualTo(0xBF);
        assertThat(new String(file, 3, file.length - 3, StandardCharsets.UTF_8)).startsWith("\"Tên\",\"Trạng thái\"" + '\n');
    }

    @Test
    void theByteOrderMarkIsWrittenOnceAtTheStartOnly() {
        String text = ReportPresentationRenderer.csvText(List.of(List.of("a"), List.of("b")));

        assertThat(text.startsWith(CsvSafety.BOM)).isTrue();
        assertThat(text.indexOf(CsvSafety.BOM, 1)).isEqualTo(-1);
    }
}
