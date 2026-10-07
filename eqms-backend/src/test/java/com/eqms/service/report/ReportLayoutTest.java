package com.eqms.service.report;

import org.junit.jupiter.api.Test;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import java.io.ByteArrayInputStream;
import java.nio.file.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class ReportLayoutTest {
    ReportLayout layout(String title) {return new ReportLayout(true,title,"TEST · Không dùng nghiệp vụ",true,true,"{{report.title}}","{{report.code}}",true,true,"TEST ONLY",true,"TEST STAMP");}
    Map<String,String> values() {return Map.of("report.title","Báo cáo tài liệu","report.code","TEST_REGISTER","template.version","3","report.executor","Nguyễn Thế Hoàng","report.generatedAt","2026-10-03T12:00:00Z","report.asOfAt","2026-10-03T11:59:00Z");}
    @Test void boundedPlainTextAndAllowlistedTokensOnly() {
        assertThrows(IllegalArgumentException.class,()->layout("{{user.password}}").validated());
        assertThrows(IllegalArgumentException.class,()->layout("{{report.title}").validated());
        assertThrows(IllegalArgumentException.class,()->layout("x".repeat(256)).validated());
        assertThrows(IllegalArgumentException.class,()->layout("bad\ncontrol").validated());
        assertEquals("Báo cáo tài liệu",layout("{{report.title}}").resolve("{{report.title}}",values()));
    }
    @Test void pdfCoverIdentityWatermarkAndPagesUseServerContext() throws Exception {
        var rows=new ArrayList<List<String>>();rows.add(List.of("Document","Description"));
        for(int i=0;i<80;i++)rows.add(List.of("FORM-"+i,"Yêu cầu tạo người dùng "+i));
        byte[] bytes=ReportPresentationRenderer.render("PDF",rows,layout("{{report.title}}"),values());
        Files.write(Path.of("target/report-layout-test.pdf"),bytes);
        try(var pdf=Loader.loadPDF(bytes)) {assertTrue(pdf.getNumberOfPages()>2);String text=new PDFTextStripper().getText(pdf);
            assertTrue(text.contains("Nguyễn Thế Hoàng"));assertTrue(text.contains("2026-10-03T12:00:00Z"));assertTrue(text.contains("FORM-79"));assertTrue(text.contains("TEST STAMP"));assertTrue(text.contains("TEST ONLY"));
            for(int page=1;page<=pdf.getNumberOfPages();page++){var stripper=new PDFTextStripper();stripper.setStartPage(page);stripper.setEndPage(page);assertTrue(stripper.getText(pdf).contains("Báo cáo tài liệu"),"Header missing on page "+page);}}
    }
    @Test void xlsxPreservesDataAsStringsAndHasInformationSheet() throws Exception {
        byte[] bytes=ReportPresentationRenderer.render("XLSX",List.of(List.of("Name"),List.of("=HYPERLINK(\"evil\")")),layout("{{report.title}}"),values());
        try(var book=new XSSFWorkbook(new ByteArrayInputStream(bytes))) {assertEquals(2,book.getNumberOfSheets());assertNotNull(book.getSheet("Report information"));
            assertEquals(org.apache.poi.ss.usermodel.CellType.STRING,book.getSheet("Report").getRow(1).getCell(0).getCellType());}
    }
    @Test void portraitAndWordRegionsPreserveAllRows() throws Exception {
        var old=layout("{{report.title}}");
        var portrait=new ReportLayout(false,old.coverTitle(),old.subtitle(),true,true,old.header(),old.footer(),true,false,"",false,"",null,null,null,null,"PORTRAIT",null);
        var rows=new ArrayList<List<String>>();rows.add(List.of("Number","Description"));for(int i=0;i<100;i++)rows.add(List.of("FORM-"+i,"Long record description "+i));
        byte[] header=ReportPdfRenderer.render(List.of(List.of("HEADER")),595,842);
        byte[] footer=ReportPdfRenderer.render(List.of(List.of("FOOTER")),595,842);
        byte[] bytes=ReportPresentationRenderer.render("PDF",rows,portrait,values(),List.of(),Map.of("header",header,"footer",footer));
        Files.write(Path.of("target/report-portrait-word-regions-test.pdf"),bytes);
        try(var pdf=Loader.loadPDF(bytes)) {
            String text=new PDFTextStripper().getText(pdf);assertTrue(text.contains("FORM-99"));assertTrue(pdf.getNumberOfPages()>1);
            for(var page:pdf.getPages()){assertEquals(595,page.getMediaBox().getWidth());assertEquals(842,page.getMediaBox().getHeight());}
            for(int n=1;n<=pdf.getNumberOfPages();n++){var strip=new PDFTextStripper();strip.setStartPage(n);strip.setEndPage(n);assertTrue(strip.getText(pdf).contains("HEADER"));assertTrue(strip.getText(pdf).contains("FOOTER"));}
        }
        assertEquals(842,old.pageWidth());assertEquals(595,old.pageHeight());
    }
}
