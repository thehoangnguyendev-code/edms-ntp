package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** Read-only personal tables. Identity always comes from the authenticated actor, never a query parameter. */
@Service
public class MyTrainingQueryService {
    private final JdbcTemplate jdbc;
    private final TrainingAccess access;

    public MyTrainingQueryService(JdbcTemplate jdbc, TrainingAccess access) {
        this.jdbc = jdbc;
        this.access = access;
    }

    private static final String TASKS = """
        select p.id as participant_id, a.id as activity_id, a.training_number, a.training_title, a.status, a.due_date,
               s.method, s.scheduled_on, p.state,
               (select string_agg(t.topic_text, '; ' order by t.topic_text) from training_session_topics t where t.session_id = s.id) as topics
          from training_participants p join training_activities a on a.id = p.activity_id join training_sessions s on s.id = p.session_id
         where p.person_user_id = ? and a.status in ('NOTIFIED','IN_PROGRESS') and p.state = 'INVITED' and s.status in ('PLANNED','HELD')
        """;
    private static final String RECORDS = """
        select r.id, r.record_no, r.person_user_id, r.full_name, r.employee_code, r.department, r.position, r.training_number, r.topic_text,
               r.document_number, r.document_revision, r.completed_on, r.method, r.result, r.source, r.activity_id,
               v.voided_at, v.reason as void_reason, vu.full_name as voided_by_name,
               case when v.id is null then 'VALID' else 'VOIDED' end as record_state
          from training_records r left join training_record_voids v on v.record_id = r.id left join app_users vu on vu.id = v.voided_by
         where r.person_user_id = ?
        """;
    private static final String APPROVALS = """
        select a.id::text, a.step_code, a.object_type, a.object_id,
               case a.object_type when 'TRAINING_ACTIVITY' then t.training_number when 'TRAINING_JOB_ASSIGNMENT' then 'JA #' || ja.issue_no
                 when 'TRAINING_SPECIMEN_SIGNATURE' then 'Specimen #' || sp.version_no when 'TRAINING_RECORD_EXPORT' then 'Export' when 'TRAINING_RECORD_EXPORT_BATCH' then 'Batch export'
                 when 'TRAINING_REQUIREMENT' then rq.request_no when 'TRAINING_LEGACY_EVIDENCE' then 'Legacy evidence'
                 when 'TRAINING_TRAINER_EXCEPTION' then 'Trainer exception' else m.code || ' v' || mv.version_no end as training_number,
               case a.object_type when 'TRAINING_ACTIVITY' then t.training_title when 'TRAINING_JOB_ASSIGNMENT' then 'Job assignment of ' || jau.full_name
                 when 'TRAINING_SPECIMEN_SIGNATURE' then 'Specimen signature of ' || spu.full_name
                 when 'TRAINING_RECORD_EXPORT' then 'Training record export of ' || exu.full_name
                 when 'TRAINING_RECORD_EXPORT_BATCH' then 'Batch export of training records, ' || bxd.name || ' ' || bx.year
                 when 'TRAINING_REQUIREMENT' then 'Training requirement ' || rq.request_no
                 when 'TRAINING_LEGACY_EVIDENCE' then 'Legacy training evidence of ' || lev.document_number
                 when 'TRAINING_TRAINER_EXCEPTION' then 'Trainer exception for ' || tea.training_number else 'Training matrix' end as training_title,
               case a.object_type when 'TRAINING_ACTIVITY' then t.status when 'TRAINING_JOB_ASSIGNMENT' then ja.status
                 when 'TRAINING_SPECIMEN_SIGNATURE' then sp.status when 'TRAINING_RECORD_EXPORT' then ex.status when 'TRAINING_RECORD_EXPORT_BATCH' then bx.status
                 when 'TRAINING_REQUIREMENT' then rq.status when 'TRAINING_LEGACY_EVIDENCE' then lev.status
                 when 'TRAINING_TRAINER_EXCEPTION' then te.status else mv.status end as status,
               a.assigned_at, coalesce(t.id, te.activity_id) as activity_id
          from training_approval_assignments a
          left join training_activities t on a.object_type = 'TRAINING_ACTIVITY' and t.id = a.object_id
          left join training_matrix_versions mv on a.object_type = 'TRAINING_MATRIX_VERSION' and mv.id = a.object_id
          left join training_matrices m on m.id = mv.matrix_id
          left join training_job_assignments ja on a.object_type = 'TRAINING_JOB_ASSIGNMENT' and ja.id = a.object_id
          left join app_users jau on jau.id = ja.person_user_id
          left join training_specimen_signatures sp on a.object_type = 'TRAINING_SPECIMEN_SIGNATURE' and sp.id = a.object_id
          left join app_users spu on spu.id = sp.person_user_id
          left join training_record_exports ex on a.object_type = 'TRAINING_RECORD_EXPORT' and ex.id = a.object_id
          left join app_users exu on exu.id = ex.person_user_id
          left join training_record_export_batches bx on a.object_type = 'TRAINING_RECORD_EXPORT_BATCH' and bx.id = a.object_id
          left join departments bxd on bxd.id = bx.department_id
          left join training_requirements rq on a.object_type = 'TRAINING_REQUIREMENT' and rq.id = a.object_id
          left join training_legacy_evidence lev on a.object_type = 'TRAINING_LEGACY_EVIDENCE' and lev.id = a.object_id
          left join training_trainer_exceptions te on a.object_type = 'TRAINING_TRAINER_EXCEPTION' and te.id = a.object_id
          left join training_activities tea on tea.id = te.activity_id
         where a.assignee_user_id = ? and a.status = 'PENDING'
        union all
        select 'job-' || j.id, 'RECEIVER_ACCEPT', 'TRAINING_JOB_ASSIGNMENT', j.id, 'JA #' || j.issue_no,
               'Job assignment: ' || pos.name, j.status, j.created_at, null::uuid
          from training_job_assignments j join positions pos on pos.id = j.position_id
         where j.person_user_id = ? and j.status = 'PENDING_RECEIVER'
        """;

