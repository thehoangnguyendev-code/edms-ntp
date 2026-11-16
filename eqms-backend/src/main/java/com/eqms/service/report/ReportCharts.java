package com.eqms.service.report;

import java.util.*;
import java.time.*;

/** Runs only on the server's full scoped report rows (never paginated FE rows). */
public final class ReportCharts {
    private ReportCharts() {}
    public record Point(String label,long count,double value) {}
    public record Result(String title,String type,String metric,long total,java.util.List<Point> points) {}
    public static java.util.List<Result> calculate(java.util.List<ReportLayout.Chart> charts,java.util.List<String> fields,java.util.List<java.util.List<String>> rows) {
        var results=new ArrayList<Result>();
        for(var chart:charts) {
            chart.validated();int column=fields.indexOf(chart.field());
            if(column<0)throw new IllegalArgumentException("REPORT_CHART_FIELD_NOT_SELECTED");
            Map<String,Long> counts=new TreeMap<>();
            for(var row:rows.subList(1,rows.size())) {
                String key=row.get(column);if(key==null||key.isBlank())key="Unspecified";
                if(ReportLayout.Chart.trend(chart.type())&&!key.equals("Unspecified")) {
                    try {key=YearMonth.from(chartDate(key)).toString();}
                    catch(Exception invalid){throw new IllegalArgumentException("REPORT_CHART_DATE_REQUIRED");}
                }
                counts.merge(key,1L,Long::sum);
            }
            // Never silently omit categories or trend months. A trend with more than 20 months is refused; the groups of a bar or pie chart beyond the chosen number
            // are added together as one bar that says how many groups it holds.
            int cap=chart.effectiveMaxGroups();
            if(ReportLayout.Chart.trend(chart.type())&&counts.size()>20)throw new IllegalArgumentException("REPORT_CHART_GROUP_LIMIT");
            if(!ReportLayout.Chart.trend(chart.type())&&counts.size()>cap) {
                var keep=new TreeSet<String>();
                counts.entrySet().stream().sorted(Map.Entry.<String,Long>comparingByValue().reversed().thenComparing(Map.Entry.comparingByKey())).limit(cap-1).forEach(e->keep.add(e.getKey()));
                long rest=0;int restGroups=0;Map<String,Long> grouped=new LinkedHashMap<>();
                for(var e:counts.entrySet()) { if(keep.contains(e.getKey()))grouped.put(e.getKey(),e.getValue()); else {rest+=e.getValue();restGroups++;} }
                grouped.put("Other ("+restGroups+" groups)",rest);
                counts=grouped;
            }
            long total=rows.size()-1;
            var points=counts.entrySet().stream().map(e->new Point(ReportLayout.Chart.trend(chart.type())&&!e.getKey().equals("Unspecified")?com.eqms.util.DateTimeFormatUtils.displayMonth(e.getKey()):e.getKey(),e.getValue(),"PERCENT".equals(chart.metric())?(total==0?0:Math.round(e.getValue()*10000.0/total)/100.0):e.getValue())).toList();
            results.add(new Result(chart.title(),chart.type(),chart.metric(),total,points));
        }
        return results;
    }
    /** The date a cell holds: the display format dd/MM/yyyy (with or without a time) or, for a value that was never formatted, ISO. */
    private static LocalDate chartDate(String text) {
        var shown=java.util.regex.Pattern.compile("^(\\d{2})/(\\d{2})/(\\d{4})").matcher(text.trim());
        if(shown.find())return LocalDate.of(Integer.parseInt(shown.group(3)),Integer.parseInt(shown.group(2)),Integer.parseInt(shown.group(1)));
        return LocalDate.parse(text.trim().substring(0,10));
    }
    private static volatile ChartImageRenderer renderer;
    /** Sets the renderer that draws every chart (the Chart.js chart renderer in the application; a stand-in in tests). */
    public static void use(ChartImageRenderer chosen) { renderer=chosen; }
    /** The chart as a PNG picture, with the text in the font of the report (see ReportFonts). */
    public static byte[] png(Result chart,String fontKey) throws Exception {
        var drawing=renderer;
        if(drawing==null)throw new IllegalStateException("REPORT_CHART_RENDERER_UNAVAILABLE");
        return drawing.png(chart,fontKey);
    }
}
