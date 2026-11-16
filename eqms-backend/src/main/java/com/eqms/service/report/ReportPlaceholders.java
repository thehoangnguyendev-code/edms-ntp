package com.eqms.service.report;

import java.util.*;

/**
 * The automatic fields that a text of a report can hold ({{report.title}} and the rest), with a name and what the server fills in: the list Report Appearance shows
 * (REPORT-APPEARANCE-2026-11-14). The codes are the ones {@link ReportLayout#TOKENS} accepts, and a test keeps the two lists equal. Search, sort and paging are done here.
 */
public final class ReportPlaceholders {
    private ReportPlaceholders() {}
    public static final int MAX_PAGE_SIZE = 10;

    public record Item(String code, String name, String example) {
        public String placeholder() { return "{{" + code + "}}"; }
    }

    public static final List<Item> ALL = List.of(
            new Item("report.title", "Report name", "Document Status Report"),
            new Item("report.code", "Template number", "RPT.0001"),
            new Item("template.version", "Template revision", "2"),
            new Item("template.name", "Template name", "EQMS - Document status register"),
            new Item("report.runId", "Run number", "Number of the run (for example RUN-000123), to trace a printout to its record"),
            new Item("report.executor", "Prepared by", "Name of the user generating the report"),
            new Item("report.generatedAt", "Generation time", "Server date and time (dd/MM/yyyy HH:mm:ss, UTC+7)"),
            new Item("report.asOfAt", "Data snapshot time", "Server date and time (dd/MM/yyyy HH:mm:ss, UTC+7)"),
            new Item("page.number", "Page number", "Current PDF page. Use text settings, not uploaded Word."),
            new Item("page.total", "Total pages", "Total PDF pages. Use text settings, not uploaded Word."),
            new Item("report.filters", "Filters used", "The filters the report was run with, for example status = ACTIVE; department = QC"),
            new Item("report.rowCount", "Number of rows", "How many rows the report has"),
            new Item("template.approvedBy", "Template approved by", "Name of the person who approved the template revision"),
            new Item("template.approvedAt", "Template approval time", "dd/MM/yyyy HH:mm:ss, UTC+7"),
            new Item("report.executorDepartment", "Preparer's department", "Department of the person who ran the report"),
            new Item("report.executorPosition", "Preparer's position", "Position of the person who ran the report"),
            new Item("company.name", "Company name", "As entered under Page, in this appearance"),
            new Item("report.gmpNotice", "GMP status statement", "Whether the template is confirmed for GMP decisions"),
            new Item("report.signedBy", "Signed by", "Who signed the run (empty when the run was not signed)"),
            new Item("report.signedAt", "Signed on", "When the run was signed (empty when not signed)"),
            new Item("report.signatureId", "Signature number", "Number of the electronic signature (empty when not signed)"));

    /** One page of the list: the items that match the search in name, code or example, sorted by name, code or example (the order of the list when none). */
    public static Map<String, Object> page(String search, String sort, String direction, int page, int limit) {
        String text = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        var found = new ArrayList<>(ALL.stream().filter(item -> text.isEmpty()
                || item.name().toLowerCase(Locale.ROOT).contains(text) || item.code().toLowerCase(Locale.ROOT).contains(text) || item.example().toLowerCase(Locale.ROOT).contains(text)).toList());
        Comparator<Item> order = switch (sort == null ? "" : sort) {
            case "name" -> Comparator.comparing(item -> item.name().toLowerCase(Locale.ROOT));
            case "code" -> Comparator.comparing(item -> item.code().toLowerCase(Locale.ROOT));
            case "example" -> Comparator.comparing(item -> item.example().toLowerCase(Locale.ROOT));
            default -> null;
        };
        if (order != null) found.sort("desc".equalsIgnoreCase(direction) ? order.reversed() : order);
        int size = Math.min(Math.max(limit, 1), MAX_PAGE_SIZE);
        int total = found.size(), totalPages = Math.max(1, (int) Math.ceil(total / (double) size));
        int current = Math.min(Math.max(page, 1), totalPages);
        var data = found.subList(Math.min((current - 1) * size, total), Math.min(current * size, total));
        var pagination = new LinkedHashMap<String, Object>();
        pagination.put("page", current); pagination.put("limit", size); pagination.put("total", total); pagination.put("totalPages", totalPages);
        var result = new LinkedHashMap<String, Object>();
        result.put("data", data.stream().map(item -> Map.of("code", item.code(), "name", item.name(), "example", item.example(), "placeholder", item.placeholder())).toList());
        result.put("pagination", pagination);
        return result;
    }
}
