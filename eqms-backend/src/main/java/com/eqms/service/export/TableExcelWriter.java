package com.eqms.service.export;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.function.Consumer;
import java.time.*;
import java.time.format.*;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.streaming.SXSSFWorkbook;
import com.eqms.util.DateTimeFormatUtils;

/**
 * Bounded-memory register file, XLSX (default) or CSV. User text never becomes an executable formula.
 * The person may choose which columns the file holds; the first "No." column is always written.
 */
public final class TableExcelWriter implements AutoCloseable {
    /** The file kinds the export can make. */
    public enum Format { XLSX, CSV }

    /** Thrown once the headers are known when the writer was only asked for the column names; no row is read. */
    public static final class HeadersCaptured extends RuntimeException {
        public HeadersCaptured() { super(null, null, false, false); }
    }

    private final Format format;
    private final Set<String> selected; // null = every column
    private final Consumer<List<String>> headerProbe;
    private final SXSSFWorkbook workbook;
    private final Sheet sheet;
    private final CellStyle heading;
    private final CellStyle dateTime;
    private final Path csvFile;
    private final Writer csv;
    private boolean[] dateColumns;
    private boolean[] keep;
    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern(DateTimeFormatUtils.DATETIME_PATTERN_STRICT).withResolverStyle(ResolverStyle.STRICT);
    private static final DateTimeFormatter DATE = new DateTimeFormatterBuilder()
            .append(DateTimeFormatter.ofPattern(DateTimeFormatUtils.DATE_PATTERN))
            .parseDefaulting(java.time.temporal.ChronoField.ERA,1).toFormatter().withResolverStyle(ResolverStyle.STRICT);
    private static final DateTimeFormatter CSV_DATE_TIME = DateTimeFormatter.ofPattern(DateTimeFormatUtils.DATETIME_PATTERN);
    private long records;
    private int columns;

    public TableExcelWriter() { this(Format.XLSX, null, null); }

    public TableExcelWriter(Format format, Set<String> selectedColumns) { this(format, selectedColumns, null); }

    /** @param headerProbe when not null, receives every column name and then stops the export with {@link HeadersCaptured} */
    public TableExcelWriter(Format format, Set<String> selectedColumns, Consumer<List<String>> headerProbe) {
        this.format = format == null ? Format.XLSX : format;
        this.selected = selectedColumns;
        this.headerProbe = headerProbe;
        if (this.format == Format.XLSX) {
            workbook = new SXSSFWorkbook(100);
            sheet = workbook.createSheet("Records");
            workbook.setCompressTempFiles(true);
            heading = workbook.createCellStyle();
            Font font = workbook.createFont();
            font.setBold(true);
            heading.setFont(font);
            heading.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            heading.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            dateTime = workbook.createCellStyle();
            dateTime.setDataFormat(workbook.createDataFormat().getFormat("dd/mm/yyyy hh:mm"));
            csvFile = null;
            csv = null;
        } else {
            workbook = null; sheet = null; heading = null; dateTime = null;
            try {
                csvFile = Files.createTempFile("eqms-table-csv-", ".csv");
                csv = new BufferedWriter(new OutputStreamWriter(Files.newOutputStream(csvFile), StandardCharsets.UTF_8));
                csv.write('﻿'); // lets Excel read Vietnamese text as UTF-8
            } catch (IOException ex) { throw new UncheckedIOException(ex); }
        }
    }

    public Format format() { return format; }

