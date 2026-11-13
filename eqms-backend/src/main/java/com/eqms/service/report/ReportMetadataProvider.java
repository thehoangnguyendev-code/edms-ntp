package com.eqms.service.report;

import com.eqms.entity.UserAccount;
import java.util.List;
import java.util.Map;

/** A module supplies allowlisted metadata only. Never includes source files or signed content. */
public interface ReportMetadataProvider {
    String code();
    /** The group a Report Type is listed under (Documents, Audit, Backup and Restore ...). */
    default String category() { return "Documents"; }
    /** What the Report Type reports on, in a sentence. */
    default String description() { return ""; }
    /**
     * Permissions of which a person must hold at least one to use this type, besides the scope of the template. Empty when the type applies the scopes
     * of the template to its own data (as the Document register does).
     */
    default List<String> usePermissions() { return List.of(); }
    /** Permissions a person must hold all of to use this type (for example the Audit Trail needs both audit.view and audit.export). */
    default List<String> requiredPermissions() { return List.of(); }
    /** The data scopes a template of this type may give to an Access Profile; the Audit Trail, for example, has no scope smaller than the whole system. */
    default List<String> allowedScopes() { return List.of("PERSONAL", "DEPARTMENT", "BUSINESS_UNIT", "SYSTEM"); }
    /** Checks what a run must give, besides what query() accepts: for example a date range. Not applied where only the authorization query is built. */
    default void validateRun(java.util.Map<String, Object> filters) {}
    /**
     * The filters that narrow a run. A run needs at least one of them to have a value, unless it is run with the Full choice
     * (REPORT-FULL-RUN-2026-11-12). By default every filter of the type narrows.
     */
    default List<String> narrowingFilters() { return filters().stream().map(filter -> filter.get("code")).toList(); }
    /**
     * The columns that hold a date or a moment, in a form that starts with yyyy-MM-dd: a report may group by them (a monthly trend) and the Report Types screen shows them as dates.
     * By default the columns that a date filter works on.
     */
    default java.util.Set<String> dateColumns() {
        java.util.Set<String> dates = new java.util.LinkedHashSet<>();
        for (Map<String, String> filter : filters()) {
            String column = filterColumns().get(filter.get("code"));
            if ("DATE".equals(filter.get("type")) && column != null && columns().containsKey(column)) dates.add(column);
        }
        return dates;
    }
    /**
     * A run of this type is signed electronically by the person who requests it, with a reason (REPORT-RUN-SIGNATURE-2026-11-12: the Audit Trail report). A type that needs it
     * cannot be scheduled, because nobody is there to sign a scheduled run.
     */
    default boolean runNeedsSignature() { return false; }
    String name();
    Map<String, String> columns();
    Map<String, String> labels();
    String identityColumn();
    String defaultSort();
    List<String> requiredFields();
    List<Map<String,String>> filters();
    Map<String,String> lookupColumns();
    Map<String,String> filterColumns();
    Query query(UserAccount actor, List<String> scopes, Map<String, Object> filters);
    record Query(String fromWhere, List<Object> arguments) {}
}
