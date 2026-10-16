package com.eqms.service.report;

import java.util.*;
import java.util.regex.Pattern;

/** Bounded plain-text presentation; never interprets HTML, scripts or external resources. */
public record ReportLayout(boolean cover, String coverTitle, String subtitle, boolean showExecutor,
        boolean showGeneratedAt, String header, String footer, boolean pageNumbers,
        boolean watermarkEnabled, String watermark, boolean stampEnabled, String stamp,
        Mark watermarkStyle, Stamp stampStyle, Logo logo, List<Chart> charts, String orientation, Map<String,WordComponent> wordComponents, String fontFamily) {
    /** As the layout was before the font of the whole report could be chosen: Noto Sans. */
    public ReportLayout(boolean cover, String coverTitle, String subtitle, boolean showExecutor,
            boolean showGeneratedAt, String header, String footer, boolean pageNumbers,
            boolean watermarkEnabled, String watermark, boolean stampEnabled, String stamp,
            Mark watermarkStyle, Stamp stampStyle, Logo logo, List<Chart> charts, String orientation, Map<String,WordComponent> wordComponents) {
        this(cover,coverTitle,subtitle,showExecutor,showGeneratedAt,header,footer,pageNumbers,watermarkEnabled,watermark,stampEnabled,stamp,watermarkStyle,stampStyle,logo,charts,orientation,wordComponents,null);
    }
    /** The font of the running text of the report; Noto Sans when none was chosen. */
    public String effectiveFont() { return fontFamily==null||fontFamily.isBlank()?"NOTO_SANS":fontFamily; }
    public ReportLayout(boolean cover,String coverTitle,String subtitle,boolean showExecutor,boolean showGeneratedAt,
            String header,String footer,boolean pageNumbers,boolean watermarkEnabled,String watermark,boolean stampEnabled,String stamp,
            Mark watermarkStyle,Stamp stampStyle,Logo logo,List<Chart> charts,String orientation) {
        this(cover,coverTitle,subtitle,showExecutor,showGeneratedAt,header,footer,pageNumbers,watermarkEnabled,watermark,stampEnabled,stamp,watermarkStyle,stampStyle,logo,charts,orientation,null);
    }
    public Map<String,WordComponent> effectiveWordComponents() { return wordComponents==null?Map.of():wordComponents; }
    public record WordComponent(UUID id,String sha256,String fileName,List<String> placeholders) {}
    public ReportLayout(boolean cover,String coverTitle,String subtitle,boolean showExecutor,boolean showGeneratedAt,
            String header,String footer,boolean pageNumbers,boolean watermarkEnabled,String watermark,boolean stampEnabled,String stamp,
            Mark watermarkStyle,Stamp stampStyle,Logo logo,List<Chart> charts) {
        this(cover,coverTitle,subtitle,showExecutor,showGeneratedAt,header,footer,pageNumbers,watermarkEnabled,watermark,stampEnabled,stamp,watermarkStyle,stampStyle,logo,charts,null);
    }
    public String effectiveOrientation() { return orientation==null?"LANDSCAPE":orientation; }
    public float pageWidth() { return "PORTRAIT".equals(effectiveOrientation())?595:842; }
    public float pageHeight() { return "PORTRAIT".equals(effectiveOrientation())?842:595; }
    public ReportLayout(boolean cover,String coverTitle,String subtitle,boolean showExecutor,boolean showGeneratedAt,
            String header,String footer,boolean pageNumbers,boolean watermarkEnabled,String watermark,boolean stampEnabled,String stamp) {
        this(cover,coverTitle,subtitle,showExecutor,showGeneratedAt,header,footer,pageNumbers,watermarkEnabled,watermark,stampEnabled,stamp,null,null,null,null);
    }
    public Mark effectiveWatermark() { return watermarkStyle==null?new Mark("#64748b",12,36,25,20,55,70,"ALL","NOTO_SANS","ABOVE"):watermarkStyle; }
    /** The company appearance with the charts of one template: what a report is rendered from. */
    public ReportLayout withCharts(List<Chart> charts) {
        return new ReportLayout(cover,coverTitle,subtitle,showExecutor,showGeneratedAt,header,footer,pageNumbers,watermarkEnabled,watermark,stampEnabled,stamp,
            watermarkStyle,stampStyle,logo,charts,orientation,wordComponents,fontFamily);
    }
    /** What a template keeps of a layout: its charts. Everything else is the company appearance of Report Properties. */
    public ReportLayout chartsOnly() { return defaults().withCharts(effectiveCharts()); }
    public Stamp effectiveStamp() { return stampStyle==null?new Stamp("#059669",90,null,null,null,"ALL","NOTO_SANS"):stampStyle; }
    public List<Chart> effectiveCharts() { return charts==null?List.of():charts; }
    public static ReportLayout defaults() {
        return new ReportLayout(false,"{{report.title}}","",true,true,"{{report.title}}",
                "{{report.code}} · Rev {{template.version}}",true,false,"FOR PREVIEW ONLY",false,"TEST");
    }
    public static final Set<String> TOKENS=Set.of("report.title","report.code","template.version","template.name","report.runId",
            "report.executor","report.generatedAt","report.asOfAt","page.number","page.total");
    public ReportLayout validated() {
        if(!Set.of("PORTRAIT","LANDSCAPE").contains(effectiveOrientation()))throw new IllegalArgumentException("REPORT_ORIENTATION_INVALID");
        if(!ReportFonts.KEYS.contains(effectiveFont()))throw new IllegalArgumentException("REPORT_FONT_INVALID");
        for(var component:effectiveWordComponents().entrySet()) {
            var ref=component.getValue();
            if(!Set.of("cover","header","footer").contains(component.getKey())||ref==null||ref.id()==null||ref.sha256()==null||!ref.sha256().matches("[a-f0-9]{64}"))throw new IllegalArgumentException("REPORT_WORD_COMPONENT_INVALID");
        }
        validate(coverTitle,255); validate(subtitle,500); validate(header,200); validate(footer,200);
        validate(watermark,80); validate(stamp,60);
        if ((watermarkEnabled&&watermark.isBlank())||(stampEnabled&&stamp.isBlank())) throw new IllegalArgumentException("REPORT_LAYOUT_TEXT_REQUIRED");
        effectiveWatermark().validated(); effectiveStamp().validated();
        if(logo!=null) logo.validated();
        if(effectiveCharts().size()>6) throw new IllegalArgumentException("REPORT_CHART_LIMIT");
        effectiveCharts().forEach(Chart::validated);
        return this;
    }
    public record Mark(String color,int opacity,int fontSize,int rotation,double x,double y,double width,String pages,String font,String layer) {
        public void validated() {
            if(color==null||!color.matches("#[0-9a-fA-F]{6}")||opacity<1||opacity>100||fontSize<6||fontSize>96||rotation< -180||rotation>180
                ||!Double.isFinite(x)||!Double.isFinite(y)||!Double.isFinite(width)||x<0||x>95||y<0||y>98||width<5||width>100-x
                ||!Set.of("ALL","FIRST").contains(pages==null?"":pages)||!ReportFonts.KEYS.contains(font==null?"":font)
                ||!Set.of("ABOVE","BEHIND").contains(layer==null?"":layer)) throw new IllegalArgumentException("REPORT_MARK_INVALID");
        }
    }
    /**
     * The stamp: a framed box with the text in it, as the stamp of a Controlled Copy. x and y are the left and top edge of the box, as a percentage of the page,
     * and width is its width as a percentage of the page; x and y not set means the box has not been placed by hand and sits in the top right corner.
     */
    @com.fasterxml.jackson.annotation.JsonIgnoreProperties(ignoreUnknown=true)
    public record Stamp(String color,int opacity,Double x,Double y,Double width,String pages,String font) {
        public boolean placed() { return x!=null&&y!=null; }
        public void validated() {
            if(color==null||!color.matches("#[0-9a-fA-F]{6}")||opacity<30||opacity>100
                ||(x==null)!=(y==null)||(x!=null&&(!Double.isFinite(x)||!Double.isFinite(y)||x<0||x>100||y<0||y>100))
                ||(width!=null&&(!Double.isFinite(width)||width<5||width>60))
                ||!Set.of("ALL","FIRST").contains(pages==null?"":pages)||!ReportFonts.KEYS.contains(font==null?"":font)) throw new IllegalArgumentException("REPORT_MARK_INVALID");
        }
    }
    public record Logo(boolean enabled,String data,double x,double y,double width,String pages) {
        public void validated() {
            if(!Double.isFinite(x)||!Double.isFinite(y)||!Double.isFinite(width)||x<0||y<0||x>90||y>90||width<5||width>100-x||!Set.of("ALL","FIRST").contains(pages==null?"":pages)) throw new IllegalArgumentException("REPORT_LOGO_INVALID");
            if(data!=null&&!data.isBlank()) ReportImage.decode(data);
            if(enabled&&(data==null||data.isBlank())) throw new IllegalArgumentException("REPORT_LOGO_REQUIRED");
        }
    }
    /** maxGroups: the most groups a bar or pie chart shows; the groups after them are added together as one "Other" bar (5 to 20, 20 when not set). */
    public record Chart(String title,String type,String field,String metric,Integer maxGroups) {
        public Chart(String title,String type,String field,String metric) { this(title,type,field,metric,null); }
        public int effectiveMaxGroups() { return maxGroups==null?20:maxGroups; }
        public void validated() {
            if(maxGroups!=null&&(maxGroups<5||maxGroups>20))throw new IllegalArgumentException("REPORT_CHART_INVALID");
            validate(title,100);
            if(title.isBlank()||!Set.of("BAR","PIE","LINE").contains(type==null?"":type)||field==null||!field.matches("[a-zA-Z][a-zA-Z0-9]{0,59}")
                ||!Set.of("COUNT","PERCENT").contains(metric==null?"":metric)) throw new IllegalArgumentException("REPORT_CHART_INVALID");
        }
    }
    private static void validate(String text,int max) {
        if(text==null||text.length()>max||text.codePoints().anyMatch(Character::isISOControl)) throw new IllegalArgumentException("REPORT_LAYOUT_INVALID");
        var matches=Pattern.compile("\\{\\{([^{}]+)}}").matcher(text);
        while(matches.find()) if(!TOKENS.contains(matches.group(1))) throw new IllegalArgumentException("REPORT_LAYOUT_TOKEN_INVALID");
        if(matches.replaceAll("").contains("{{")||matches.replaceAll("").contains("}}")) throw new IllegalArgumentException("REPORT_LAYOUT_TOKEN_INVALID");
    }
    public String resolve(String text,Map<String,String> context) {
        for(String token:TOKENS) text=text.replace("{{"+token+"}}",context.getOrDefault(token,""));
        return text;
    }
}
