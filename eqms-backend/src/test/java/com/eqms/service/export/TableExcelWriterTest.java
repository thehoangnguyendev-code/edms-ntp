package com.eqms.service.export;

import org.junit.jupiter.api.Test;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.apache.poi.ss.usermodel.CellType;
import java.io.*;
import static org.assertj.core.api.Assertions.*;

class TableExcelWriterTest {
    @Test void writesEveryRowBeyondTheStreamingWindowWithFilterFreezeAndSafeText() throws Exception {
        ByteArrayOutputStream output=new ByteArrayOutputStream();
        try(var writer=new TableExcelWriter()) {
            writer.headers("Code","Title","Count");
            for(int i=0;i<1001;i++) writer.row("0007", "=HYPERLINK(\"https://example.com\")",i);
            assertThat(writer.recordCount()).isEqualTo(1001);
            writer.write(output);
        }
        try(var book=new XSSFWorkbook(new ByteArrayInputStream(output.toByteArray()))) {
            var sheet=book.getSheetAt(0);
            assertThat(sheet.getLastRowNum()).isEqualTo(1001);
            assertThat(sheet.getCTWorksheet().getAutoFilter().getRef()).isEqualTo("A1:D1002");
            assertThat(sheet.getPaneInformation().isFreezePane()).isTrue();
            assertThat(sheet.getRow(1001).getCell(1).getStringCellValue()).isEqualTo("0007");
            assertThat(sheet.getRow(1).getCell(2).getCellType()).isEqualTo(CellType.STRING);
            assertThat(sheet.getRow(1001).getCell(3).getNumericCellValue()).isEqualTo(1000);
        }
    }

    @Test void preservesMultilineUnicodeAndQuotesWithoutChangingTheCellValues() throws Exception {
        var output=new ByteArrayOutputStream();
        try(var writer=new TableExcelWriter()) {
            writer.headers("Code","Title");
            writer.row("0007","Tiếng Việt, \"quoted\"\nsecond line");
            writer.write(output);
        }
        try(var book=new XSSFWorkbook(new ByteArrayInputStream(output.toByteArray()))) {
            assertThat(book.getSheetAt(0).getRow(1).getCell(2).getStringCellValue()).isEqualTo("Tiếng Việt, \"quoted\"\nsecond line");
            assertThat(book.getSheetAt(0).getLastRowNum()).isEqualTo(1);
        }
    }

    @Test void emptyResultsStillHaveHeadersAndAnExcelFilter() throws Exception {
        var output=new ByteArrayOutputStream();
        try(var writer=new TableExcelWriter()) { writer.headers("Document"); writer.write(output); }
        try(var book=new XSSFWorkbook(new ByteArrayInputStream(output.toByteArray()))) {
            assertThat(book.getSheetAt(0).getLastRowNum()).isZero();
            assertThat(book.getSheetAt(0).getCTWorksheet().getAutoFilter().getRef()).isEqualTo("A1:B1");
        }
    }

    @Test void dateColumnsAreRealExcelDatesForChronologicalSortingWhileCodesStayText() throws Exception {
        var output=new ByteArrayOutputStream();
        try(var writer=new TableExcelWriter()) {
            writer.headers("Created At","Code","Termination Date");
            writer.row("2026-11-14T04:19:00Z","0007","31/02/2026");
            writer.write(output);
        }
        try(var book=new XSSFWorkbook(new ByteArrayInputStream(output.toByteArray()))) {
            var row=book.getSheetAt(0).getRow(1);
            assertThat(row.getCell(1).getCellType()).isEqualTo(CellType.NUMERIC);
            assertThat(row.getCell(1).getLocalDateTimeCellValue()).isEqualTo(java.time.LocalDateTime.of(2026,11,14,11,19));
            assertThat(row.getCell(2).getStringCellValue()).isEqualTo("0007");
            assertThat(row.getCell(3).getStringCellValue()).isEqualTo("31/02/2026");
        }
    }

    @Test void refusesMalformedRowsAndOversizedCellsInsteadOfSilentlyTruncating() throws Exception {
        try(var writer=new TableExcelWriter()) {
            writer.headers("Title");
            assertThatThrownBy(()->writer.row("one","two")).isInstanceOf(IllegalArgumentException.class);
            assertThatThrownBy(()->writer.row("x".repeat(32768))).isInstanceOf(IllegalArgumentException.class);
        }

    }
}
