package com.eqms.service.report;

import java.util.ArrayList;
import java.util.List;

/**
 * Made-up groups for a chart, for the preview in the editor of a template and for the demonstration pages of a layout: the shape of the chart, never the records of a report.
 * It has the shape the server gives a chart: the largest groups, then the rest added together as one "Other" group (REPORT_CHART_GROUP_LIMIT).
 */
public final class ReportChartSamples {
    private ReportChartSamples() {}

    private static final long[] COUNTS = {48, 31, 22, 15, 9, 6, 4, 3};
    private static final String[] MONTHS = {"Jun", "Jul", "Aug", "Sep", "Oct", "Nov"};
    private static final long[] TREND = {12, 18, 15, 24, 21, 30};

    public static ReportCharts.Result of(ReportLayout.Chart chart, String fieldName) {
        chart.validated();
        List<ReportCharts.Point> points = new ArrayList<>();
        long total;
        if (ReportLayout.Chart.trend(chart.type())) {
            total = 0;
            for (long v : TREND) total += v;
            for (int i = 0; i < MONTHS.length; i++) points.add(new ReportCharts.Point(MONTHS[i], TREND[i], value(chart, TREND[i], total)));
        } else {
            int cap = Math.min(chart.effectiveMaxGroups(), 20);
            String name = fieldName == null || fieldName.isBlank() ? "Group" : fieldName;
            List<long[]> groups = new ArrayList<>();
            for (long v : COUNTS) groups.add(new long[] {v});
            long shownTotal = 0;
            List<ReportCharts.Point> raw = new ArrayList<>();
            if (groups.size() > cap) {
                // As the server does it (ReportCharts.calculate): the largest cap-1 groups, then one group that holds the rest, so a chart never has more than cap bars.
                for (int i = 0; i < cap - 1; i++) raw.add(new ReportCharts.Point(name + " " + (char) ('A' + i), COUNTS[i], COUNTS[i]));
                long rest = 0;
                for (int i = cap - 1; i < COUNTS.length; i++) rest += COUNTS[i];
                raw.add(new ReportCharts.Point("Other (" + (COUNTS.length - cap + 1) + " groups)", rest, rest));
            } else {
                for (int i = 0; i < COUNTS.length; i++) raw.add(new ReportCharts.Point(name + " " + (char) ('A' + i), COUNTS[i], COUNTS[i]));
            }
            for (var p : raw) shownTotal += p.count();
            total = shownTotal;
            for (var p : raw) points.add(new ReportCharts.Point(p.label(), p.count(), value(chart, p.count(), shownTotal)));
        }
        String title = chart.title() == null || chart.title().isBlank() ? "Untitled chart" : chart.title();
        return new ReportCharts.Result(title + " (sample data)", chart.type(), chart.metric(), total, points);
    }

    private static double value(ReportLayout.Chart chart, long count, long total) {
        return "PERCENT".equals(chart.metric()) ? (total == 0 ? 0 : Math.round(count * 10000.0 / total) / 100.0) : count;
    }
}
