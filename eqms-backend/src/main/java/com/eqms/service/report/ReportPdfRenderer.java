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
        if (rows.isEmpty() || rows.getFirst().isEmpty()) throw new IllegalArgumentException("REPORT_EMPTY_COLUMNS");
        try (PDDocument pdf = new PDDocument(); var input = ReportPdfRenderer.class.getResourceAsStream("/fonts/NotoSans-Bold.ttf"); var out = new ByteArrayOutputStream()) {
            if (input == null) throw new IllegalStateException("REPORT_FONT_UNAVAILABLE");
            var font = PDType0Font.load(pdf,input);
            float width = pageWidth, height = pageHeight, margin = 30, size = 8, lineHeight = 12;
            float cellWidth = (width-2*margin)/rows.getFirst().size();
            PDPageContentStream stream = null;
            float y = 0;
            int pageNumber = 0;
            try {
                for (int r=0;r<rows.size();r++) {
                    var wrapped = new ArrayList<List<String>>();
                    for (String cell : rows.get(r)) wrapped.add(wrap(font,Objects.toString(cell,""),size,cellWidth-10));
                    int lines = wrapped.stream().mapToInt(List::size).max().orElse(1);
                    // Keep ordinary rows together; only a row taller than a full page may continue.
                    if (r>0 && stream!=null && lines*lineHeight+5>y-bottomMargin && lines*lineHeight+5<height-topMargin-bottomMargin-70) y=0;
                    for (int line=0;line<lines;line++) {
                        if (y < bottomMargin+lineHeight) {
                            if (stream != null) stream.close();
                            PDPage page = new PDPage(new PDRectangle(width,height)); pdf.addPage(page);
                            stream = new PDPageContentStream(pdf,page); stream.setFont(font,size);
                            y=height-topMargin;
                            text(stream,margin,y,"Metadata report • Page " + (++pageNumber)); y-=22;
                            if (r>0) {
                                for (int c=0;c<rows.getFirst().size();c++) {
                                    var heading = wrap(font,rows.getFirst().get(c),size,cellWidth-10);
                                    for (int h=0;h<heading.size();h++) text(stream,margin+c*cellWidth+5,y-h*lineHeight,heading.get(h));
                                }
                                int headerLines=rows.getFirst().stream().mapToInt(value -> {
                                    try { return wrap(font,value,size,cellWidth-10).size(); } catch (Exception e) { throw new IllegalStateException(e); }
                                }).max().orElse(1);
                                y-=(headerLines+1)*lineHeight;
                            }
                        }
                        for (int c=0;c<wrapped.size();c++) {
                            if (line<wrapped.get(c).size()) text(stream,margin+c*cellWidth+5,y,wrapped.get(c).get(line));
                        }
                        y-=lineHeight;
                    }
                    stream.moveTo(margin,y+3); stream.lineTo(width-margin,y+3); stream.setLineWidth(0.25f); stream.stroke(); y-=5;
                }
            } finally { if (stream!=null) stream.close(); }
            pdf.save(out); return out.toByteArray();
        }
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
