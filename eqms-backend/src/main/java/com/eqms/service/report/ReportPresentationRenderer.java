package com.eqms.service.report;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.*;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType0Font;
import org.apache.pdfbox.pdmodel.graphics.state.PDExtendedGraphicsState;
import org.apache.pdfbox.util.Matrix;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import java.io.ByteArrayOutputStream;
import java.util.*;

/** Presentation applies to pinned layout only; CSV remains a data-only exchange. */
public final class ReportPresentationRenderer {
    private ReportPresentationRenderer() {}
    public static byte[] render(String format,List<List<String>> rows,ReportLayout layout,Map<String,String> values) throws Exception {
        return render(format,rows,layout,values,List.of());
    }
    public static byte[] render(String format,List<List<String>> rows,ReportLayout layout,Map<String,String> values,List<ReportCharts.Result> charts) throws Exception {
        return render(format,rows,layout,values,charts,Map.of());
    }
    public static byte[] render(String format,List<List<String>> rows,ReportLayout layout,Map<String,String> values,List<ReportCharts.Result> charts,Map<String,byte[]> components) throws Exception {
        layout.validated();
        if("XLSX".equals(format)) return spreadsheet(rows,layout,values,charts);
        if(!"PDF".equals(format)) throw new IllegalArgumentException("REPORT_FORMAT_NOT_ALLOWED");
        for(String part:layout.effectiveWordComponents().keySet())if((!part.equals("cover")||layout.cover())&&!components.containsKey(part))throw new IllegalStateException("REPORT_WORD_RENDERER_REQUIRED");
        float pageWidth=layout.pageWidth(),pageHeight=layout.pageHeight();
        try(var pdf=Loader.loadPDF(ReportPdfRenderer.render(rows,pageWidth,pageHeight,components.containsKey("header")?125:30,components.containsKey("footer")?100:30,layout.effectiveFont()));var input=ReportPresentationRenderer.class.getResourceAsStream(ReportFonts.bodyResource(layout.effectiveFont()));var out=new ByteArrayOutputStream()) {
            var font=PDType0Font.load(pdf,input);
            for(int c=charts.size()-1;c>=0;c--) {
                var page=new PDPage(new PDRectangle(pageWidth,pageHeight));pdf.getPages().insertBefore(page,pdf.getPage(0));
                try(var stream=new PDPageContentStream(pdf,page)) {
                    float top=components.containsKey("header")?125:60,bottom=components.containsKey("footer")?100:60;
                    float chartWidth=pageWidth-60,chartHeight=Math.min(pageHeight-top-bottom,chartWidth*475/782);
                    stream.drawImage(org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory.createFromImage(pdf,ReportCharts.image(charts.get(c),layout.effectiveFont())),30,pageHeight-top-chartHeight,chartWidth,chartHeight);
                }
            }
            if(layout.cover()) {
                var cover=new PDPage(new PDRectangle(pageWidth,pageHeight));pdf.getPages().insertBefore(cover,pdf.getPage(0));
                if(components.containsKey("cover"))component(pdf,cover,components.get("cover"),0,0,pageWidth,pageHeight,false);
                else try(var stream=new PDPageContentStream(pdf,cover)) {
                    float y=pageHeight-155,blockWidth=pageWidth-100;
                    y=paragraph(stream,font,layout.resolve(layout.coverTitle(),values),50,y,22,blockWidth);
                    y=paragraph(stream,font,layout.resolve(layout.subtitle(),values),50,y-30,12,blockWidth);
                    if(layout.showExecutor()) y=paragraph(stream,font,"Prepared by: "+values.get("report.executor"),50,y-35,11,blockWidth);
                    if(layout.showGeneratedAt()) y=paragraph(stream,font,"Generated at (UTC): "+values.get("report.generatedAt"),50,y-20,11,blockWidth);
                    paragraph(stream,font,"Data as of: "+values.get("report.asOfAt"),50,y-20,10,blockWidth);
                }
            }
            for(int index=0;index<pdf.getNumberOfPages();index++) {
                var context=new HashMap<>(values);context.put("page.number",String.valueOf(index+1));context.put("page.total",String.valueOf(pdf.getNumberOfPages()));
                var page=pdf.getPage(index);
                if(components.containsKey("header"))component(pdf,page,components.get("header"),30,pageHeight-110,pageWidth-60,80,true);
                if(components.containsKey("footer"))component(pdf,page,components.get("footer"),30,25,pageWidth-60,60,true);
                if(layout.watermarkEnabled()&&"BEHIND".equals(layout.effectiveWatermark().layer())) mark(pdf,page,layout.effectiveWatermark(),layout.resolve(layout.watermark(),context),index);
                try(var stream=new PDPageContentStream(pdf,page,PDPageContentStream.AppendMode.APPEND,true,true)) {
                    if(!components.containsKey("header"))line(stream,font,layout.resolve(layout.header(),context),30,pageHeight-15,8,pageWidth-60);
                    if(!components.containsKey("footer"))line(stream,font,layout.resolve(layout.footer(),context),30,14,7,pageWidth-162);
                    if(layout.pageNumbers()) line(stream,font,(index+1)+" / "+pdf.getNumberOfPages(),pageWidth-77,14,8,60);
                    var logo=layout.logo();
                    if(logo!=null&&logo.enabled()&&(index==0||"ALL".equals(logo.pages()))) {
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
    private static void mark(PDDocument pdf,PDPage page,ReportLayout.Mark style,String text,int index) throws Exception {
        if(index>0&&"FIRST".equals(style.pages()))return;
        try(var input=ReportPresentationRenderer.class.getResourceAsStream(ReportFonts.markResource(style.font()));
            var stream=new PDPageContentStream(pdf,page,"BEHIND".equals(style.layer())?PDPageContentStream.AppendMode.PREPEND:PDPageContentStream.AppendMode.APPEND,true,true)) {
            var font=PDType0Font.load(pdf,input);stream.saveGraphicsState();var alpha=new PDExtendedGraphicsState();alpha.setNonStrokingAlphaConstant(style.opacity()/100f);stream.setGraphicsStateParameters(alpha);
            float width=page.getMediaBox().getWidth(),height=page.getMediaBox().getHeight();
            stream.setNonStrokingColor(java.awt.Color.decode(style.color()));stream.transform(Matrix.getRotateInstance(Math.toRadians(style.rotation()),(float)(style.x()*width/100),(float)(height-style.y()*height/100)));
            line(stream,font,text,0,0,style.fontSize(),(float)(style.width()*width/100));stream.restoreGraphicsState();
        }
    }
    /** The stamp is always above the content, so that it is never hidden. */
    private static void stamp(PDDocument pdf,PDPage page,ReportLayout.Stamp style,String text,int index) throws Exception {
        if(index>0&&"FIRST".equals(style.pages()))return;
        try(var input=ReportPresentationRenderer.class.getResourceAsStream(ReportFonts.markResource(style.font()));
            var stream=new PDPageContentStream(pdf,page,PDPageContentStream.AppendMode.APPEND,true,true)) {
            var font=PDType0Font.load(pdf,input);
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
        try(var book=new XSSFWorkbook();var out=new ByteArrayOutputStream()) {
            var info=book.createSheet("Report information");int r=0;
            var details=new LinkedHashMap<String,String>();details.put("Title",layout.resolve(layout.coverTitle(),values));details.put("Subtitle",layout.resolve(layout.subtitle(),values));
            details.put("Template",values.get("report.code"));details.put("Version",values.get("template.version"));
            if(layout.showExecutor())details.put("Prepared by",values.get("report.executor"));
            if(layout.showGeneratedAt())details.put("Generated at (UTC)",values.get("report.generatedAt"));
            details.put("Data as of",values.get("report.asOfAt"));
            if(layout.watermarkEnabled())details.put("Watermark",layout.resolve(layout.watermark(),values));
            if(layout.stampEnabled())details.put("Presentation stamp (not a signature)",layout.resolve(layout.stamp(),values));
            for(var item:details.entrySet()) {var row=info.createRow(r++);row.createCell(0).setCellValue(item.getKey());row.createCell(1).setCellValue(item.getValue());}
            info.setColumnWidth(0,32*256);info.setColumnWidth(1,90*256);
            var sheet=book.createSheet("Report");
            sheet.getPrintSetup().setLandscape("LANDSCAPE".equals(layout.effectiveOrientation()));
            for(r=0;r<rows.size();r++) {var row=sheet.createRow(r);for(int c=0;c<rows.get(r).size();c++)row.createCell(c).setCellValue(rows.get(r).get(c));}
            for(int c=0;c<rows.getFirst().size();c++)sheet.autoSizeColumn(c);
            sheet.createFreezePane(0,1);sheet.setRepeatingRows(new org.apache.poi.ss.util.CellRangeAddress(0,0,-1,-1));
            sheet.getHeader().setLeft(layout.resolve(layout.header(),values).replace("&","&&"));sheet.getFooter().setLeft(layout.resolve(layout.footer(),values).replace("&","&&"));
            if(layout.pageNumbers())sheet.getFooter().setRight("Page &P / &N");
            for(int c=0;c<charts.size();c++) {
                var chart=charts.get(c);var analysis=book.createSheet("Analysis "+(c+1));analysis.createRow(0).createCell(0).setCellValue(chart.title());
                var header=analysis.createRow(1);header.createCell(0).setCellValue("Category");header.createCell(1).setCellValue("Count");header.createCell(2).setCellValue(chart.metric());
                int n=2;for(var point:chart.points()){var row=analysis.createRow(n++);row.createCell(0).setCellValue(point.label());row.createCell(1).setCellValue(point.count());row.createCell(2).setCellValue(point.value());}
                var png=new ByteArrayOutputStream();javax.imageio.ImageIO.write(ReportCharts.image(chart,layout.effectiveFont()),"png",png);
                int picture=book.addPicture(png.toByteArray(),org.apache.poi.ss.usermodel.Workbook.PICTURE_TYPE_PNG);
                var anchor=book.getCreationHelper().createClientAnchor();anchor.setCol1(4);anchor.setRow1(1);anchor.setCol2(18);anchor.setRow2(32);analysis.createDrawingPatriarch().createPicture(anchor,picture);
                analysis.setColumnWidth(0,40*256);
            }
            book.write(out);return out.toByteArray();
        }
    }
}
