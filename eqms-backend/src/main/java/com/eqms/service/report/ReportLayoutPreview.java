package com.eqms.service.report;

import com.eqms.entity.UserAccount;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * A whole PDF of a layout drawn with made-up values and rows, never business data (REPORT-APPEARANCE-LIST-2026-11-15): the cover, the pages of the table and the last page, as a
 * real report would have them. The editor of a template and the list of appearances both use it, each after its own permission check.
 */
public final class ReportLayoutPreview {
    private ReportLayoutPreview() {}

    public static byte[] render(UserAccount actor, String title, ReportLayout layout, ReportWordService words) throws Exception {
        var now = com.eqms.util.DateTimeFormatUtils.formatDateTime(Instant.now());
        var context = new HashMap<String, String>(Map.of("report.title", title, "report.code", "LAYOUT_PREVIEW", "template.version", "draft",
                "report.executor", Objects.toString(actor.getFullName(), Objects.toString(actor.getUsername(), actor.getId().toString())), "report.generatedAt", now, "report.asOfAt", now,
                "template.name", title, "report.runId", "LAYOUT_PREVIEW"));
        // Sample values for the placeholders that a real run fills from its data, so that the preview shows how long they come out.
        context.put("report.filters", "status = ACTIVE; department = Quality Control");
        context.put("report.rowCount", "12");
        context.put("template.approvedBy", Objects.toString(actor.getFullName(), ""));
        context.put("template.approvedAt", "14/11/2026 09:00:00");
        context.put("report.executorDepartment", Objects.toString(actor.getDepartment(), ""));
        context.put("report.executorPosition", Objects.toString(actor.getPosition(), ""));
        context.put("report.gmpNotice", "For GMP decisions. Template revision 1.0.0 approved by (sample) on 14/11/2026 09:00:00. Report run (sample); data as of 14/11/2026 09:00:00; generated 14/11/2026 09:05:00.");
        layout.validated();
        // The charts of a layout are drawn from made-up groups (never business data), with the same renderer as a real report.
        var charts = layout.effectiveCharts().stream().map(c -> new ReportCharts.Result(c.title() + " (demonstration)", c.type(), c.metric(), 10,
                List.of(new ReportCharts.Point(ReportLayout.Chart.trend(c.type()) ? "Jan 2026" : "Category A", 5, "PERCENT".equals(c.metric()) ? 50 : 5),
                        new ReportCharts.Point(ReportLayout.Chart.trend(c.type()) ? "Feb 2026" : "Category B", 3, "PERCENT".equals(c.metric()) ? 30 : 3),
                        new ReportCharts.Point(ReportLayout.Chart.trend(c.type()) ? "Mar 2026" : "Category C", 2, "PERCENT".equals(c.metric()) ? 20 : 2)))).toList();
        // A table long enough to show whether anything lies over it: the rows are made up, no business data and no run.
        var rows = new ArrayList<List<String>>();
        rows.add(List.of("Preview", "Description", "Status", "Department"));
        for (int i = 1; i <= 12; i++) rows.add(List.of("Sample " + i, i == 1 ? "Layout preview only. No business data or report run is created." : "Sample row", "Active", "Quality Control"));
        return words == null ? ReportPresentationRenderer.render("PDF", rows, layout, context, charts) : words.render("PDF", rows, layout, context, charts);
    }
}