    public void headers(String... labels) {
        if (columns != 0) throw new IllegalStateException("Headers already written");
        if (headerProbe != null) {
            headerProbe.accept(List.of(labels));
            throw new HeadersCaptured();
        }
        keep = new boolean[labels.length];
        int kept = 0;
        if (selected != null) {
            Set<String> known = new HashSet<>(Arrays.asList(labels));
            for (String name : selected) if (!known.contains(name)) throw new IllegalArgumentException("Unknown export column: " + name);
        }
        for (int i = 0; i < labels.length; i++) { keep[i] = selected == null || selected.contains(labels[i]); if (keep[i]) kept++; }
        if (kept == 0) throw new IllegalArgumentException("Select at least one column to export");
        columns = kept + 1;
        dateColumns = new boolean[labels.length];
        for (int i=0;i<labels.length;i++) dateColumns[i] = labels[i].toLowerCase(Locale.ROOT)
                .matches(".*(created|updated|modified|effective date|valid until|expiry date|recall date|requested at|distributed at|timestamp|last login|read at|suspended until|termination date).*");
        if (format == Format.CSV) {
            List<String> line = new ArrayList<>();
            line.add("No.");
            for (int i = 0; i < labels.length; i++) if (keep[i]) line.add(labels[i]);
            csvLine(line);
            return;
        }
        Row row = sheet.createRow(0);
        row.createCell(0).setCellValue("No.");
        int c = 1;
        for (int i = 0; i < labels.length; i++) if (keep[i]) row.createCell(c++).setCellValue(labels[i]);
        for (Cell cell : row) cell.setCellStyle(heading);
        row.setHeightInPoints(24);
        sheet.setColumnWidth(0, 10 * 256);
        for (int i = 1; i < columns; i++) sheet.setColumnWidth(i, 28 * 256);
        sheet.createFreezePane(0, 1);
    }

    public void row(Object... values) {
        if (values.length != keep.length) throw new IllegalArgumentException("Export column count mismatch");
        // Fail explicitly instead of silently truncating at Excel's sheet limit.
        if (records >= 1_048_575) throw new IllegalArgumentException("Export exceeds Excel's worksheet row limit; narrow the filters");
        ++records;
        if (format == Format.CSV) { csvRow(values); return; }
        Row row = sheet.createRow((int) records);
        row.createCell(0).setCellValue(records);
        int c = 1;
        for (int i = 0; i < values.length; i++) {
            if (!keep[i]) continue;
            String text = values[i] == null ? "" : String.valueOf(values[i]);
            if (text.length() > 32767) throw new IllegalArgumentException("An export cell exceeds Excel's text limit");
            Cell cell = row.createCell(c++, CellType.STRING);
            if (values[i] instanceof Number number) cell.setCellValue(number.doubleValue());
            else if (values[i] instanceof Boolean bool) cell.setCellValue(bool);
            else {
                LocalDateTime date = dateColumns[i] ? dateValue(text) : null;
                if (date != null) { cell.setCellValue(date); cell.setCellStyle(dateTime); }
                else cell.setCellValue(text);
            }
        }
    }

    private void csvRow(Object[] values) {
        List<String> line = new ArrayList<>();
        line.add(String.valueOf(records));
        for (int i = 0; i < values.length; i++) {
            if (!keep[i]) continue;
            Object v = values[i];
            String text = v == null ? "" : String.valueOf(v);
            if (v instanceof Number || v instanceof Boolean) { line.add(text); continue; }
            LocalDateTime date = dateColumns[i] ? dateValue(text) : null;
            if (date != null) text = CSV_DATE_TIME.format(date);
            else if (text.length() > 1 && "=+-@\t\r".indexOf(text.charAt(0)) >= 0) text = "'" + text; // a spreadsheet must never run user text as a formula
            line.add(text);
        }
        csvLine(line);
    }

    private void csvLine(List<String> cells) {
        try {
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < cells.size(); i++) {
                if (i > 0) sb.append(',');
                String cell = cells.get(i);
                if (cell.indexOf(',') >= 0 || cell.indexOf('"') >= 0 || cell.indexOf('\n') >= 0 || cell.indexOf('\r') >= 0) {
                    sb.append('"').append(cell.replace("\"", "\"\"")).append('"');
                } else sb.append(cell);
            }
            sb.append("\r\n");
            csv.write(sb.toString());
        } catch (IOException ex) { throw new UncheckedIOException(ex); }
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
        if (format == Format.CSV) {
            csv.flush();
            Files.copy(csvFile, output);
            return;
        }
        sheet.setAutoFilter(new CellRangeAddress(0, (int)records, 0, columns - 1));
        workbook.write(output);
    }

    @Override public void close() throws IOException {
        if (format == Format.CSV) {
            try { csv.close(); } finally { Files.deleteIfExists(csvFile); }
            return;
        }
        // Flush un-written rows too (e.g. a denied/failed query); POI close owns disposal.
        try {
            for (Sheet item : workbook) ((org.apache.poi.xssf.streaming.SXSSFSheet)item).flushRows();
        } finally { workbook.close(); }
    }
}
