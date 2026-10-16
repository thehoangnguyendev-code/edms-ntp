package com.eqms.service.report;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** A chart that has more groups than it shows adds the rest together, in the open; it never drops a record or fails the whole report. */
class ReportChartGroupsTest {
    private static List<List<String>> rows(int groups) {
        List<List<String>> rows = new ArrayList<>();
        rows.add(List.of("status"));
        for (int g = 0; g < groups; g++) for (int i = 0; i <= g; i++) rows.add(List.of("Group " + String.format("%02d", g)));
        return rows;
    }

    @Test
    void groupsBeyondTheNumberShownAreAddedTogetherAsOther() {
        var chart = new ReportLayout.Chart("By status", "BAR", "status", "COUNT", 5);
        var result = ReportCharts.calculate(List.of(chart), List.of("status"), rows(12)).getFirst();
        assertThat(result.points()).hasSize(5);
        var other = result.points().getLast();
        assertThat(other.label()).isEqualTo("Other (8 groups)");
        long shown = result.points().stream().mapToLong(ReportCharts.Point::count).sum();
        assertThat(shown).isEqualTo(result.total());
        // The biggest groups stay as they are.
        assertThat(result.points().stream().map(ReportCharts.Point::label)).contains("Group 11", "Group 10", "Group 09", "Group 08");
    }

    @Test
    void aChartWithFewGroupsIsUnchangedAndTheLimitIsChecked() {
        var chart = new ReportLayout.Chart("By status", "PIE", "status", "PERCENT");
        var result = ReportCharts.calculate(List.of(chart), List.of("status"), rows(3)).getFirst();
        assertThat(result.points()).hasSize(3);
        assertThatThrownBy(() -> new ReportLayout.Chart("x", "BAR", "status", "COUNT", 4).validated()).hasMessage("REPORT_CHART_INVALID");
        assertThatThrownBy(() -> new ReportLayout.Chart("x", "BAR", "status", "COUNT", 21).validated()).hasMessage("REPORT_CHART_INVALID");
        new ReportLayout.Chart("x", "BAR", "status", "COUNT", 5).validated();
    }
}
