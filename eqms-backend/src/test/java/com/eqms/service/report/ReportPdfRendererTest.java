package com.eqms.service.report;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class ReportPdfRendererTest {
    @Test void preservesVietnameseLongCellsAndRowsBeyondFirstPage() throws Exception {
        List<List<String>> rows=new ArrayList<>(); rows.add(List.of("Document Number","Tên tài liệu"));
        for (int i=0;i<120;i++) rows.add(List.of("FORM-"+i,"Yêu cầu tạo người dùng và mật khẩu "+"nội dung dài ".repeat(20)+" END-"+i));
        byte[] bytes=ReportPdfRenderer.render(rows);
        java.nio.file.Files.write(java.nio.file.Path.of("target/report-template-unicode-test.pdf"),bytes);
        try(var pdf=Loader.loadPDF(bytes)) {
            assertTrue(pdf.getNumberOfPages()>1); String text=new PDFTextStripper().getText(pdf);
            assertTrue(text.contains("Yêu cầu tạo")); assertTrue(text.contains("FORM-119"));
            assertTrue(text.replaceAll("\\s+","").contains("END-119"));
        }
    }
    @Test void rejectsNoColumns() { assertThrows(IllegalArgumentException.class,()->ReportPdfRenderer.render(List.of())); }
}
