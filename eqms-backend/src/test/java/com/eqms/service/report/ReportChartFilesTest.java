package com.eqms.service.report;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

import java.io.ByteArrayInputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * REPORT-CHARTJS-2026-11-16, against the real chart renderer (EQMS_CHART_RENDERER_TEST_URL): a PDF carries the charts on its first page, or on its second when there is a cover, a
 * workbook has one Analysis sheet with a picture for each chart, and the files are written to target/chart-files for a person to look at.
 */
@EnabledIfEnvironmentVariable(named = "EQMS_CHART_RENDERER_TEST_URL", matches = ".+")
class ReportChartFilesTest {
    private static final Map<String, String> CONTEXT = Map.of("report.title", "Documents by status", "report.code", "RPT.0099", "template.version", "1", "report.executor", "A. Tester",
            "report.generatedAt", "16/11/2026 08:00:00", "report.asOfAt", "16/11/2026 07:59:00", "template.name", "Documents", "report.runId", "RUN-1");

    private static List<List<String>> rows() {
        var rows = new ArrayList<List<String>>();
        rows.add(List.of("Status", "Created"));
        String[] statuses = {"Effective", "Effective", "Effective", "Draft", "Draft", "Obsolete", "Pending Approval", "Cancelled"};
        for (int i = 0; i < 40; i++) rows.add(List.of(statuses[i % statuses.length], String.format("%02d/%02d/2026", 1 + (i % 28), 6 + (i % 5))));
        return rows;
    }

    private static List<ReportLayout.Chart> charts() {
        return List.of(new ReportLayout.Chart("Documents by status", "DOUGHNUT", "Status", "COUNT", null),
                new ReportLayout.Chart("Documents by status (share)", "HORIZONTAL_BAR", "Status", "PERCENT", null),
                new ReportLayout.Chart("Documents created per month", "AREA", "Created", "COUNT", null));
    }

    private static void register() {
        ReportCharts.use(new ChartJsRenderer(System.getenv("EQMS_CHART_RENDERER_TEST_URL"), System.getenv().getOrDefault("EQMS_CHART_RENDERER_TEST_TOKEN", ""), 30));
    }

    private static int picturesOf(PDPage page) throws Exception {
        int count = 0;
        for (var name : page.getResources().getXObjectNames()) if (page.getResources().getXObject(name) instanceof PDImageXObject) count++;
        return count;
    }

    @Test
    void aPdfCarriesItsChartsOnTheFirstPage_orTheSecondWhenThereIsACover_andACsvHasNone() throws Exception {
        register();
        var rows = rows();
        var calculated = ReportCharts.calculate(charts(), List.of("Status", "Created"), rows);
        Files.createDirectories(Path.of("target/chart-files"));
        for (boolean cover : new boolean[] {false, true}) {
            var base = ReportLayout.defaults().withCharts(charts());
            var layout = !cover ? base : new ReportLayout(true, base.coverTitle(), base.subtitle(), base.showExecutor(), base.showGeneratedAt(), base.header(), base.footer(), base.pageNumbers(),
                    base.watermarkEnabled(), base.watermark(), base.stampEnabled(), base.stamp(), base.watermarkStyle(), base.stampStyle(), base.logo(), base.charts(), base.orientation(),
                    base.wordComponents(), base.fontFamily(), base.frame(), base.coverTitleStyle(), base.coverSubtitleStyle());
            byte[] pdf = ReportPresentationRenderer.render("PDF", rows, layout, CONTEXT, calculated);
            Files.write(Path.of("target/chart-files/report-" + (cover ? "with-cover" : "no-cover") + ".pdf"), pdf);
            try (var document = Loader.loadPDF(pdf)) {
                int firstChart = cover ? 1 : 0;
                assertThat(document.getNumberOfPages()).as("charts, cover and the table").isGreaterThanOrEqualTo(charts().size() + 1 + (cover ? 1 : 0));
                for (int i = 0; i < charts().size(); i++) assertThat(picturesOf(document.getPage(firstChart + i))).as("page " + (firstChart + i + 1) + " carries chart " + (i + 1)).isEqualTo(1);
                if (cover) assertThat(picturesOf(document.getPage(0))).as("the cover is the first page, with no chart").isZero();
            }
        }
    }

    @Test
    void aWorkbookHasOneAnalysisSheetWithAPictureForEachChart() throws Exception {
        register();
        var rows = rows();
        var calculated = ReportCharts.calculate(charts(), List.of("Status", "Created"), rows);
        byte[] xlsx = ReportPresentationRenderer.render("XLSX", rows, ReportLayout.defaults(), CONTEXT, calculated);
        Files.createDirectories(Path.of("target/chart-files"));
        Files.write(Path.of("target/chart-files/report.xlsx"), xlsx);
        try (var book = new XSSFWorkbook(new ByteArrayInputStream(xlsx))) {
            for (int i = 1; i <= charts().size(); i++) {
                var sheet = book.getSheet("Analysis " + i);
                assertThat(sheet).as("Analysis " + i).isNotNull();
                assertThat(sheet.getRow(0).getCell(0).getStringCellValue()).isEqualTo(charts().get(i - 1).title());
                assertThat(sheet.createDrawingPatriarch().getShapes()).hasSize(1);
            }
            assertThat(book.getAllPictures()).hasSize(charts().size());
        }
    }
}