    @Transactional(readOnly = true)
    public Map<String, Object> list(UserAccount actor, String kind, Map<String, String> params) {
        access.require(actor, "training.self.view");
        boolean tasks = "tasks".equals(kind), records = "records".equals(kind), approvals = "approvals".equals(kind);
        if (!tasks && !records && !approvals) throw new IllegalArgumentException("TRAINING_TABLE_NOT_ALLOWED");
        String source = tasks ? TASKS : records ? RECORDS : APPROVALS;
        List<Object> args = new ArrayList<>(List.of(actor.getId()));
        if (approvals) args.add(actor.getId());
        StringBuilder where = new StringBuilder(" where 1=1");
        String search = params.get("search");
        if (search != null && !search.isBlank()) {
            String[] columns = records ? new String[]{"training_number", "topic_text", "document_number"}
                    : tasks ? new String[]{"training_number", "training_title", "topics"} : new String[]{"training_number", "training_title"};
            where.append(" and (");
            for (int i = 0; i < columns.length; i++) {
                if (i > 0) where.append(" or ");
                where.append("lower(coalesce(q.").append(columns[i]).append(",'')) like ? escape '\\'");
                args.add("%" + search.trim().toLowerCase(java.util.Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%");
            }
            where.append(")");
        }
        String[] filters = records ? new String[]{"method", "result", "recordState"}
                : tasks ? new String[]{"method", "status"} : new String[]{"objectType", "stepCode", "status"};
        for (String filter : filters) {
            String value = params.get(filter);
            if (value == null || value.isBlank()) continue;
            String column = switch (filter) { case "objectType" -> "object_type"; case "stepCode" -> "step_code"; case "recordState" -> "record_state"; default -> filter; };
            where.append(" and q.").append(column).append(" = ?");
            args.add(value);
        }
        String dateColumn = records ? "completed_on" : tasks ? "scheduled_on" : "(assigned_at at time zone 'Asia/Ho_Chi_Minh')::date";
        LocalDate from = date(params.get("fromDate")), to = date(params.get("toDate"));
        if (from != null && to != null && from.isAfter(to)) throw new IllegalArgumentException("TRAINING_DATE_RANGE_INVALID");
        if (from != null) { where.append(" and ").append(dateColumn).append(" >= ?"); args.add(java.sql.Date.valueOf(from)); }
        if (to != null) { where.append(" and ").append(dateColumn).append(" <= ?"); args.add(java.sql.Date.valueOf(to)); }
        Map<String, String> sorts = records ? Map.of("trainingNumber", "training_number", "topicText", "topic_text", "documentNumber", "document_number", "completedOn", "completed_on", "result", "result", "recordState", "record_state")
                : tasks ? Map.of("trainingNumber", "training_number", "trainingTitle", "training_title", "topics", "topics", "method", "method", "scheduledOn", "scheduled_on", "dueDate", "due_date", "status", "status")
                : Map.of("trainingNumber", "training_number", "trainingTitle", "training_title", "stepCode", "step_code", "status", "status", "assignedAt", "assigned_at");
        String sort = sorts.get(params.getOrDefault("sortBy", records ? "completedOn" : tasks ? "dueDate" : "assignedAt"));
        if (sort == null) throw new IllegalArgumentException("TRAINING_SORT_NOT_ALLOWED");
        String direction = params.getOrDefault("sortDirection", "asc");
        if (!"asc".equals(direction) && !"desc".equals(direction)) throw new IllegalArgumentException("TRAINING_SORT_NOT_ALLOWED");
        int limit = Math.clamp(Integer.parseInt(params.getOrDefault("limit", "10")), 1, 100);
        int requestedPage = Math.max(1, Integer.parseInt(params.getOrDefault("page", "1")));
        String query = " from (" + source + ") q" + where;
        Long count = jdbc.queryForObject("select count(*)" + query, Long.class, args.toArray());
        long total = count == null ? 0 : count;
        long pages = Math.max(1, (total + limit - 1) / limit);
        int page = (int) Math.min(requestedPage, pages);
        args.add(limit); args.add((long) (page - 1) * limit);
        String tieBreaker = tasks ? "participant_id" : "id";
        List<Map<String, Object>> rows = jdbc.queryForList("select q.*" + query + " order by q." + sort + " " + direction + " nulls last, q." + tieBreaker + " asc limit ? offset ?", args.toArray());
        return Map.of("data", TrainingRows.camel(rows), "pagination", Map.of("page", page, "limit", limit, "total", total, "totalPages", pages));
    }

    private static LocalDate date(String value) { return value == null || value.isBlank() ? null : LocalDate.parse(value); }
}
