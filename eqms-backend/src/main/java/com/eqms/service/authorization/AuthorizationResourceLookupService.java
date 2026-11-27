package com.eqms.service.authorization;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Finds the records of a resource type by what a person knows about them (number, name), for the Simulator of Workflow Authorization, which asked for a pasted id. The statements are fixed here, per type;
 * the only thing taken from the caller is the search text, as a parameter. Each row is its id, a label that never shows an id alone, and the state the engine reads.
 */
@Service
public class AuthorizationResourceLookupService {
    /** type -> {from, label, state}. */
    private static final Map<String, String[]> TYPES = new LinkedHashMap<>();

    static {
        TYPES.put("DOCUMENT", new String[] {"documents", "document_number || ' - ' || coalesce(document_name, '')", "status_code"});
        TYPES.put("REVISION", new String[] {"document_revisions", "document_number || ' rev ' || revision_number || ' - ' || coalesce(document_name, '')", "status_code"});
        TYPES.put("CONTROLLED_COPY", new String[] {"controlled_copies", "controlled_copy_number || ' - ' || coalesce(document_number, '')", "status_code"});
        TYPES.put("CONTROLLED_COPY_BATCH", new String[] {"controlled_copy_distribution_batches", "batch_number || ' - ' || coalesce(document_number, '')", "status_code"});
        TYPES.put("UNCONTROLLED_COPY", new String[] {"uncontrolled_copies", "uncontrolled_copy_number || ' - ' || coalesce(document_number, '')", "status_code"});
        TYPES.put("TRAINING_REQUIREMENT", new String[] {"training_requirements", "request_no", "status"});
        TYPES.put("TRAINING_MATRIX_VERSION", new String[] {"training_matrix_versions", "'Matrix version ' || version_no || ' (' || to_char(created_at, 'DD/MM/YYYY') || ')'", "status"});
        TYPES.put("TRAINING_ACTIVITY", new String[] {"training_activities", "training_number", "status"});
        TYPES.put("TRAINING_PARTICIPANT", new String[] {"training_participants", "coalesce(full_name, external_name, 'Participant') || ' (' || to_char(created_at, 'DD/MM/YYYY') || ')'", "state"});
        TYPES.put("TRAINING_ASSESSMENT", new String[] {"training_assessment_defs", "code || ' - ' || coalesce(name, '')", "status"});
        TYPES.put("TRAINING_JOB_ASSIGNMENT", new String[] {"training_job_assignments", "'Job assignment ' || issue_no", "status"});
        TYPES.put("TRAINING_PERSONNEL_REVIEW", new String[] {"training_personnel_reviews", "'Personnel review ' || review_no", "status"});
        TYPES.put("TRAINING_RECORD_EXPORT", new String[] {"training_record_exports", "'Record export of ' || to_char(created_at, 'DD/MM/YYYY HH24:MI')", "status"});
        TYPES.put("TRAINING_RECORD_EXPORT_BATCH", new String[] {"training_record_export_batches", "'Export batch of ' || to_char(created_at, 'DD/MM/YYYY HH24:MI')", "status"});
        TYPES.put("TRAINING_TRAINER_EXCEPTION", new String[] {"training_trainer_exceptions", "'Trainer exception of ' || to_char(created_at, 'DD/MM/YYYY HH24:MI')", "status"});
        TYPES.put("TRAINING_SUSPENSION", new String[] {"training_work_suspensions", "'Suspension raised ' || to_char(raised_at, 'DD/MM/YYYY HH24:MI')", "status"});
        TYPES.put("TRAINING_VENDOR", new String[] {"training_approved_providers", "name", "status"});
        TYPES.put("TRAINING_RECORD", new String[] {"training_records", "record_no || ' - ' || coalesce(full_name, '')", "'ACTIVE'"});
        TYPES.put("REPORT_SCHEDULE", new String[] {"report_schedules", "schedule_number || ' - ' || coalesce(name, '')", "status"});
        TYPES.put("REPORT_RUN", new String[] {"report_runs", "run_number || ' - ' || coalesce(definition_code, '')", "status"});
        TYPES.put("REPORT_ARTIFACT", new String[] {"report_artifacts", "coalesce(generated_filename, 'File')", "case when purged_at is not null then 'PURGED' when legal_hold then 'HELD' else 'NOT_HELD' end"});
        TYPES.put("ACCESS_REVIEW_CAMPAIGN", new String[] {"access_review_campaigns", "campaign_number || ' - ' || coalesce(name, '')", "status"});
        TYPES.put("AUDIT_REVIEW_CAMPAIGN", new String[] {"audit_trail_review_campaigns", "campaign_number || ' - ' || coalesce(name, '')", "status"});
    }

    private final JdbcTemplate jdbc;

    public AuthorizationResourceLookupService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record Found(String id, String label, String state) {}

    /** A type this service can search (a Report template is named by its code in the Simulator and is not searched here). */
    public static boolean supports(String resourceType) {
        return resourceType != null && TYPES.containsKey(resourceType);
    }

    @Transactional(readOnly = true)
    public List<Found> find(String resourceType, String search, int limit) {
        String[] t = resourceType == null ? null : TYPES.get(resourceType);
        if (t == null) return List.of();
        int capped = Math.max(1, Math.min(limit, 50));
        String text = search == null ? "" : search.trim();
        String sql = "select id::text, (" + t[1] + ") as label, (" + t[2] + ") as state from " + t[0]
                + (text.isEmpty() ? "" : " where eqms_fold(" + t[1] + ") like eqms_fold(?)") + " order by 2 desc limit " + capped;
        return text.isEmpty()
                ? jdbc.query(sql, (rs, n) -> new Found(rs.getString(1), rs.getString(2), rs.getString(3)))
                : jdbc.query(sql, (rs, n) -> new Found(rs.getString(1), rs.getString(2), rs.getString(3)), "%" + text.replace("%", "\\%").replace("_", "\\_") + "%");
    }
}
