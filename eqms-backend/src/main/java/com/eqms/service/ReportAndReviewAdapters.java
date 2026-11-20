package com.eqms.service;

import com.eqms.entity.UserAccount;
import com.eqms.repository.WorkflowActionPolicyRelationRepository;
import com.eqms.service.authorization.PolicyBackedAdapter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * The adapters of the rest of Report (the schedule, the run, the legal hold of a file: V813) the campaigns of Access Review and of Audit Trail Review (V814) and the uncontrolled copy (V815). Each mirrors the checks of its service
 * (AUTHORIZATION_ACTION_CATALOG_REPORT_AS_IS_2026_11_18). The rules that mix a permission with ownership are computed here as relations, exactly as the service computes them.
 */
@Configuration
public class ReportAndReviewAdapters {

    @Bean
    PolicyBackedAdapter reportScheduleAdapter(JdbcTemplate jdbc, PermissionEvaluationService permissions, WorkflowActionPolicyService policies, WorkflowActionPolicyRelationRepository relations) {
        return new PolicyBackedAdapter(jdbc, policies, relations, "REPORT", "REPORT_SCHEDULE", "REPORT_SCHEDULE") {
            @Override protected String table() { return "report_schedules"; }

            /** Pause, resume, delete and change the owner apply from any state of the schedule. */
            @Override protected String policyState(String action, String state) { return state == null ? null : "ANY"; }

            @Override protected Facts facts(UserAccount actor, UUID id) {
                Map<String, Object> s = one(jdbc.queryForList("select creator_user_id from report_schedules where id = ?", id));
                if (s == null || actor == null || actor.getId() == null) return null;
                Set<String> relations = new HashSet<>();
                // as requireScheduleManagement: the manage or the export permission, and either the manage permission or being the creator
                boolean any = permissions.hasPermission(actor, "reports.schedule.manage") || permissions.hasPermission(actor, "report.module.export");
                boolean manageAll = permissions.hasPermission(actor, "reports.schedule.manage");
                if (any && (manageAll || actor.getId().toString().equals(String.valueOf(s.get("creator_user_id"))))) relations.add("MAY_MANAGE");
                return new Facts(null, relations);
            }
        };
    }

    @Bean
    PolicyBackedAdapter reportRunAdapter(JdbcTemplate jdbc, PermissionEvaluationService permissions, EffectivePermissionService effectivePermissions, WorkflowActionPolicyService policies, WorkflowActionPolicyRelationRepository relations) {
        return new PolicyBackedAdapter(jdbc, policies, relations, "REPORT", "REPORT_RUN", "REPORT_RUN") {
            @Override protected String table() { return "report_runs"; }

            @Override protected Facts facts(UserAccount actor, UUID id) {
                Map<String, Object> r = one(jdbc.queryForList("select requester_user_id from report_runs where id = ?", id));
                if (r == null || actor == null || actor.getId() == null) return null;
                Set<String> relations = new HashSet<>();
                // as retryRun: the create or the export permission, read from the permissions as they are now and not from the cache (a grant that was withdrawn must not authorize a retry:
                // ReportTemplatePermissionBoundaryTest), and either every run is visible to the person or they requested this one
                Set<String> now = effectivePermissions.getEffectivePermissionCodes(actor);
                boolean any = now.contains("reports.run.create") || now.contains("report.module.export");
                boolean all = permissions.hasPermission(actor, "reports.run.view_all");
                if (any && (all || actor.getId().toString().equals(String.valueOf(r.get("requester_user_id"))))) relations.add("MAY_RETRY");
                return new Facts(null, relations);
            }
        };
    }

    @Bean
    PolicyBackedAdapter reportArtifactAdapter(JdbcTemplate jdbc, PermissionEvaluationService permissions, WorkflowActionPolicyService policies, WorkflowActionPolicyRelationRepository relations) {
        return new PolicyBackedAdapter(jdbc, policies, relations, "REPORT", "REPORT_ARTIFACT", "REPORT_ARTIFACT") {
            @Override protected String table() { return "report_artifacts"; }

            /** A file is Held, Not Held, or Purged (gone); the service reads only files that are not purged. */
            @Override protected String stateSql() {
                return "select case when purged_at is not null then 'PURGED' when legal_hold then 'HELD' else 'NOT_HELD' end from report_artifacts where id = ?";
            }

            @Override protected Facts facts(UserAccount actor, UUID id) {
                if (actor == null || actor.getId() == null || one(jdbc.queryForList("select id from report_artifacts where id = ?", id)) == null) return null;
                Set<String> relations = new HashSet<>();
                if (permissions.hasPermission(actor, "reports.retention.manage") || permissions.hasPermission(actor, "reports.definition.manage")) relations.add("HOLD_RIGHT");
                return new Facts(null, relations);
            }
        };
    }

