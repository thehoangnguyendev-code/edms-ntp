package com.eqms.service.report;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.*;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType0Font;
import org.apache.pdfbox.pdmodel.graphics.state.PDExtendedGraphicsState;
import org.apache.pdfbox.util.Matrix;
import org.apache.poi.xssf.streaming.SXSSFWorkbook;
import java.io.ByteArrayOutputStream;
import java.util.*;

/** Presentation applies to pinned layout only; CSV remains a data-only exchange. */
public final class ReportPresentationRenderer {
    private ReportPresentationRenderer() {}
    /** What a CSV or XLSX report file is (the same words are shown beside the files of a run). */
    public static final String DATA_COPY_NOTICE="Data copy for analysis, not the controlled report. The controlled report is the file EQMS stored for this run. A copy that has been edited cannot be shown to be what EQMS produced: check it with Verify File on the run in EQMS.";
    /** The CSV text of the rows (UTF-8): every value in quotes, and a value that a spreadsheet could read as a formula starts with an apostrophe. The one place that writes a report CSV. */
    public static String csvText(List<List<String>> rows) {
        // The file starts with the byte order mark so a spreadsheet opens it as UTF-8 (both callers write this text to a CSV file).
        StringBuilder out=new StringBuilder(com.eqms.util.CsvSafety.BOM);
        rows.forEach(row->out.append(row.stream().map(ReportPresentationRenderer::csvValue).collect(java.util.stream.Collectors.joining(","))).append('\n'));
        return out.toString();
    }
    private static String csvValue(String value) {
        String v=value==null?"":value.replace("\"","\"\"");String probe=v.stripLeading();
        if(probe.startsWith("=")||probe.startsWith("+")||probe.startsWith("-")||probe.startsWith("@")||v.startsWith("\t")||v.startsWith("\r")||v.startsWith("\n"))v="'"+v;
        return "\""+v+"\"";
    }
    /** The rows of a report with the column "No." in front: the header row gets the name, every other row its number, counted from 1 in the order of the report. */
    public static List<List<String>> withRowNumbers(List<List<String>> rows) {
        if(rows==null||rows.isEmpty())return rows;
        var numbered=new java.util.ArrayList<List<String>>(rows.size());
        for(int i=0;i<rows.size();i++) {
            var row=new java.util.ArrayList<String>(rows.get(i).size()+1);
            row.add(i==0?"No.":String.valueOf(i));
            row.addAll(rows.get(i));
            numbered.add(row);
        }
        return numbered;
    }

