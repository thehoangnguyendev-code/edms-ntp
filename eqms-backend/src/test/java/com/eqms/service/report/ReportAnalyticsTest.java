package com.eqms.service.report;

import org.junit.jupiter.api.Test;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import java.io.*;
import java.util.*;
import java.awt.image.BufferedImage;
import javax.imageio.ImageIO;
import static org.junit.jupiter.api.Assertions.*;

class ReportAnalyticsTest {
    ReportLayout.Chart chart(String type,String field,String metric){return new ReportLayout.Chart("Status analysis",type,field,metric);}
    @Test void aggregatesAllRowsNotOnlyTheFirstPage() {
        var rows=new ArrayList<List<String>>();rows.add(List.of("Status"));
        for(int i=0;i<23;i++)rows.add(List.of(i<20?"Active":"Draft"));
        var result=ReportCharts.calculate(List.of(chart("BAR","status","COUNT")),List.of("status"),rows).getFirst();
        assertEquals(23,result.total());assertEquals(20,result.points().getFirst().count());assertEquals(3,result.points().getLast().count());
        var percent=ReportCharts.calculate(List.of(chart("PIE","status","PERCENT")),List.of("status"),rows).getFirst();
        assertEquals(86.96,percent.points().getFirst().value());
    }
    @Test void trendUsesOrderedCalendarMonthsAndBlankHasExplicitCategory() {
        var result=ReportCharts.calculate(List.of(chart("LINE","createdAt","COUNT")),List.of("createdAt"),List.of(List.of("Created"),List.of("2026-12-01"),List.of("2026-10-05T10:00:00Z"),List.of("2026-10-03"))).getFirst();
        assertEquals("2026-10",result.points().getFirst().label());assertEquals(2,result.points().getFirst().count());
        assertEquals("Unspecified",ReportCharts.calculate(List.of(chart("BAR","status","COUNT")),List.of("status"),List.of(List.of("Status"),List.of(""))).getFirst().points().getFirst().label());
        assertTrue(ReportCharts.calculate(List.of(chart("PIE","status","PERCENT")),List.of("status"),List.of(List.of("Status"))).getFirst().points().isEmpty());
    }
    @Test void rejectsHiddenFieldsAndInvalidDatesAndNeverDropsRecords() {
        assertThrows(IllegalArgumentException.class,()->ReportCharts.calculate(List.of(chart("BAR","secret","COUNT")),List.of("status"),List.of(List.of("Status"))));
        assertThrows(IllegalArgumentException.class,()->ReportCharts.calculate(List.of(chart("LINE","status","COUNT")),List.of("status"),List.of(List.of("Status"),List.of("Active"))));
        var rows=new ArrayList<List<String>>();rows.add(List.of("Status"));for(int i=0;i<21;i++)rows.add(List.of("Category "+i));
        // More groups than a chart shows are added together in the open, as one "Other" bar; no record is dropped and the report does not fail.
        var grouped=ReportCharts.calculate(List.of(chart("BAR","status","COUNT")),List.of("status"),rows).getFirst();
        org.junit.jupiter.api.Assertions.assertEquals(20,grouped.points().size());
        org.junit.jupiter.api.Assertions.assertEquals("Other (2 groups)",grouped.points().getLast().label());
        org.junit.jupiter.api.Assertions.assertEquals(21L,grouped.points().stream().mapToLong(ReportCharts.Point::count).sum());
        // A monthly trend of more than 20 months is still refused.
        var months=new ArrayList<List<String>>();months.add(List.of("Date"));for(int i=0;i<21;i++)months.add(List.of(java.time.LocalDate.of(2024,1,1).plusMonths(i).toString()));
        assertThrows(IllegalArgumentException.class,()->ReportCharts.calculate(List.of(chart("LINE","date","COUNT")),List.of("date"),months));
    }
    String logo() throws Exception {
        var image=new BufferedImage(30,15,BufferedImage.TYPE_INT_RGB);var g=image.createGraphics();g.setColor(java.awt.Color.GREEN);g.fillRect(0,0,30,15);g.dispose();
        var bytes=new ByteArrayOutputStream();ImageIO.write(image,"png",bytes);return "data:image/png;base64,"+Base64.getEncoder().encodeToString(bytes.toByteArray());
    }
    @Test void boundedRasterOnlyAndSafeCoordinates() throws Exception {
        assertEquals(30,ReportImage.decode(logo()).getWidth());
        for(String invalid:List.of("https://evil/logo.png","data:image/svg+xml;base64,PHN2Zz4=","data:image/png;base64,YmFk","x".repeat(1400001)))assertThrows(IllegalArgumentException.class,()->ReportImage.decode(invalid));
        assertThrows(IllegalArgumentException.class,()->new ReportLayout.Mark("#059669",90,12,0,Double.NaN,5,20,"ALL","NOTO_SANS","ABOVE").validated());
        assertThrows(IllegalArgumentException.class,()->new ReportLayout.Logo(true,logo(),90,5,20,"ALL").validated());
    }
    @Test void pdfAndSpreadsheetContainServerCalculatedAnalysis() throws Exception {
        var rows=List.of(List.of("Status"),List.of("Active"),List.of("Draft"),List.of("Active"));var charts=List.of(chart("BAR","status","COUNT"),chart("PIE","status","PERCENT"));
        var layout=new ReportLayout(true,"{{report.title}}","TEST",true,true,"{{report.title}}","TEST",true,true,"TEST ONLY",true,"TEST STAMP",null,null,new ReportLayout.Logo(true,logo(),5,8,10,"FIRST"),charts).validated();
        var calculated=ReportCharts.calculate(charts,List.of("status"),rows);var context=Map.of("report.title","TEST Analytics","report.executor","TEST Admin","report.generatedAt","2026-10-03");
        byte[] bytes=ReportPresentationRenderer.render("PDF",rows,layout,context,calculated);
        java.nio.file.Files.write(java.nio.file.Path.of("target/report-analytics-test.pdf"),bytes);
        try(var pdf=Loader.loadPDF(bytes)){assertEquals(4,pdf.getNumberOfPages());assertTrue(new PDFTextStripper().getText(pdf).contains("TEST Analytics"));assertTrue(pdf.getPage(1).getResources().getXObjectNames().iterator().hasNext());}
        try(var book=new XSSFWorkbook(new ByteArrayInputStream(ReportPresentationRenderer.render("XLSX",rows,layout,context,calculated)))){
            assertEquals(4,book.getNumberOfSheets());var sheet=book.getSheet("Analysis 1");assertEquals("Active",sheet.getRow(2).getCell(0).getStringCellValue());assertEquals(2,sheet.getRow(2).getCell(1).getNumericCellValue());
        }
    }
    @Test void reportTitlesAreBoundedPlainText() {
        assertEquals("Template",ReportTemplateService.validatedTitle(null,"Template"));assertEquals("My report",ReportTemplateService.validatedTitle(" My report ","Template"));
        for(String invalid:List.of(" ","x".repeat(256),"bad\nname"))assertThrows(IllegalArgumentException.class,()->ReportTemplateService.validatedTitle(invalid,"Template"));
    }
}
