package com.eqms.service.report;

import org.apache.pdfbox.pdmodel.*;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType0Font;
import java.io.ByteArrayOutputStream;
import java.util.*;

/** Unicode, wrapped, paginated output. Never silently drops a cell, row or page. */
public final class ReportPdfRenderer {
    private ReportPdfRenderer() {}
    public static byte[] render(List<List<String>> rows) throws Exception {
        return render(rows,842,595);
    }
    public static byte[] render(List<List<String>> rows,float pageWidth,float pageHeight) throws Exception {
        return render(rows,pageWidth,pageHeight,30,30);
    }
    public static byte[] render(List<List<String>> rows,float pageWidth,float pageHeight,float topMargin,float bottomMargin) throws Exception {
        return render(rows,pageWidth,pageHeight,topMargin,bottomMargin,null);
    }
    /** As above, in the font of the report (see ReportFonts); Noto Sans when none is given. */
    public static byte[] render(List<List<String>> rows,float pageWidth,float pageHeight,float topMargin,float bottomMargin,String fontKey) throws Exception {
        return render(rows,pageWidth,pageHeight,topMargin,bottomMargin,fontKey,0);
    }
    /** firstPageOffset: room left free at the top of the first page, below the top margin, for a block that is drawn there (the information of the report). */
    public static byte[] render(List<List<String>> rows,float pageWidth,float pageHeight,float topMargin,float bottomMargin,String fontKey,float firstPageOffset) throws Exception {
        if (rows.isEmpty() || rows.getFirst().isEmpty()) throw new IllegalArgumentException("REPORT_EMPTY_COLUMNS");
        try (PDDocument pdf = new PDDocument(); var input = ReportPdfRenderer.class.getResourceAsStream(ReportFonts.bodyResource(fontKey)); var out = new ByteArrayOutputStream()) {
            if (input == null) throw new IllegalStateException("REPORT_FONT_UNAVAILABLE");
            var font = PDType0Font.load(pdf,input);
            float width = pageWidth, height = pageHeight, margin = 30, size = 8, lineHeight = 12;
            float cellWidth = (width-2*margin)/rows.getFirst().size();
            PDPageContentStream stream = null;
            float y = 0;
            int pageNumber = 0;
            // The table has a frame: a line above the header, one under every row and one between every two columns (REPORT-PDF-GRID-2026-11-16).
            int columns = rows.getFirst().size();
            float segmentTop = 0;
            try {
                for (int r=0;r<rows.size();r++) {
                    var wrapped = new ArrayList<List<String>>();
                    for (String cell : rows.get(r)) wrapped.add(wrap(font,Objects.toString(cell,""),size,cellWidth-10));
                    int lines = wrapped.stream().mapToInt(List::size).max().orElse(1);
                    // Keep ordinary rows together; only a row taller than a full page may continue.
                    if (r>0 && stream!=null && lines*lineHeight+5>y-bottomMargin && lines*lineHeight+5<height-topMargin-bottomMargin-70) y=0;
                    segmentTop = y+9;
                    for (int line=0;line<lines;line++) {
                        if (y < bottomMargin+lineHeight) {
                            if (stream != null) { if (line>0) columnLines(stream,margin,cellWidth,columns,segmentTop,y+3); stream.close(); }
                            PDPage page = new PDPage(new PDRectangle(width,height)); pdf.addPage(page);
                            stream = new PDPageContentStream(pdf,page); stream.setFont(font,size);
                            y=height-topMargin-(pageNumber==0?firstPageOffset:0);
                            pageNumber++;
                            if (r>0) {
                                // the header of the table again at the top of the page, framed like the first one
                                float headerTop = y+9;
                                rule(stream,margin,width-margin,headerTop);
                                int headerLines=1;
                                for (int c=0;c<columns;c++) {
                                    var heading = wrap(font,rows.getFirst().get(c),size,cellWidth-10);
                                    headerLines=Math.max(headerLines,heading.size());
                                    for (int h=0;h<heading.size();h++) text(stream,margin+c*cellWidth+5,y-h*lineHeight,heading.get(h));
                                }
                                y-=headerLines*lineHeight;
                                rule(stream,margin,width-margin,y+3);
                                columnLines(stream,margin,cellWidth,columns,headerTop,y+3);
                                y-=5;
                            } else {
                                rule(stream,margin,width-margin,y+9);
                            }
                            segmentTop = y+9;
                        }
                        for (int c=0;c<wrapped.size();c++) {
                            if (line<wrapped.get(c).size()) text(stream,margin+c*cellWidth+5,y,wrapped.get(c).get(line));
                        }
                        y-=lineHeight;
                    }
                    rule(stream,margin,width-margin,y+3);
                    columnLines(stream,margin,cellWidth,columns,segmentTop,y+3);
                    y-=5;
                }
            } finally { if (stream!=null) stream.close(); }
            pdf.save(out); return out.toByteArray();
        }
    }
    private static void rule(PDPageContentStream stream,float from,float to,float y) throws Exception {
        stream.moveTo(from,y); stream.lineTo(to,y); stream.setLineWidth(0.25f); stream.stroke();
    }
    /** The lines between the columns (and the two outer ones) for the part of the table from top down to bottom on this page. */
    private static void columnLines(PDPageContentStream stream,float margin,float cellWidth,int columns,float top,float bottom) throws Exception {
        stream.setLineWidth(0.25f);
        for (int c=0;c<=columns;c++) { stream.moveTo(margin+c*cellWidth,top); stream.lineTo(margin+c*cellWidth,bottom); stream.stroke(); }
    }
    private static void text(PDPageContentStream stream,float x,float y,String value) throws Exception {
        stream.beginText(); stream.newLineAtOffset(x,y); stream.showText(value); stream.endText();
    }
    private static List<String> wrap(PDType0Font font,String value,float size,float max) throws Exception {
        List<String> result=new ArrayList<>();
        for (String paragraph:value.replace('\r','\n').replace('\t',' ').split("\n",-1)) {
            StringBuilder line=new StringBuilder();
            for (String word:paragraph.split("(?<=\\s)")) {
                if (!line.isEmpty() && font.getStringWidth(line+word)/1000*size>max) { result.add(line.toString().stripTrailing()); line.setLength(0); word=word.stripLeading(); }
                for (int point:word.codePoints().toArray()) {
                    if (Character.isISOControl(point)) continue;
                    String character=new String(Character.toChars(point));
                    if (!line.isEmpty() && font.getStringWidth(line+character)/1000*size>max) { result.add(line.toString().stripTrailing()); line.setLength(0); }
                    line.append(character);
                }
            }
            result.add(line.toString());
        }
        return result;
    }
}
