package com.eqms.service.export;

import java.io.*;
import java.util.*;
import java.time.*;
import java.time.format.*;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.streaming.SXSSFWorkbook;
import com.eqms.util.DateTimeFormatUtils;

/** Bounded-memory XLSX register. User text never becomes an executable formula. */
public final class TableExcelWriter implements AutoCloseable {
    private final SXSSFWorkbook workbook = new SXSSFWorkbook(100);
    private final Sheet sheet = workbook.createSheet("Records");
    private final CellStyle heading;
    private final CellStyle dateTime;
    private boolean[] dateColumns;
    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern(DateTimeFormatUtils.DATETIME_PATTERN_STRICT).withResolverStyle(ResolverStyle.STRICT);
    private static final DateTimeFormatter DATE = new DateTimeFormatterBuilder()
            .append(DateTimeFormatter.ofPattern(DateTimeFormatUtils.DATE_PATTERN))
            .parseDefaulting(java.time.temporal.ChronoField.ERA,1).toFormatter().withResolverStyle(ResolverStyle.STRICT);
    private long records;
    private int columns;

    public TableExcelWriter() {
        workbook.setCompressTempFiles(true);
        heading = workbook.createCellStyle();
        Font font = workbook.createFont();
        font.setBold(true);
        heading.setFont(font);
        heading.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        heading.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        dateTime = workbook.createCellStyle();
        dateTime.setDataFormat(workbook.createDataFormat().getFormat("dd/mm/yyyy hh:mm"));
    }

    public void headers(String... labels) {
        if (columns != 0) throw new IllegalStateException("Headers already written");
        columns = labels.length + 1;
        dateColumns = new boolean[labels.length];
        for (int i=0;i<labels.length;i++) dateColumns[i] = labels[i].toLowerCase(Locale.ROOT)
                .matches(".*(created|updated|modified|effective date|valid until|expiry date|recall date|requested at|distributed at|timestamp|last login|read at|suspended until|termination date).*");
        Row row = sheet.createRow(0);
        row.createCell(0).setCellValue("No.");
        for (int i = 0; i < labels.length; i++) row.createCell(i + 1).setCellValue(labels[i]);
        for (Cell cell : row) cell.setCellStyle(heading);
        row.setHeightInPoints(24);
        sheet.setColumnWidth(0, 10 * 256);
        for (int i = 1; i < columns; i++) sheet.setColumnWidth(i, 28 * 256);
        sheet.createFreezePane(0, 1);
    }

    public void row(Object... values) {
        if (values.length != columns - 1) throw new IllegalArgumentException("Export column count mismatch");
        // Fail explicitly instead of silently truncating at Excel's sheet limit.
        if (records >= 1_048_575) throw new IllegalArgumentException("Export exceeds Excel's worksheet row limit; narrow the filters");
        Row row = sheet.createRow((int) ++records);
        row.createCell(0).setCellValue(records);
        for (int i = 0; i < values.length; i++) {
            String text = values[i] == null ? "" : String.valueOf(values[i]);
            if (text.length() > 32767) throw new IllegalArgumentException("An export cell exceeds Excel's text limit");
            Cell cell = row.createCell(i + 1, CellType.STRING);
            if (values[i] instanceof Number number) cell.setCellValue(number.doubleValue());
            else if (values[i] instanceof Boolean bool) cell.setCellValue(bool);
            else {
                LocalDateTime date = dateColumns[i] ? dateValue(text) : null;
                if (date != null) { cell.setCellValue(date); cell.setCellStyle(dateTime); }
                else cell.setCellValue(text);
            }
        }
    }

    private LocalDateTime dateValue(String value) {
        if (value.isBlank() || value.length()<10) return null;
        try { return Instant.parse(value).atZone(DateTimeFormatUtils.ZONE).toLocalDateTime(); } catch (DateTimeException ignored) { }
        try { return LocalDateTime.parse(value); } catch (DateTimeException ignored) { }
        try { return LocalDate.parse(value).atStartOfDay(); } catch (DateTimeException ignored) { }
        try { return LocalDateTime.parse(value.length()==16 ? value+":00" : value,DATE_TIME); } catch (DateTimeException ignored) { }
        try { return LocalDate.parse(value,DATE).atStartOfDay(); } catch (DateTimeException ignored) { }
        return null;
    }

    public long recordCount() { return records; }

    public void write(OutputStream output) throws IOException {
        if (columns == 0) throw new IllegalStateException("Export headers missing");
        sheet.setAutoFilter(new CellRangeAddress(0, (int)records, 0, columns - 1));
        workbook.write(output);
    }

    @Override public void close() throws IOException {
        // Flush un-written rows too (e.g. a denied/failed query); POI close owns disposal.
        try {
            for (Sheet item : workbook) ((org.apache.poi.xssf.streaming.SXSSFSheet)item).flushRows();
        } finally { workbook.close(); }
    }
}