    public static byte[] render(String format,List<List<String>> rows,ReportLayout layout,Map<String,String> values) throws Exception {
        return render(format,rows,layout,values,List.of());
    }
    public static byte[] render(String format,List<List<String>> rows,ReportLayout layout,Map<String,String> values,List<ReportCharts.Result> charts) throws Exception {
        return render(format,rows,layout,values,charts,Map.of());
    }
    public static byte[] render(String format,List<List<String>> rows,ReportLayout layout,Map<String,String> values,List<ReportCharts.Result> charts,Map<String,byte[]> components) throws Exception {
        layout.validated();
        values=withCompany(layout,values);
        // The number of each row is added here, after the charts have been counted from the columns that were chosen (REPORT-ROW-NUMBER-2026-11-16).
        rows=withRowNumbers(rows);
        if("XLSX".equals(format)) return spreadsheet(rows,layout,values,charts);
        if(!"PDF".equals(format)) throw new IllegalArgumentException("REPORT_FORMAT_NOT_ALLOWED");
        for(String part:layout.effectiveWordComponents().keySet())if((!part.equals("cover")||layout.cover())&&!components.containsKey(part))throw new IllegalStateException("REPORT_WORD_RENDERER_REQUIRED");
        float pageWidth=layout.pageWidth(),pageHeight=layout.pageHeight();
        boolean wordHeader=components.containsKey("header"),wordFooter=components.containsKey("footer");
        boolean notice=values.get("report.gmpNotice")!=null&&!values.get("report.gmpNotice").isBlank();
        // The bands take their own room and the table starts below them: the logo and the texts of the frame never lie over the data.
        float headerHeight=wordHeader?125:ReportPageFrame.headerHeight(layout,pageWidth,pageHeight,false)+10;
        float footerHeight=ReportPageFrame.footerHeight(layout,wordFooter);
        float noticeY=wordFooter?8:ReportPageFrame.BOTTOM_PAD+footerHeight+6,signedY=notice?noticeY+9:noticeY;
        float bottomMargin=wordFooter?100:signedY+(signed(values)?9:0)+14;
        float infoHeight=wordHeader?0:ReportPageFrame.infoHeight(layout);
        try(var pdf=Loader.loadPDF(ReportPdfRenderer.render(rows,pageWidth,pageHeight,headerHeight,bottomMargin,layout.effectiveFont(),infoHeight>0?infoHeight+6:0));var input=ReportPresentationRenderer.class.getResourceAsStream(ReportFonts.bodyResource(layout.effectiveFont()));var out=new ByteArrayOutputStream()) {
            var font=PDType0Font.load(pdf,input);
            var styled=new ReportStyledText(pdf,font,layout.effectiveFont());
            for(int c=charts.size()-1;c>=0;c--) {
                var page=new PDPage(new PDRectangle(pageWidth,pageHeight));pdf.getPages().insertBefore(page,pdf.getPage(0));
                try(var stream=new PDPageContentStream(pdf,page)) {
                    float top=wordHeader?125:Math.max(60,headerHeight),bottom=wordFooter?100:60;
                    float chartWidth=pageWidth-60,chartHeight=Math.min(pageHeight-top-bottom,chartWidth*475/782);
                    stream.drawImage(org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject.createFromByteArray(pdf,ReportCharts.png(charts.get(c),layout.effectiveFont()),"chart-"+(c+1)),30,pageHeight-top-chartHeight,chartWidth,chartHeight);
                }
            }
            if(layout.cover()) {
                var cover=new PDPage(new PDRectangle(pageWidth,pageHeight));pdf.getPages().insertBefore(cover,pdf.getPage(0));
                if(components.containsKey("cover"))component(pdf,cover,components.get("cover"),0,0,pageWidth,pageHeight,false);
                else try(var stream=new PDPageContentStream(pdf,cover)) {
                    float y=pageHeight-155,blockWidth=pageWidth-100;
                    y=styledParagraph(styled,stream,layout.coverTitleStyle(),layout.resolve(layout.coverTitle(),values),50,y,22,blockWidth);
                    y=styledParagraph(styled,stream,layout.coverSubtitleStyle(),layout.resolve(layout.subtitle(),values),50,y-30,12,blockWidth);
                    if(layout.showExecutor()) y=paragraph(stream,font,"Prepared by: "+values.get("report.executor"),50,y-35,11,blockWidth);
                    if(layout.showGeneratedAt()) y=paragraph(stream,font,"Generated at (UTC+7): "+values.get("report.generatedAt"),50,y-20,11,blockWidth);
                    paragraph(stream,font,"Data as of (UTC+7): "+values.get("report.asOfAt"),50,y-20,10,blockWidth);
                }
            }
            int firstTablePage=(layout.cover()?1:0)+charts.size();
            if(infoHeight>0) try(var stream=new PDPageContentStream(pdf,pdf.getPage(firstTablePage),PDPageContentStream.AppendMode.APPEND,true,true)) {
                var context=new HashMap<>(values);
                ReportPageFrame.drawInfo(styled,stream,layout,context,pageWidth,pageHeight-headerHeight);
            }
            if(ReportPageFrame.hasClosingPage(layout)) {
                var closing=new PDPage(new PDRectangle(pageWidth,pageHeight));pdf.addPage(closing);
                try(var stream=new PDPageContentStream(pdf,closing)) { ReportPageFrame.drawClosingPage(styled,stream,layout,pageWidth,pageHeight,headerHeight); }
            }
            for(int index=0;index<pdf.getNumberOfPages();index++) {
                var context=new HashMap<>(values);context.put("page.number",String.valueOf(index+1));context.put("page.total",String.valueOf(pdf.getNumberOfPages()));
                var page=pdf.getPage(index);
                if(components.containsKey("header"))component(pdf,page,components.get("header"),30,pageHeight-110,pageWidth-60,80,true);
                if(components.containsKey("footer"))component(pdf,page,components.get("footer"),30,25,pageWidth-60,60,true);
                if(layout.watermarkEnabled()&&"BEHIND".equals(layout.effectiveWatermark().layer())) mark(pdf,page,layout.effectiveWatermark(),layout.resolve(layout.watermark(),context),index);
                try(var stream=new PDPageContentStream(pdf,page,PDPageContentStream.AppendMode.APPEND,true,true)) {
                    if(!wordHeader) ReportPageFrame.drawHeader(styled,stream,layout,context,pageWidth,pageHeight,index==0,false);
                    if(!wordFooter) ReportPageFrame.drawFooter(styled,stream,layout,context,pageWidth,index+1,pdf.getNumberOfPages(),layout.pageNumbers());
                    else if(layout.pageNumbers()) line(stream,font,(index+1)+" / "+pdf.getNumberOfPages(),pageWidth-77,14,8,60);
                    // The statement of GMP status is on every page and is not part of the layout, so a layout cannot remove it.
                    if(notice) line(stream,font,values.get("report.gmpNotice"),30,noticeY,7,pageWidth-162);
                    // A signed run says so on every page: who, when and the number of the signature (the reason is in the information of the XLSX and with the signature).
                    if(signed(values)) line(stream,font,"Signed electronically by "+values.get("report.signedBy")+" on "+values.get("report.signedAt")+" (UTC+7), signature "+values.get("report.signatureId")+".",30,wordFooter?17:signedY+9,7,pageWidth-162);
                    // With a header from a Word file the logo is still drawn where the layout put it (as before the frame); it is the file's header that has the room then.
                    var logo=layout.logo();
                    if(wordHeader&&logo!=null&&logo.enabled()&&(index==0||"ALL".equals(logo.pages()))) {
                        var image=ReportImage.decode(logo.data());float width=(float)(logo.width()*pageWidth/100),height=width*image.getHeight()/image.getWidth(); if(height>140){width*=140/height;height=140;}
                        stream.drawImage(org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory.createFromImage(pdf,image),(float)(logo.x()*pageWidth/100),Math.max(0,(float)(pageHeight-logo.y()*pageHeight/100-height)),width,height);
                    }
                }
                if(layout.watermarkEnabled()&&"ABOVE".equals(layout.effectiveWatermark().layer())) mark(pdf,page,layout.effectiveWatermark(),layout.resolve(layout.watermark(),context),index);
                if(layout.stampEnabled()) stamp(pdf,page,layout.effectiveStamp(),layout.resolve(layout.stamp(),context),index);
            }
            pdf.save(out);return out.toByteArray();
        }
    }
    /** Where the logo is drawn on a page, in points from its bottom left: {x, y, width, height}; null when there is no logo. For the editor's frame over the preview. */
    public static float[] logoRect(ReportLayout layout) { return ReportPageFrame.logoRect(layout,layout.pageWidth(),layout.pageHeight()); }
    /** A part of a page that can be pointed at: kind (HEADER_LEFT, FOOTER_RIGHT, INFO, APPROVAL, NOTES...) and place in points from the bottom left of the page. */
    public record Zone(String kind, float x, float y, float width, float height) {}
    /** The zones of one page of the layout, as the page is drawn (see {@link ReportPageFrame#zones}). */
    public static List<Zone> zones(ReportLayout layout, boolean tablePage, boolean closingPage) {
        return ReportPageFrame.zones(layout, layout.pageWidth(), layout.pageHeight(), tablePage, closingPage).stream()
                .map(zone -> new Zone(zone.kind(), zone.x(), zone.y(), zone.width(), zone.height())).toList();
    }
    /** The height of the header band of a page of the layout, in points: the editor shades it, and the table starts below it. */
    public static float headerBandHeight(ReportLayout layout) { return ReportPageFrame.headerHeight(layout,layout.pageWidth(),layout.pageHeight(),false); }
    /** The values of the report with the name of the company of the frame, which is a setting of the appearance and not a value of a run. */
    private static Map<String,String> withCompany(ReportLayout layout,Map<String,String> values) {
        var all=new HashMap<>(values);all.put("company.name",layout.effectiveFrame().effectiveCompanyName());return all;
    }
    /** Fonts of the watermark and the stamp, one per document and file: loading one on every page embedded a new copy of the font in every page of the file. */
    private static final Map<PDDocument,Map<String,PDType0Font>> MARK_FONTS=Collections.synchronizedMap(new WeakHashMap<>());
    private static PDType0Font markFont(PDDocument pdf,String fontKey) throws Exception {
        String resource=ReportFonts.markResource(fontKey);
        var perDocument=MARK_FONTS.computeIfAbsent(pdf,d->new HashMap<>());
        var loaded=perDocument.get(resource);
        if(loaded==null) {
            try(var input=ReportPresentationRenderer.class.getResourceAsStream(resource)) { loaded=PDType0Font.load(pdf,input); }
            perDocument.put(resource,loaded);
        }
        return loaded;
    }
    private static void mark(PDDocument pdf,PDPage page,ReportLayout.Mark style,String text,int index) throws Exception {
        if(index>0&&"FIRST".equals(style.pages()))return;
        var font=markFont(pdf,style.font());
        try(var stream=new PDPageContentStream(pdf,page,"BEHIND".equals(style.layer())?PDPageContentStream.AppendMode.PREPEND:PDPageContentStream.AppendMode.APPEND,true,true)) {
            stream.saveGraphicsState();var alpha=new PDExtendedGraphicsState();alpha.setNonStrokingAlphaConstant(style.opacity()/100f);stream.setGraphicsStateParameters(alpha);
            float width=page.getMediaBox().getWidth(),height=page.getMediaBox().getHeight();
            stream.setNonStrokingColor(java.awt.Color.decode(style.color()));stream.transform(Matrix.getRotateInstance(Math.toRadians(style.rotation()),(float)(style.x()*width/100),(float)(height-style.y()*height/100)));
            line(stream,font,text,0,0,style.fontSize(),(float)(style.width()*width/100));stream.restoreGraphicsState();
        }
    }
    /** The stamp is always above the content, so that it is never hidden. */
    private static void stamp(PDDocument pdf,PDPage page,ReportLayout.Stamp style,String text,int index) throws Exception {
        if(index>0&&"FIRST".equals(style.pages()))return;
        var font=markFont(pdf,style.font());
        try(var stream=new PDPageContentStream(pdf,page,PDPageContentStream.AppendMode.APPEND,true,true)) {
            ReportStampBox.layout(font,text.replaceAll("[\\p{Cc}]"," "),style,page.getMediaBox().getWidth(),page.getMediaBox().getHeight()).draw(stream,font,style);
        }
    }
    private static void component(PDDocument pdf,PDPage page,byte[] bytes,float x,float y,float width,float height,boolean crop) throws Exception {
        try(var source=Loader.loadPDF(bytes)) {
            var box=source.getPage(0).getMediaBox();float left=0,bottom=0,w=box.getWidth(),h=box.getHeight();
            if(crop) {
                var image=new org.apache.pdfbox.rendering.PDFRenderer(source).renderImageWithDPI(0,72);
                int minX=image.getWidth(),minY=image.getHeight(),maxX=-1,maxY=-1;
                for(int row=0;row<image.getHeight();row++)for(int col=0;col<image.getWidth();col++) {
                    int rgb=image.getRGB(col,row);if(((rgb>>16)&255)<245||((rgb>>8)&255)<245||(rgb&255)<245){minX=Math.min(minX,col);minY=Math.min(minY,row);maxX=Math.max(maxX,col);maxY=Math.max(maxY,row);}
                }
                if(maxX<0)return;
                left=Math.max(0,minX-2);bottom=Math.max(0,box.getHeight()-maxY-3);w=Math.min(box.getWidth()-left,maxX-minX+5);h=Math.min(box.getHeight()-bottom,maxY-minY+5);
            }
            float scale=Math.min(width/w,height/h);
            var form=new org.apache.pdfbox.multipdf.LayerUtility(pdf).importPageAsForm(source,0);
            try(var stream=new PDPageContentStream(pdf,page,PDPageContentStream.AppendMode.APPEND,true,true)) {
                stream.saveGraphicsState();stream.addRect(x,y,width,height);stream.clip();
                stream.transform(new Matrix(scale,0,0,scale,x-left*scale,y+height-h*scale-bottom*scale));stream.drawForm(form);stream.restoreGraphicsState();
            }
        }
    }
    /** A block of the cover in its style: wrapped in the width, each row aligned by the style. A block with no style is drawn by {@link #paragraph} as it always was. */
    private static float styledParagraph(ReportStyledText styled,PDPageContentStream stream,ReportTextStyle style,String value,float x,float y,float size,float width) throws Exception {
        if(style==null||style.plain()) return paragraph(stream,styled.font(null),value,x,y,size,width);
        size=style.effectiveSize((int)size);
        value=style.apply(value);
        var font=styled.font(style);
        float measured=font.getStringWidth(value)/1000;
        size=Math.min(size,(float)Math.sqrt(100*width/(1.5*Math.max(1,measured))));
        StringBuilder row=new StringBuilder();
        for(int point:value.codePoints().toArray()) {
            if(Character.isISOControl(point)) continue;
            String character=new String(Character.toChars(point));
            if(font.getStringWidth(row+character)/1000*size>width) {styled.drawIn(stream,style,row.toString(),x,y,size,width,java.awt.Color.BLACK);row.setLength(0);y-=size*1.5f;}
            row.append(character);
        }
        styled.drawIn(stream,style,row.toString(),x,y,size,width,java.awt.Color.BLACK);return y-size*1.5f;
    }
    private static float paragraph(PDPageContentStream stream,PDType0Font font,String value,float x,float y,float size,float width) throws Exception {
        // Bound each cover block to 100 points even for very wide, maximum-length text.
        float measured=font.getStringWidth(value)/1000;
        size=Math.min(size,(float)Math.sqrt(100*width/(1.5*Math.max(1,measured))));
        StringBuilder row=new StringBuilder();
        for(int point:value.codePoints().toArray()) {
            if(Character.isISOControl(point)) continue;
            String character=new String(Character.toChars(point));
            if(font.getStringWidth(row+character)/1000*size>width) {line(stream,font,row.toString(),x,y,size,width);row.setLength(0);y-=size*1.5f;}
            row.append(character);
        }
        line(stream,font,row.toString(),x,y,size,width);return y-size*1.5f;
    }
    private static void line(PDPageContentStream stream,PDType0Font font,String value,float x,float y,float size,float width) throws Exception {
        // Shrink a bounded header/stamp to fit; do not silently truncate metadata.
        value=value.replaceAll("[\\p{Cc}]", " ");
        float actual=Math.min(size,width*1000/Math.max(1,font.getStringWidth(value)));
        stream.beginText();stream.setFont(font,actual);stream.newLineAtOffset(x,y);stream.showText(value);stream.endText();
    }
    private static byte[] spreadsheet(List<List<String>> rows,ReportLayout layout,Map<String,String> values,List<ReportCharts.Result> charts) throws Exception {
        // Streaming workbook: only a window of rows is kept in memory, so a Full run of 100,000 rows does not exhaust the heap (REPORT-LARGE-RUN-2026-11-12).
        var book=new SXSSFWorkbook(200);
        try(var out=new ByteArrayOutputStream()) {
            var info=book.createSheet("Report information");int r=0;
            var details=new LinkedHashMap<String,String>();
            // A workbook can be edited after it leaves EQMS: it says which run it is, and that the controlled report is the file EQMS stored (REPORT-FILE-STATUS-2026-11-16).
            details.put("Run",values.get("report.runId"));
            details.put("Status of this file",DATA_COPY_NOTICE);
            details.put("Title",layout.resolve(layout.coverTitle(),values));details.put("Subtitle",layout.resolve(layout.subtitle(),values));
            details.put("Template",values.get("report.code"));details.put("Version",values.get("template.version"));
            if(layout.showExecutor())details.put("Prepared by",values.get("report.executor"));
            if(layout.showGeneratedAt())details.put("Generated at (UTC+7)",values.get("report.generatedAt"));
            details.put("Data as of (UTC+7)",values.get("report.asOfAt"));
            if(values.get("report.gmpNotice")!=null)details.put("GMP status",values.get("report.gmpNotice"));
            if(signed(values)) {
                details.put("Signed by",values.get("report.signedBy"));
                details.put("Signed on (UTC+7)",values.get("report.signedAt"));
                details.put("Reason for signing",values.get("report.signatureReason"));
                details.put("Signature",values.get("report.signatureId"));
                details.put("Signature meaning","Report Run Requested");
            }
            if(layout.watermarkEnabled())details.put("Watermark",layout.resolve(layout.watermark(),values));
            if(layout.stampEnabled())details.put("Presentation stamp (not a signature)",layout.resolve(layout.stamp(),values));
            var frame=layout.effectiveFrame();
            // The information the layout asks for comes first, as it does above the table of a PDF.
            var shown=new LinkedHashMap<String,String>();
            for(var item:frame.effectiveInfo())shown.put(layout.resolve(item.label(),values),layout.resolve(item.value(),values));
            shown.putAll(details);details=shown;
            for(var item:details.entrySet()) {var row=info.createRow(r++);row.createCell(0).setCellValue(item.getKey());row.createCell(1).setCellValue(item.getValue());}
            if(frame.approval()) {r++;var head=info.createRow(r++);var shownColumns=frame.shownApprovalColumns();for(int i=0;i<shownColumns.size();i++)head.createCell(i+1).setCellValue(shownColumns.get(i).effectiveLabel());for(String role:frame.effectiveApprovalRoles()){var row=info.createRow(r++);row.createCell(0).setCellValue(role);}}
            if(frame.notes()) {r++;info.createRow(r++).createCell(0).setCellValue("Notes / Comments");}
            info.setColumnWidth(0,32*256);info.setColumnWidth(1,90*256);
            // The logo is on the information sheet, beside the information: on the sheet of the data it would lie over cells.
            var logo=layout.logo();
            if(logo!=null&&logo.enabled()&&logo.data()!=null&&!logo.data().isBlank()) {
                var image=ReportImage.decode(logo.data());var png=new ByteArrayOutputStream();javax.imageio.ImageIO.write(image,"png",png);
                int picture=book.addPicture(png.toByteArray(),org.apache.poi.ss.usermodel.Workbook.PICTURE_TYPE_PNG);
                var anchor=book.getCreationHelper().createClientAnchor();anchor.setCol1(3);anchor.setRow1(0);
                var drawn=info.createDrawingPatriarch().createPicture(anchor,picture);
                float width=Math.min(220,Math.max(60,(float)(logo.width()*8))),height=width*image.getHeight()/image.getWidth();
                if(height>90){width*=90/height;}
                drawn.resize(width/image.getWidth());
            }
            var sheet=book.createSheet("Report");
            sheet.getPrintSetup().setLandscape("LANDSCAPE".equals(layout.effectiveOrientation()));
            for(r=0;r<rows.size();r++) {var row=sheet.createRow(r);for(int c=0;c<rows.get(r).size();c++)row.createCell(c).setCellValue(rows.get(r).get(c));}
            for(int c=0;c<rows.getFirst().size();c++)sheet.setColumnWidth(c,columnWidth(rows,c));
            sheet.createFreezePane(0,1);sheet.setRepeatingRows(new org.apache.poi.ss.util.CellRangeAddress(0,0,-1,-1));
            sheet.getHeader().setLeft(sheetText(layout,frame.header("LEFT"),values));sheet.getHeader().setCenter(sheetText(layout,frame.header("CENTER"),values));sheet.getHeader().setRight(sheetText(layout,frame.header("RIGHT"),values));
            sheet.getFooter().setLeft(sheetText(layout,frame.footer("LEFT"),values));
            sheet.getFooter().setRight((sheetText(layout,frame.footer("RIGHT"),values)+(layout.pageNumbers()?"\nPage &P / &N":"")).trim());
            // The statement of GMP status and the signature are in the footer, with whatever the layout put in its centre.
            sheet.getFooter().setCenter((sheetText(layout,frame.footer("CENTER"),values)+(values.get("report.gmpNotice")==null?"":"\n"+values.get("report.gmpNotice").replace("&","&&"))
                    +(signed(values)?"\nSigned by "+values.get("report.signedBy").replace("&","&&")+", signature "+values.get("report.signatureId")+".":"")).trim());
            for(int c=0;c<charts.size();c++) {
                var chart=charts.get(c);var analysis=book.createSheet("Analysis "+(c+1));analysis.createRow(0).createCell(0).setCellValue(chart.title());
                var header=analysis.createRow(1);header.createCell(0).setCellValue("Category");header.createCell(1).setCellValue("Count");header.createCell(2).setCellValue(chart.metric());
                int n=2;for(var point:chart.points()){var row=analysis.createRow(n++);row.createCell(0).setCellValue(point.label());row.createCell(1).setCellValue(point.count());row.createCell(2).setCellValue(point.value());}
                int picture=book.addPicture(ReportCharts.png(chart,layout.effectiveFont()),org.apache.poi.ss.usermodel.Workbook.PICTURE_TYPE_PNG);
                var anchor=book.getCreationHelper().createClientAnchor();anchor.setCol1(4);anchor.setRow1(1);anchor.setCol2(18);anchor.setRow2(32);analysis.createDrawingPatriarch().createPicture(anchor,picture);
                analysis.setColumnWidth(0,40*256);
            }
            book.write(out);return out.toByteArray();
        } finally { book.dispose(); }
    }
    /** The text of one place of the header or footer of a sheet: its lines, with the values filled in and the & of the text written as the sheet wants it. */
    private static String sheetText(ReportLayout layout,ReportLayout.Slot slot,Map<String,String> values) {
        return layout.resolve(slot.effectiveText(),values).replace("&","&&").replaceAll("\\R","\n");
    }
    /** True when the run was signed at the request and the file says so. */
    private static boolean signed(Map<String,String> values) {
        return values.get("report.signedBy")!=null&&!values.get("report.signedBy").isBlank();
    }
    /** A column is as wide as its header and the first 200 rows (at least 10 and at most 60 characters), so the width never needs every row to be read. */
    private static int columnWidth(List<List<String>> rows,int column) {
        int longest=10;
        for(int r=0;r<Math.min(rows.size(),201);r++) {var row=rows.get(r);if(column<row.size()&&row.get(column)!=null)longest=Math.max(longest,row.get(column).length());}
        return Math.min(60,longest+2)*256;
    }
}
