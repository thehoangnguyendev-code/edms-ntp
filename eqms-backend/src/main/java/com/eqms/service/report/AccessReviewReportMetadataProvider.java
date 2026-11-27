package com.eqms.service.report;

import com.eqms.entity.UserAccount;
import org.springframework.stereotype.Component;
import java.util.*;

/**
 * Report Type "Access Review Items" (REPORT-SECURITY-SOURCES-2026-11-12): what each periodic access review campaign recorded for each user: the user, the access profiles and the number of
 * permissions at the time, and the decision with who took it and when. A person needs security.access_review.view and the template is given to the whole system scope only. Never a
 * column: the free-text note of a decision and the description of a campaign.
 */
@Component
public class AccessReviewReportMetadataProvider implements ReportMetadataProvider {
    private static final Map<String, String> COLUMNS = new LinkedHashMap<>();
    private static final Map<String, String> LABELS = new LinkedHashMap<>();
    private static final Map<String, String> GROUPS = new LinkedHashMap<>();
    static {
        column("campaign", "Campaign", "c.name");
        column("periodStart", "Review Period Start", "c.review_period_start");
        column("periodEnd", "Review Period End", "c.review_period_end");
        column("campaignStatus", "Campaign Status", "initcap(replace(c.status, '_', ' '))");
        column("employeeCode", "Employee Code", "i.employee_code");
        column("fullName", "User", "i.full_name");
        column("username", "Username", "i.username");
        column("userStatus", "User Status", "i.user_status");
        column("accessProfiles", "Access Profiles", "i.access_profiles");
        column("permissionCount", "Permissions", "i.permission_count");
        column("superAdmin", "Super Administrator", "case when i.is_super_admin then 'Yes' else 'No' end");
        column("decision", "Decision", "initcap(replace(i.decision, '_', ' '))");
        column("decidedBy", "Decided By", "db.full_name");
        column("decidedAt", "Decided At", ReportQueryKit.timestamp("i.decided_at"));
        // REPORT-FIELD-CATALOG-2026-11-15: more of the metadata the source holds.
        group("Decision", "decisionNote", "Decision Note", "i.decision_note");
        group("Campaign", "reviewer", "Campaign Reviewer", ReportQueryKit.person("c.reviewer_id"));
        group("Campaign", "campaignSignedAt", "Campaign Signed At", ReportQueryKit.timestamp("c.signed_at"));
        group("Campaign", "campaignCreatedAt", "Campaign Created At", ReportQueryKit.timestamp("c.created_at"));
    }
    private static void column(String code, String label, String sql) { COLUMNS.put(code, sql); LABELS.put(code, label); }
    private static void group(String group, String code, String label, String sql) { column(code, label, sql); GROUPS.put(code, group); }
    @Override public Map<String, String> fieldGroups() { return GROUPS; }

    private static final Set<String> FILTERS = Set.of("search", "campaign", "decision", "campaignStatus", "decidedFrom", "decidedTo");

    public String code() { return "ACCESS_REVIEW_ITEMS"; }
    public String name() { return "Access Review Items"; }
    public String category() { return "Security"; }
    public String description() { return "What each access review campaign recorded for each user: access profiles, permissions and the decision."; }
    public List<String> usePermissions() { return List.of("security.access_review.view"); }
    public List<String> allowedScopes() { return List.of("SYSTEM"); }
    public Map<String, String> columns() { return COLUMNS; }
    @Override public Set<String> dateColumns() { return new LinkedHashSet<>(List.of("periodStart", "periodEnd", "decidedAt", "campaignSignedAt", "campaignCreatedAt")); }
    public Map<String, String> labels() { return LABELS; }
    public String identityColumn() { return "i.id"; }
    public String defaultSort() { return "campaign"; }
    public List<String> requiredFields() { return List.of("campaign", "fullName", "decision"); }
    public List<Map<String, String>> filters() {
        return List.of(
                Map.of("code", "search", "name", "Search access review items", "type", "TEXT"),
                Map.of("code", "campaign", "name", "Campaign", "type", "LOOKUP"),
                Map.of("code", "decision", "name", "Decision", "type", "LOOKUP"),
                Map.of("code", "campaignStatus", "name", "Campaign Status", "type", "LOOKUP"),
                Map.of("code", "decidedFrom", "name", "Decided from", "type", "DATE"),
                Map.of("code", "decidedTo", "name", "Decided to", "type", "DATE"));
    }
    public Map<String, String> lookupColumns() { return Map.of("campaign", "c.id", "decision", "i.decision", "campaignStatus", "c.status"); }
    public Map<String, String> filterColumns() { return Map.of("campaign", "campaign", "decision", "decision", "campaignStatus", "campaignStatus", "decidedFrom", "decidedAt", "decidedTo", "decidedAt"); }

    public Query query(UserAccount actor, List<String> scopes, Map<String, Object> filters) {
        ReportQueryKit.checkFilters(filters, FILTERS);
        ReportQueryKit.requireSystemScope(scopes);
        List<Object> args = new ArrayList<>();
        StringBuilder sql = new StringBuilder("from access_review_items i join access_review_campaigns c on c.id=i.campaign_id left join app_users db on db.id=i.decided_by where true");
        String search = ReportQueryKit.text(filters.get("search"));
        if (!search.isBlank()) {
            sql.append(" and (eqms_fold(c.name) like eqms_fold(?) escape '\\' or eqms_fold(coalesce(i.full_name,'')) like eqms_fold(?) escape '\\' or eqms_fold(coalesce(i.username,'')) like eqms_fold(?) escape '\\' or eqms_fold(coalesce(i.employee_code,'')) like eqms_fold(?) escape '\\')");
            String term = ReportQueryKit.likeTerm(search);
            for (int i = 0; i < 4; i++) args.add(term);
        }
        Map<String, String> equals = new LinkedHashMap<>();
        equals.put("campaign", "c.id"); equals.put("decision", "i.decision"); equals.put("campaignStatus", "c.status");
        ReportQueryKit.equalsFilters(sql, args, filters, equals);
        ReportQueryKit.dates(sql, args, filters, "decided", "i.decided_at::date");
        return new Query(sql.toString(), args);
    }
}
