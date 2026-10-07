package com.eqms.service.report;

import com.eqms.entity.UserAccount;
import java.util.List;
import java.util.Map;

/** A module supplies allowlisted metadata only. Never includes source files or signed content. */
public interface ReportMetadataProvider {
    String code();
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
