package com.eqms.service.report;

import java.util.*;
import java.util.regex.Pattern;

/** Bounded plain-text presentation; never interprets HTML, scripts or external resources. */
public record ReportLayout(boolean cover, String coverTitle, String subtitle, boolean showExecutor,
        boolean showGeneratedAt, String header, String footer, boolean pageNumbers,
        boolean watermarkEnabled, String watermark, boolean stampEnabled, String stamp,
        Mark watermarkStyle, Mark stampStyle, Logo logo, List<Chart> charts, String orientation, Map<String,WordComponent> wordComponents) {
    public ReportLayout(boolean cover,String coverTitle,String subtitle,boolean showExecutor,boolean showGeneratedAt,
            String header,String footer,boolean pageNumbers,boolean watermarkEnabled,String watermark,boolean stampEnabled,String stamp,
            Mark watermarkStyle,Mark stampStyle,Logo logo,List<Chart> charts,String orientation) {
        this(cover,coverTitle,subtitle,showExecutor,showGeneratedAt,header,footer,pageNumbers,watermarkEnabled,watermark,stampEnabled,stamp,watermarkStyle,stampStyle,logo,charts,orientation,null);
    }
    public Map<String,WordComponent> effectiveWordComponents() { return wordComponents==null?Map.of():wordComponents; }
    public record WordComponent(UUID id,String sha256,String fileName,List<String> placeholders) {}
    public ReportLayout(boolean cover,String coverTitle,String subtitle,boolean showExecutor,boolean showGeneratedAt,
            String header,String footer,boolean pageNumbers,boolean watermarkEnabled,String watermark,boolean stampEnabled,String stamp,
            Mark watermarkStyle,Mark stampStyle,Logo logo,List<Chart> charts) {
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
    public Mark effectiveStamp() { return stampStyle==null?new Mark("#059669",90,10,0,70,94,26,"ALL","NOTO_SANS","ABOVE"):stampStyle; }
    public List<Chart> effectiveCharts() { return charts==null?List.of():charts; }
    public static ReportLayout defaults() {
        return new ReportLayout(false,"{{report.title}}","",true,true,"{{report.title}}",
                "{{report.code}} · v{{template.version}}",true,false,"FOR PREVIEW ONLY",false,"TEST");
    }
    public static final Set<String> TOKENS=Set.of("report.title","report.code","template.version",
            "report.executor","report.generatedAt","report.asOfAt","page.number","page.total");
    public ReportLayout validated() {
        if(!Set.of("PORTRAIT","LANDSCAPE").contains(effectiveOrientation()))throw new IllegalArgumentException("REPORT_ORIENTATION_INVALID");
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
                ||!Set.of("ALL","FIRST").contains(pages==null?"":pages)||!Set.of("NOTO_SANS","NOTO_SERIF","ROBOTO_MONO","OSWALD").contains(font==null?"":font)
                ||!Set.of("ABOVE","BEHIND").contains(layer==null?"":layer)) throw new IllegalArgumentException("REPORT_MARK_INVALID");
        }
    }
    public record Logo(boolean enabled,String data,double x,double y,double width,String pages) {
        public void validated() {
            if(!Double.isFinite(x)||!Double.isFinite(y)||!Double.isFinite(width)||x<0||y<0||x>90||y>90||width<5||width>100-x||!Set.of("ALL","FIRST").contains(pages==null?"":pages)) throw new IllegalArgumentException("REPORT_LOGO_INVALID");
            if(data!=null&&!data.isBlank()) ReportImage.decode(data);
            if(enabled&&(data==null||data.isBlank())) throw new IllegalArgumentException("REPORT_LOGO_REQUIRED");
        }
    }
    public record Chart(String title,String type,String field,String metric) {
        public void validated() {
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
