package com.eqms.service.report;

import java.util.*;
import java.awt.*;
import java.awt.image.BufferedImage;
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
                if("LINE".equals(chart.type())&&!key.equals("Unspecified")) {
                    try {key=YearMonth.from(LocalDate.parse(key.substring(0,10))).toString();}
                    catch(Exception invalid){throw new IllegalArgumentException("REPORT_CHART_DATE_REQUIRED");}
                }
                counts.merge(key,1L,Long::sum);
            }
            // Never silently omit categories or trend months. A trend with more than 20 months is refused; the groups of a bar or pie chart beyond the chosen number
            // are added together as one bar that says how many groups it holds.
            int cap=chart.effectiveMaxGroups();
            if("LINE".equals(chart.type())&&counts.size()>20)throw new IllegalArgumentException("REPORT_CHART_GROUP_LIMIT");
            if(!"LINE".equals(chart.type())&&counts.size()>cap) {
                var keep=new TreeSet<String>();
                counts.entrySet().stream().sorted(Map.Entry.<String,Long>comparingByValue().reversed().thenComparing(Map.Entry.comparingByKey())).limit(cap-1).forEach(e->keep.add(e.getKey()));
                long rest=0;int restGroups=0;Map<String,Long> grouped=new LinkedHashMap<>();
                for(var e:counts.entrySet()) { if(keep.contains(e.getKey()))grouped.put(e.getKey(),e.getValue()); else {rest+=e.getValue();restGroups++;} }
                grouped.put("Other ("+restGroups+" groups)",rest);
                counts=grouped;
            }
            long total=rows.size()-1;
            var points=counts.entrySet().stream().map(e->new Point(e.getKey(),e.getValue(),"PERCENT".equals(chart.metric())?(total==0?0:Math.round(e.getValue()*10000.0/total)/100.0):e.getValue())).toList();
            results.add(new Result(chart.title(),chart.type(),chart.metric(),total,points));
        }
        return results;
    }
    public static BufferedImage image(Result chart) throws Exception {
        return image(chart,null);
    }
    /** The chart as a picture, with the text in the font of the report (see ReportFonts). */
    public static BufferedImage image(Result chart,String fontKey) throws Exception {
        var image=new BufferedImage(1400,850,BufferedImage.TYPE_INT_RGB);var g=image.createGraphics();
        try(var stream=ReportCharts.class.getResourceAsStream(ReportFonts.bodyResource(fontKey))) {
            Font font=Font.createFont(Font.TRUETYPE_FONT,stream);g.setRenderingHint(RenderingHints.KEY_ANTIALIASING,RenderingHints.VALUE_ANTIALIAS_ON);
            g.setColor(Color.WHITE);g.fillRect(0,0,1400,850);g.setFont(font.deriveFont(Font.BOLD,26));g.setColor(new Color(15,23,42));g.drawString(chart.title(),40,45);
            g.setFont(font.deriveFont(18f));g.drawString("Records: "+chart.total()+" · "+chart.metric(),40,78);
            if(chart.points().isEmpty()){g.drawString("No matching data",40,130);return image;}
            Color[] colors={new Color(5,150,105),new Color(14,116,144),new Color(67,56,202),new Color(180,83,9),new Color(190,24,93),new Color(71,85,105)};
            double max=chart.points().stream().mapToDouble(Point::value).max().orElse(1);max=Math.max(max,1);
            if("PIE".equals(chart.type())) {
                double start=0;for(int i=0;i<chart.points().size();i++){var p=chart.points().get(i);double angle=p.count()*360.0/chart.total();g.setColor(colors[i%colors.length]);g.fill(new java.awt.geom.Arc2D.Double(50,140,550,550,start,angle,java.awt.geom.Arc2D.PIE));start+=angle;}
            } else {
                int count=chart.points().size();double step=1200.0/count;g.setColor(new Color(226,232,240));g.drawLine(80,650,1320,650);
                for(int i=0;i<count;i++){var p=chart.points().get(i);int x=(int)(90+i*step),h=(int)(p.value()/max*440);g.setColor(colors[i%colors.length]);
                    if("BAR".equals(chart.type()))g.fillRect(x,650-h,(int)Math.max(8,step-12),h);
                    else {g.fillOval(x-4,646-h,8,8);if(i>0){var prior=chart.points().get(i-1);g.setStroke(new BasicStroke(3));g.drawLine((int)(90+(i-1)*step),650-(int)(prior.value()/max*440),x,650-h);}}
                    if(count<=12){g.setFont(font.deriveFont(14f));g.drawString(p.label(),x,685);g.drawString(String.valueOf(p.value()),x,640-h);}
                }
            }
            // Legend is a compact complete table; numeric values remain in the report snapshot/XLSX.
            g.setFont(font.deriveFont(15f));int startX="PIE".equals(chart.type())?660:40,startY="PIE".equals(chart.type())?125:720;
            for(int i=0;i<chart.points().size();i++){var p=chart.points().get(i);int x=startX+(i/("PIE".equals(chart.type())?25:5))*240,y=startY+(i%("PIE".equals(chart.type())?25:5))*24;
                g.setColor(colors[i%colors.length]);g.fillRect(x,y-12,10,10);g.setColor(new Color(51,65,85));String label=p.label();if(label.length()>22)label=label.substring(0,20)+"…";g.drawString(label+": "+p.value(),x+16,y);}
        } finally {g.dispose();}return image;
    }
}
