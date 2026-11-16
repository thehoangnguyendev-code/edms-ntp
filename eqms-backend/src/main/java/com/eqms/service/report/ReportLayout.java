package com.eqms.service.report;

import java.util.*;
import java.util.regex.Pattern;

/** Bounded plain-text presentation; never interprets HTML, scripts or external resources. */
public record ReportLayout(boolean cover, String coverTitle, String subtitle, boolean showExecutor,
        boolean showGeneratedAt, String header, String footer, boolean pageNumbers,
        boolean watermarkEnabled, String watermark, boolean stampEnabled, String stamp,
        Mark watermarkStyle, Stamp stampStyle, Logo logo, List<Chart> charts, String orientation, Map<String,WordComponent> wordComponents, String fontFamily, Frame frame,
        ReportTextStyle coverTitleStyle, ReportTextStyle coverSubtitleStyle) {
    /** As the layout was before the text styles (font, size, colour, bold, italic, underline) of the cover title and subtitle. */
    public ReportLayout(boolean cover, String coverTitle, String subtitle, boolean showExecutor,
            boolean showGeneratedAt, String header, String footer, boolean pageNumbers,
            boolean watermarkEnabled, String watermark, boolean stampEnabled, String stamp,
            Mark watermarkStyle, Stamp stampStyle, Logo logo, List<Chart> charts, String orientation, Map<String,WordComponent> wordComponents, String fontFamily, Frame frame) {
        this(cover,coverTitle,subtitle,showExecutor,showGeneratedAt,header,footer,pageNumbers,watermarkEnabled,watermark,stampEnabled,stamp,watermarkStyle,stampStyle,logo,charts,orientation,wordComponents,fontFamily,frame,null,null);
    }
    /** As the layout was before the page frame (header and footer in three places, information, approval, notes). */
    public ReportLayout(boolean cover, String coverTitle, String subtitle, boolean showExecutor,
            boolean showGeneratedAt, String header, String footer, boolean pageNumbers,
            boolean watermarkEnabled, String watermark, boolean stampEnabled, String stamp,
            Mark watermarkStyle, Stamp stampStyle, Logo logo, List<Chart> charts, String orientation, Map<String,WordComponent> wordComponents, String fontFamily) {
        this(cover,coverTitle,subtitle,showExecutor,showGeneratedAt,header,footer,pageNumbers,watermarkEnabled,watermark,stampEnabled,stamp,watermarkStyle,stampStyle,logo,charts,orientation,wordComponents,fontFamily,null);
    }
    /** As the layout was before the font of the whole report could be chosen: Noto Sans. */
    public ReportLayout(boolean cover, String coverTitle, String subtitle, boolean showExecutor,
            boolean showGeneratedAt, String header, String footer, boolean pageNumbers,
            boolean watermarkEnabled, String watermark, boolean stampEnabled, String stamp,
            Mark watermarkStyle, Stamp stampStyle, Logo logo, List<Chart> charts, String orientation, Map<String,WordComponent> wordComponents) {
        this(cover,coverTitle,subtitle,showExecutor,showGeneratedAt,header,footer,pageNumbers,watermarkEnabled,watermark,stampEnabled,stamp,watermarkStyle,stampStyle,logo,charts,orientation,wordComponents,(String)null);
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
            watermarkStyle,stampStyle,logo,charts,orientation,wordComponents,fontFamily,frame,coverTitleStyle,coverSubtitleStyle);
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
            "report.executor","report.generatedAt","report.asOfAt","page.number","page.total",
            "report.filters","report.rowCount","template.approvedBy","template.approvedAt","report.executorDepartment","report.executorPosition",
            "company.name","report.gmpNotice","report.signedBy","report.signedAt","report.signatureId");
    public ReportLayout validated() {
        if(!Set.of("PORTRAIT","LANDSCAPE").contains(effectiveOrientation()))throw new IllegalArgumentException("REPORT_ORIENTATION_INVALID");
        if(!ReportFonts.KEYS.contains(effectiveFont()))throw new IllegalArgumentException("REPORT_FONT_INVALID");
        for(var component:effectiveWordComponents().entrySet()) {
            var ref=component.getValue();
            if(!Set.of("cover","header","footer").contains(component.getKey())||ref==null||ref.id()==null||ref.sha256()==null||!ref.sha256().matches("[a-f0-9]{64}"))throw new IllegalArgumentException("REPORT_WORD_COMPONENT_INVALID");
        }
        validate(coverTitle,255); validate(subtitle,500); validate(header,200); validate(footer,200);
        validate(watermark,80); validate(stamp,60);
        if(frame!=null) frame.validated();
        ReportTextStyle.validate(coverTitleStyle); ReportTextStyle.validate(coverSubtitleStyle);
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
    /**
     * The logo sits in the header band, in the left, the centre or the right place (slot); it never sits over the data, because the band takes its own room and the
     * table starts below it. width is its size as a percentage of the page. x and y are what the logo was before it had a place: a logo without a slot is put
     * in the place that its centre was nearest to.
     */
    @com.fasterxml.jackson.annotation.JsonIgnoreProperties(ignoreUnknown=true)
    public record Logo(boolean enabled,String data,double x,double y,double width,String pages,String slot) {
        public Logo(boolean enabled,String data,double x,double y,double width,String pages) { this(enabled,data,x,y,width,pages,null); }
        public String effectiveSlot() {
            if(slot!=null&&!slot.isBlank()) return slot;
            double centre=x+width/2;
            return centre<100.0/3?"LEFT":centre<200.0/3?"CENTER":"RIGHT";
        }
        public void validated() {
            if(!Double.isFinite(x)||!Double.isFinite(y)||!Double.isFinite(width)||x<0||y<0||x>100||y>100||width<5||width>100||!Set.of("ALL","FIRST").contains(pages==null?"":pages)
                ||!Set.of("LEFT","CENTER","RIGHT").contains(effectiveSlot())) throw new IllegalArgumentException("REPORT_LOGO_INVALID");
            if(data!=null&&!data.isBlank()) ReportImage.decode(data);
            if(enabled&&(data==null||data.isBlank())) throw new IllegalArgumentException("REPORT_LOGO_REQUIRED");
        }
    }
    /** Text of one place of the header or the footer: up to five lines, with placeholders; size in points (null: 9 in the header, 7 in the footer). */
    public record Slot(String text,Integer size,ReportTextStyle style,Boolean enabled) {
        public Slot(String text,Integer size) { this(text,size,null,null); }
        public Slot(String text,Integer size,ReportTextStyle style) { this(text,size,style,null); }
        public ReportTextStyle effectiveStyle() { return style==null?new ReportTextStyle(null,null,null,null,null,null,null):style; }
        /** The text that is printed: none when the place was switched off (its text is kept, so that switching it on brings it back). */
        public String effectiveText() { return Boolean.FALSE.equals(enabled)||text==null?"":text; }
        public boolean empty() { return effectiveText().isBlank(); }
        public int effectiveSize(boolean header) { return size==null?(header?9:7):size; }
        void validated() {
            validateMultiline(effectiveText(),300,5);
            if(size!=null&&(size<6||size>16)) throw new IllegalArgumentException("REPORT_LAYOUT_INVALID");
            ReportTextStyle.validate(style);
        }
    }
    /** A column of the approval table: its name, and whether it is printed. Not set: printed. */
    public record ApprovalColumn(String label,Boolean enabled,String align) {
        public static final List<ApprovalColumn> DEFAULTS=List.of(new ApprovalColumn("Name",null),new ApprovalColumn("Designation",null),new ApprovalColumn("Sign",null),new ApprovalColumn("Date",null));
        public ApprovalColumn(String label,Boolean enabled) { this(label,enabled,null); }
        /** Where the name of the column sits in its cell: left, centre or right (left when not set). */
        public String effectiveAlign() { return align==null?"LEFT":align; }
        public boolean shown() { return !Boolean.FALSE.equals(enabled); }
        public String effectiveLabel() { return label==null?"":label; }
        void validated() { validate(effectiveLabel(),30); if(!ReportTextStyle.ALIGNS.contains(effectiveAlign())) throw new IllegalArgumentException("REPORT_LAYOUT_INVALID"); }
    }
    public record InfoItem(String label,String value) {
        void validated() {
            if(label==null||label.isBlank()) throw new IllegalArgumentException("REPORT_LAYOUT_INVALID");
            validate(label,60); validate(value==null?"":value,200);
        }
    }
    /**
     * The frame of a page (REPORT-APPEARANCE-2026-11-14): header and footer in three places, the block of information above the table, the approval block and the box of
     * notes after it. The approval block and the notes are off unless they are switched on. A null frame is the layout as it was: the header text, the footer text and the page number.
     */
    @com.fasterxml.jackson.annotation.JsonIgnoreProperties(ignoreUnknown=true)
    public record Frame(String companyName,Slot headerLeft,Slot headerCenter,Slot headerRight,Slot footerLeft,Slot footerCenter,Slot footerRight,
            List<InfoItem> info,Integer infoColumns,boolean approval,List<String> approvalRoles,boolean notes,Integer notesHeight,
            ReportTextStyle infoLabelStyle,ReportTextStyle infoValueStyle,ReportTextStyle approvalStyle,ReportTextStyle notesStyle,List<ApprovalColumn> approvalColumns) {
        /** As the frame was before the columns of the approval table could be named and hidden. */
        public Frame(String companyName,Slot headerLeft,Slot headerCenter,Slot headerRight,Slot footerLeft,Slot footerCenter,Slot footerRight,
                List<InfoItem> info,Integer infoColumns,boolean approval,List<String> approvalRoles,boolean notes,Integer notesHeight,
                ReportTextStyle infoLabelStyle,ReportTextStyle infoValueStyle,ReportTextStyle approvalStyle,ReportTextStyle notesStyle) {
            this(companyName,headerLeft,headerCenter,headerRight,footerLeft,footerCenter,footerRight,info,infoColumns,approval,approvalRoles,notes,notesHeight,infoLabelStyle,infoValueStyle,approvalStyle,notesStyle,null);
        }
        /** As the frame was before the text styles of the information, the approval block and the notes. */
        public Frame(String companyName,Slot headerLeft,Slot headerCenter,Slot headerRight,Slot footerLeft,Slot footerCenter,Slot footerRight,
                List<InfoItem> info,Integer infoColumns,boolean approval,List<String> approvalRoles,boolean notes,Integer notesHeight) {
            this(companyName,headerLeft,headerCenter,headerRight,footerLeft,footerCenter,footerRight,info,infoColumns,approval,approvalRoles,notes,notesHeight,null,null,null,null,null);
        }
        private static final Slot NONE=new Slot("",null);
        public Slot header(String place) { return pick(place,headerLeft,headerCenter,headerRight); }
        public Slot footer(String place) { return pick(place,footerLeft,footerCenter,footerRight); }
        private static Slot pick(String place,Slot left,Slot centre,Slot right) {
            Slot slot="LEFT".equals(place)?left:"CENTER".equals(place)?centre:right; return slot==null?NONE:slot;
        }
        public List<InfoItem> effectiveInfo() { return info==null?List.of():info; }
        public int effectiveInfoColumns() { return infoColumns==null?2:infoColumns; }
        /** The columns of the approval table after the column of the roles: the named ones, or Name, Designation, Sign and Date. */
        public List<ApprovalColumn> effectiveApprovalColumns() { return approvalColumns==null||approvalColumns.isEmpty()?ApprovalColumn.DEFAULTS:approvalColumns; }
        /** The columns that are printed: those that were not switched off. */
        public List<ApprovalColumn> shownApprovalColumns() { return effectiveApprovalColumns().stream().filter(ApprovalColumn::shown).toList(); }
        public List<String> effectiveApprovalRoles() { return approvalRoles==null||approvalRoles.isEmpty()?List.of("Prepared by","Reviewed by","Approved by"):approvalRoles; }
        public int effectiveNotesHeight() { return notesHeight==null?120:notesHeight; }
        public String effectiveCompanyName() { return companyName==null?"":companyName; }
        void validated() {
            validate(effectiveCompanyName(),120);
            for(String place:List.of("LEFT","CENTER","RIGHT")) { header(place).validated(); footer(place).validated(); }
            if(effectiveInfo().size()>16) throw new IllegalArgumentException("REPORT_LAYOUT_INVALID");
            effectiveInfo().forEach(InfoItem::validated);
            if(!Set.of(1,2).contains(effectiveInfoColumns())) throw new IllegalArgumentException("REPORT_LAYOUT_INVALID");
            if(effectiveApprovalRoles().size()>4) throw new IllegalArgumentException("REPORT_LAYOUT_INVALID");
            effectiveApprovalRoles().forEach(role->validate(role==null?"":role,40));
            if(effectiveNotesHeight()<40||effectiveNotesHeight()>400) throw new IllegalArgumentException("REPORT_LAYOUT_INVALID");
            if(effectiveApprovalColumns().size()>6) throw new IllegalArgumentException("REPORT_LAYOUT_INVALID");
            effectiveApprovalColumns().forEach(ApprovalColumn::validated);
            ReportTextStyle.validate(infoLabelStyle); ReportTextStyle.validate(infoValueStyle); ReportTextStyle.validate(approvalStyle); ReportTextStyle.validate(notesStyle);
        }
    }
    /** The frame the report is drawn with: the one that was set, or the one that the older header text, footer text and page number make. */
    public Frame effectiveFrame() {
        if(frame!=null) return frame;
        String logoSlot=logo!=null&&logo.enabled()?logo.effectiveSlot():"";
        // The older header text sat on the left, unless the logo was there; then it goes to the right, so that the two are not one over the other.
        boolean right="LEFT".equals(logoSlot);
        var headerText=new Slot(header==null?"":header,null);var footerText=new Slot(footer==null?"":footer,null);var none=new Slot("",null);
        return new Frame("",right?none:headerText,none,right?headerText:none,footerText,none,none,List.of(),2,false,null,false,null);
    }
    /** maxGroups: the most groups a bar or pie chart shows; the groups after them are added together as one "Other" bar (5 to 20, 20 when not set). */
    public record Chart(String title,String type,String field,String metric,Integer maxGroups) {
        /**
         * The kinds of chart a template can have, all drawn on the server with Chart.js (REPORT-CHARTJS-2026-11-15): a column chart (BAR), a horizontal bar chart, a pie, a doughnut,
         * a polar area, a radar, and two charts of the trend by month (LINE, AREA), which need a date field.
         */
        public static final Set<String> TYPES=Set.of("BAR","HORIZONTAL_BAR","PIE","DOUGHNUT","POLAR_AREA","RADAR","LINE","AREA");
        /** A chart of the trend by month: its groups are months of a date field, in order, not the largest groups. */
        public static boolean trend(String type) { return "LINE".equals(type)||"AREA".equals(type); }
        public Chart(String title,String type,String field,String metric) { this(title,type,field,metric,null); }
        public int effectiveMaxGroups() { return maxGroups==null?20:maxGroups; }
        public void validated() {
            if(maxGroups!=null&&(maxGroups<5||maxGroups>20))throw new IllegalArgumentException("REPORT_CHART_INVALID");
            validate(title,100);
            if(title.isBlank()||!TYPES.contains(type==null?"":type)||field==null||!field.matches("[a-zA-Z][a-zA-Z0-9]{0,59}")
                ||!Set.of("COUNT","PERCENT").contains(metric==null?"":metric)) throw new IllegalArgumentException("REPORT_CHART_INVALID");
        }
    }
    private static void validateMultiline(String text,int max,int lines) {
        if(text==null||text.length()>max||text.split("\\R",-1).length>lines||text.codePoints().anyMatch(c->Character.isISOControl(c)&&c!='\n'&&c!='\r')) throw new IllegalArgumentException("REPORT_LAYOUT_INVALID");
        validate(text.replaceAll("\\R"," "),max);
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
