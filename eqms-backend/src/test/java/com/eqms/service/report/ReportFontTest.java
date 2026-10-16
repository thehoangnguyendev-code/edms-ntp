package com.eqms.service.report;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** The font of the whole report can be Times New Roman (Tinos, same widths), and Vietnamese text is kept in the PDF. */
class ReportFontTest {
    private static ReportLayout layout(String fontFamily, String markFont, String footer) {
        var mark = new ReportLayout.Mark("#64748b", 20, 36, 25, 20, 55, 70, "ALL", markFont, "ABOVE");
        return new ReportLayout(false, "{{report.title}}", "", true, true, "{{report.title}}", footer, true, true, "BẢN XEM TRƯỚC", false, "TEST", mark, null, null, null, "PORTRAIT", null, fontFamily);
    }

    private static final Map<String, String> VALUES = Map.of("report.title", "Báo cáo tình trạng tài liệu", "report.code", "RPT.0001", "template.version", "2",
            "template.name", "Sổ tài liệu", "report.runId", "RUN-1", "report.executor", "Nguyễn Văn A", "report.generatedAt", "2026-10-15T00:00:00Z", "report.asOfAt", "2026-10-15T00:00:00Z");
    private static final List<List<String>> ROWS = List.of(List.of("Số tài liệu", "Tên tài liệu"), List.of("SOP.0001", "Quy trình kiểm soát tài liệu"));

    private static String text(byte[] pdf) throws Exception {
        try (var document = Loader.loadPDF(pdf)) {
            return new PDFTextStripper().getText(document);
        }
    }

    @Test
    void aReportInTimesNewRomanKeepsVietnameseInTheTableTheHeaderAndTheNewTokens() throws Exception {
        var pdf = ReportPresentationRenderer.render("PDF", ROWS, layout("TIMES_NEW_ROMAN", "TIMES_NEW_ROMAN", "{{template.name}} · {{report.runId}} · Rev {{template.version}}"), VALUES, List.of());
        String extracted = text(pdf);
        assertThat(extracted).contains("Quy trình kiểm soát tài liệu").contains("Báo cáo tình trạng tài liệu").contains("RUN-1").contains("Sổ tài liệu");
    }

    @Test
    void theFontOfTheReportDefaultsToNotoSansAndAnUnknownFontIsRefused() {
        assertThat(layout(null, "NOTO_SANS", "x").effectiveFont()).isEqualTo("NOTO_SANS");
        assertThatThrownBy(() -> layout("COMIC_SANS", "NOTO_SANS", "x").validated()).hasMessage("REPORT_FONT_INVALID");
        assertThatThrownBy(() -> layout("NOTO_SANS", "COMIC_SANS", "x").validated()).hasMessage("REPORT_MARK_INVALID");
        layout("TIMES_NEW_ROMAN", "TIMES_NEW_ROMAN", "{{report.runId}}").validated();
    }

    @Test
    void theFontResourcesAreBundled() {
        for (String key : ReportFonts.KEYS) {
            assertThat(ReportFontTest.class.getResourceAsStream(ReportFonts.bodyResource(key))).as("body font " + key).isNotNull();
            assertThat(ReportFontTest.class.getResourceAsStream(ReportFonts.markResource(key))).as("mark font " + key).isNotNull();
        }
    }
}
