package com.eqms.service.report;

import com.eqms.entity.UserAccount;
import org.springframework.stereotype.Component;
import java.time.LocalDate;
import java.util.*;

@Component
public class DocumentReportMetadataProvider implements ReportMetadataProvider {
    private static final Map<String, String> COLUMNS = Map.of(
            "documentNumber", "d.document_number", "documentName", "d.document_name",
            "status", "s.label", "department", "dep.name", "businessUnit", "bu.name",
            "effectiveDate", "d.effective_date", "createdAt", "d.created_at", "documentType", "dt.name");
    private static final Map<String, String> LABELS = Map.of(
            "documentNumber", "Document Number", "documentName", "Document Name", "status", "Status",
            "department", "Department", "businessUnit", "Business Unit", "effectiveDate", "Effective Date",
            "createdAt", "Created", "documentType", "Document Type");

    public String code() { return "DOCUMENT_STATUS"; }
    public String name() { return "Document Register"; }
    public Map<String, String> columns() { return COLUMNS; }
    public Map<String, String> labels() { return LABELS; }
    public String identityColumn() { return "d.id"; }
    public String defaultSort() { return "documentNumber"; }
    public List<String> requiredFields() { return List.of("documentNumber", "documentName"); }
    public List<Map<String,String>> filters() { return List.of(
            Map.of("code", "search", "name", "Search documents", "type", "TEXT"),
            Map.of("code", "status", "name", "Status", "type", "LOOKUP"),
            Map.of("code", "department", "name", "Department", "type", "LOOKUP"),
            Map.of("code", "businessUnit", "name", "Business Unit", "type", "LOOKUP"),
            Map.of("code", "documentType", "name", "Document Type", "type", "LOOKUP"),
            Map.of("code", "createdFrom", "name", "Created from", "type", "DATE"),
            Map.of("code", "createdTo", "name", "Created to", "type", "DATE"),
            Map.of("code", "effectiveFrom", "name", "Effective from", "type", "DATE"),
            Map.of("code", "effectiveTo", "name", "Effective to", "type", "DATE")); }
    public Map<String,String> lookupColumns() { return Map.of("status", "d.status_code", "department", "dep.id", "businessUnit", "bu.id", "documentType", "dt.id"); }
    public Map<String,String> filterColumns() { return Map.of("status","status","department","department","businessUnit","businessUnit","documentType","documentType","createdFrom","createdAt","createdTo","createdAt","effectiveFrom","effectiveDate","effectiveTo","effectiveDate"); }

    public Query query(UserAccount actor, List<String> scopes, Map<String, Object> filters) {
        Set<String> permittedFilters = Set.of("search", "status", "department", "businessUnit", "documentType", "createdFrom", "createdTo", "effectiveFrom", "effectiveTo");
        if (!permittedFilters.containsAll(filters.keySet())) throw new IllegalArgumentException("REPORT_FILTER_NOT_ALLOWED");
        if (filters.values().stream().anyMatch(value->value!=null&&!(value instanceof String))) throw new IllegalArgumentException("REPORT_FILTER_NOT_ALLOWED");
        List<Object> args = new ArrayList<>();
        List<String> grants = new ArrayList<>();
        for (String scope : scopes) {
            switch (scope) {
                case "SYSTEM" -> grants.add("true");
                case "BUSINESS_UNIT" -> {
                    if (actor.getBusinessUnit() != null && !actor.getBusinessUnit().isBlank()) {
                        grants.add("bu.name=?"); args.add(actor.getBusinessUnit());
                    }
                }
                case "DEPARTMENT" -> {
                    if (actor.getDepartment() != null && !actor.getDepartment().isBlank()) {
                        grants.add("dep.name=?"); args.add(actor.getDepartment());
                    }
                }
                case "PERSONAL" -> {
                    grants.add("""
                        (d.author_user_id=? or exists(select 1 from document_workflow_participants p where p.document_id=d.id and p.user_id=?)
                        or exists(select 1 from revision_workflow_participants p join document_revisions rev on rev.id=p.revision_id where rev.document_id=d.id and p.user_id=?))
                        """);
                    args.add(actor.getId()); args.add(actor.getId()); args.add(actor.getId());
                }
                default -> throw new SecurityException("REPORT_SCOPE_DENIED");
            }
        }
        if (grants.isEmpty()) throw new SecurityException("REPORT_SCOPE_DENIED");
        StringBuilder sql = new StringBuilder("""
                from documents d join document_statuses s on s.code=d.status_code
                join departments dep on dep.id=d.department_id join business_units bu on bu.id=d.business_unit_id
                join document_types dt on dt.id=d.document_type_id where (
                """).append(String.join(" or ", grants)).append(")");
        String search = text(filters.get("search"));
        if (search.length() > 200) throw new IllegalArgumentException("REPORT_SEARCH_TOO_LONG");
        if (!search.isBlank()) {
            sql.append(" and (d.document_number ilike ? escape '\\' or d.document_name ilike ? escape '\\')");
            String term = "%" + search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
            args.add(term); args.add(term);
        }
        for (String field : List.of("status", "department", "businessUnit", "documentType")) {
            String value = text(filters.get(field));
            if (value.length()>100) throw new IllegalArgumentException("REPORT_FILTER_NOT_ALLOWED");
            if (!value.isBlank()) {
                String column = switch (field) { case "status" -> "d.status_code"; case "department" -> "dep.id"; case "businessUnit" -> "bu.id"; default -> "dt.id"; };
                sql.append(" and cast(").append(column).append(" as text)=?"); args.add(value);
            }
        }
        dates(sql, args, filters, "created", "d.created_at::date");
        dates(sql, args, filters, "effective", "d.effective_date");
        return new Query(sql.toString(), args);
    }

    private void dates(StringBuilder sql, List<Object> args, Map<String, Object> filters, String prefix, String column) {
        LocalDate from = date(filters.get(prefix + "From"));
        LocalDate to = date(filters.get(prefix + "To"));
        if (from != null && to != null && to.isBefore(from)) throw new IllegalArgumentException("REPORT_DATE_RANGE_INVALID");
        if (from != null && to != null && java.time.temporal.ChronoUnit.DAYS.between(from,to)>366) throw new IllegalArgumentException("REPORT_DATE_RANGE_TOO_LARGE");
        if (from != null) { sql.append(" and ").append(column).append(">=?"); args.add(java.sql.Date.valueOf(from)); }
        if (to != null) { sql.append(" and ").append(column).append("<=?"); args.add(java.sql.Date.valueOf(to)); }
    }
    private LocalDate date(Object value) {
        String text = text(value);
        try { return text.isBlank() ? null : LocalDate.parse(text); }
        catch (RuntimeException invalid) { throw new IllegalArgumentException("REPORT_DATE_RANGE_INVALID"); }
    }
    private String text(Object value) { return value == null ? "" : String.valueOf(value).trim(); }
}
