package com.eqms.service.report;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** REPORT-CHARTJS-2026-11-15: eight kinds of chart, the trend ones by month, the others by group; a preview and a layout preview draw every one. */
class ReportChartTypesTest {
    private StubChartRenderer renderer;

    @BeforeEach
    void install() { renderer = StubChartRenderer.install(); }

    @AfterEach
    void remove() { ReportCharts.use(null); }

    private static ReportLayout.Chart chart(String type, String field) { return new ReportLayout.Chart("By " + field, type, field, "COUNT", null); }

    @Test
    void aTemplateMayHaveEightKindsOfChart() {
        assertThat(ReportLayout.Chart.TYPES).containsExactlyInAnyOrder("BAR", "HORIZONTAL_BAR", "PIE", "DOUGHNUT", "POLAR_AREA", "RADAR", "LINE", "AREA");
        for (String type : ReportLayout.Chart.TYPES) chart(type, "status").validated();
        for (String bad : new String[] {"SCATTER", "bar", "", "DONUT"}) assertThatThrownBy(() -> chart(bad, "status").validated()).isInstanceOf(IllegalArgumentException.class).hasMessage("REPORT_CHART_INVALID");
        assertThatThrownBy(() -> new ReportLayout.Chart("t", null, "status", "COUNT", null).validated()).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void onlyTheLineAndTheAreaAreTrends() {
        assertThat(ReportLayout.Chart.trend("LINE")).isTrue();
        assertThat(ReportLayout.Chart.trend("AREA")).isTrue();
        for (String type : new String[] {"BAR", "HORIZONTAL_BAR", "PIE", "DOUGHNUT", "POLAR_AREA", "RADAR"}) assertThat(ReportLayout.Chart.trend(type)).as(type).isFalse();
    }

    @ParameterizedTest
    @ValueSource(strings = {"LINE", "AREA"})
    void aTrendGroupsTheRecordsByMonthOfTheDateAndNeedsADate(String type) {
        var rows = List.of(List.of("created"), List.of("03/10/2026"), List.of("05/10/2026 10:00:00"), List.of("01/12/2026"));
        var result = ReportCharts.calculate(List.of(chart(type, "created")), List.of("created"), rows).getFirst();
        assertThat(result.type()).isEqualTo(type);
        assertThat(result.points()).extracting(ReportCharts.Point::count).containsExactly(2L, 1L);
        assertThatThrownBy(() -> ReportCharts.calculate(List.of(chart(type, "created")), List.of("created"), List.of(List.of("created"), List.of("not a date"))))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("REPORT_CHART_DATE_REQUIRED");
    }

    @ParameterizedTest
    @ValueSource(strings = {"BAR", "HORIZONTAL_BAR", "PIE", "DOUGHNUT", "POLAR_AREA", "RADAR"})
    void theOtherKindsGroupByTheValueAndAddTheRestTogether(String type) {
        var rows = new ArrayList<List<String>>();
        rows.add(List.of("status"));
        for (int g = 0; g < 8; g++) for (int i = 0; i <= g; i++) rows.add(List.of("Group " + g));
        var five = new ReportLayout.Chart("t", type, "status", "COUNT", 5);
        var result = ReportCharts.calculate(List.of(five), List.of("status"), rows).getFirst();
        assertThat(result.points()).hasSize(5);
        assertThat(result.points().getLast().label()).startsWith("Other (");
        assertThat(result.points().stream().mapToLong(ReportCharts.Point::count).sum()).isEqualTo(36);
    }

    @Test
    void thePreviewDrawsASampleOfEveryKind_withTheNameOfTheFieldAndTheFontOfTheReport() throws Exception {
        for (String type : ReportLayout.Chart.TYPES) {
            var sample = ReportChartSamples.of(new ReportLayout.Chart("Documents", type, "status", "COUNT", null), "Status");
            assertThat(sample.title()).isEqualTo("Documents (sample data)");
            assertThat(sample.type()).isEqualTo(type);
            if (ReportLayout.Chart.trend(type)) assertThat(sample.points()).extracting(ReportCharts.Point::label).containsExactly("Jun", "Jul", "Aug", "Sep", "Oct", "Nov");
            else assertThat(sample.points().getFirst().label()).isEqualTo("Status A");
            assertThat(ReportCharts.png(sample, "OSWALD")).isNotEmpty();
        }
        assertThat(renderer.fonts).containsOnly("OSWALD");
        assertThat(renderer.drawn).hasSize(ReportLayout.Chart.TYPES.size());
    }

    @Test
    void aSampleHasTheLargestGroupsAndOneOtherGroup_andPercentsThatAddUp() {
        var sample = ReportChartSamples.of(new ReportLayout.Chart("Documents", "PIE", "status", "PERCENT", 5), "Status");
        assertThat(sample.points()).hasSize(5);
        assertThat(sample.points().getLast().label()).isEqualTo("Other (4 groups)");
        assertThat(sample.points().stream().mapToDouble(ReportCharts.Point::value).sum()).isBetween(99.9, 100.1);
        assertThatThrownBy(() -> ReportChartSamples.of(new ReportLayout.Chart("t", "WAVE", "status", "COUNT", null), "Status")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void aPdfAndAWorkbookCarryOneChartPageAndOneAnalysisSheetForEachChart() throws Exception {
        var rows = List.of(List.of("Status"), List.of("Active"), List.of("Draft"), List.of("Active"));
        var charts = ReportCharts.calculate(List.of(chart("DOUGHNUT", "Status"), chart("HORIZONTAL_BAR", "Status")), List.of("Status"), rows);
        var layout = ReportLayout.defaults();
        var context = Map.of("report.title", "T", "report.code", "C", "template.version", "1", "report.executor", "A", "report.generatedAt", "g", "report.asOfAt", "a", "template.name", "T", "report.runId", "r");
        try (var pdf = org.apache.pdfbox.Loader.loadPDF(ReportPresentationRenderer.render("PDF", rows, layout, context, charts))) {
            assertThat(pdf.getNumberOfPages()).as("two chart pages and one page of the table").isEqualTo(3);
        }
        try (var book = new org.apache.poi.xssf.usermodel.XSSFWorkbook(new java.io.ByteArrayInputStream(ReportPresentationRenderer.render("XLSX", rows, layout, context, charts)))) {
            assertThat(book.getSheet("Analysis 1")).isNotNull();
            assertThat(book.getSheet("Analysis 2")).isNotNull();
            assertThat(book.getSheet("Analysis 1").createDrawingPatriarch().getShapes()).hasSize(1);
        }
        assertThat(renderer.drawn).hasSize(4);
    }

    @Test
    void aCsvHasNoChart() throws Exception {
        var rows = List.of(List.of("Status"), List.of("Active"));
        var charts = ReportCharts.calculate(List.of(chart("PIE", "Status")), List.of("Status"), rows);
        var context = Map.of("report.title", "T", "report.code", "C", "template.version", "1", "report.executor", "A", "report.generatedAt", "g", "report.asOfAt", "a", "template.name", "T", "report.runId", "r");
        try {
            ReportPresentationRenderer.render("CSV", rows, ReportLayout.defaults(), context, charts);
        } catch (Exception notThroughThisPath) {
            // a CSV is not made by this renderer; the point is that no chart was drawn for it
        }
        assertThat(renderer.drawn).isEmpty();
    }
}
