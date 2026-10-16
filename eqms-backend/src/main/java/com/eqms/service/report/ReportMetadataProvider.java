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