    @Bean
    PolicyBackedAdapter uncontrolledCopyAdapter(JdbcTemplate jdbc, WorkflowActionPolicyService policies, WorkflowActionPolicyRelationRepository relations) {
        return new PolicyBackedAdapter(jdbc, policies, relations, "DOCUMENT_CONTROL", "UNCONTROLLED_COPY", "UNCONTROLLED_COPY") {
            @Override protected String table() { return "uncontrolled_copies"; }

            @Override protected String stateSql() { return "select status_code from uncontrolled_copies where id = ?"; }

            @Override protected Facts facts(UserAccount actor, UUID id) {
                if (actor == null || actor.getId() == null || one(jdbc.queryForList("select id from uncontrolled_copies where id = ?", id)) == null) return null;
                return new Facts(null, new HashSet<>());
            }
        };
    }

    @Bean
    PolicyBackedAdapter accessReviewCampaignAdapter(JdbcTemplate jdbc, WorkflowActionPolicyService policies, WorkflowActionPolicyRelationRepository relations) {
        return campaign(jdbc, policies, relations, "ACCESS_REVIEW_CAMPAIGN", "access_review_campaigns", "access_review_items", "ITEM_SUBJECT",
                "select user_id from access_review_items where id = ?");
    }

    @Bean
    PolicyBackedAdapter auditReviewCampaignAdapter(JdbcTemplate jdbc, WorkflowActionPolicyService policies, WorkflowActionPolicyRelationRepository relations) {
        return campaign(jdbc, policies, relations, "AUDIT_REVIEW_CAMPAIGN", "audit_trail_review_campaigns", "audit_trail_review_items", "ENTRY_PERFORMER",
                "select l.user_id from audit_trail_review_items i join audit_logs l on l.id = i.audit_log_id where i.id = ?");
    }

    /**
     * A campaign has no department: the manage permission decides, in the state In Progress. Since V820 the adapter also knows two relations a policy may FORBID (off until an administrator switches
     * them on): the person who created the campaign (CAMPAIGN_CREATOR, for Complete) and the person an item is about (ITEM_SUBJECT: the account under review; ENTRY_PERFORMER: the person who made the
     * audit entry under review), for Decide Item. The id given to the adapter is the id of the campaign, or the id of one of its items (a decision is asked of the engine on the item, so that the item can
     * be related to the person); the state is always the state of the campaign.
     */
    private static PolicyBackedAdapter campaign(JdbcTemplate jdbc, WorkflowActionPolicyService policies, WorkflowActionPolicyRelationRepository relations, String type, String table, String itemTable,
                                                String itemRelation, String itemPersonSql) {
        return new PolicyBackedAdapter(jdbc, policies, relations, "SECURITY_REVIEW", type, type) {
            @Override protected String table() { return table; }

            @Override public String resolveState(UUID id) {
                java.util.List<String> state = jdbc.queryForList("select status from " + table + " where id = ?", String.class, id);
                if (state.isEmpty()) state = jdbc.queryForList("select c.status from " + itemTable + " i join " + table + " c on c.id = i.campaign_id where i.id = ?", String.class, id);
                return state.isEmpty() ? null : state.getFirst();
            }

            @Override protected Facts facts(UserAccount actor, UUID id) {
                if (actor == null || actor.getId() == null || id == null) return null;
                boolean isItem = false;
                java.util.List<Map<String, Object>> campaign = jdbc.queryForList("select created_by from " + table + " where id = ?", id);
                if (campaign.isEmpty()) {
                    campaign = jdbc.queryForList("select c.created_by from " + itemTable + " i join " + table + " c on c.id = i.campaign_id where i.id = ?", id);
                    isItem = true;
                }
                if (campaign.isEmpty()) return null;
                Set<String> held = new HashSet<>();
                if (actor.getId().equals(campaign.getFirst().get("created_by"))) held.add("CAMPAIGN_CREATOR");
                if (isItem && jdbc.queryForList(itemPersonSql, id).stream().anyMatch(row -> actor.getId().equals(row.values().iterator().next()))) held.add(itemRelation);
                return new Facts(null, held);
            }
        };
    }
}
