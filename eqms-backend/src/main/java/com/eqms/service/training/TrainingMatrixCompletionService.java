package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.sql.Date;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * How far each person of a position is through the effective matrix of the department (PLAN-TR-001 17.11, SOP.0003 5.1, 5.3.8, 5.3.11). The columns are the rows of the
 * matrix that apply to the position; the rows are the people who hold the position. The state of every cell is **calculated here** from the personal training records
 * that are not voided, the open activities and the effective revision of the document: nothing is typed, and the screen only shows it.
 *
 * <pre>
 * NOT_REQUIRED  the effective revision of the SOP was marked as not needing training
 * IN_PROGRESS   the person is on an open activity of the topic and has not been trained yet, or must be trained again
 * QUALIFIED     a valid record exists for the effective revision and the annual training is not due
 * UPDATE_NEEDED the only records are for an older revision of the SOP and the effective revision needs training
 * DUE           the annual training of the row is due again (one year after the last record)
 * REQUIRED      no valid record
 * </pre>
 */
@Service
public class TrainingMatrixCompletionService {
    /** A larger matrix or position is refused instead of cut, so the screen never shows an incomplete picture as a complete one. */
    private static final int MAX_PEOPLE = 300;
    private static final int MAX_ROWS = 200;
    private static final Set<String> STATES = Set.of("NOT_REQUIRED", "IN_PROGRESS", "QUALIFIED", "UPDATE_NEEDED", "DUE", "REQUIRED");
    private static final Set<String> GAPS = Set.of("REQUIRED", "UPDATE_NEEDED", "DUE");
    /** States that keep a person on the list of those still to be trained on a row; the list of a row is cut here and says how many more there are. */
    private static final Set<String> OPEN_STATES = Set.of("REQUIRED", "UPDATE_NEEDED", "DUE", "IN_PROGRESS");
    static final int MAX_NAMED_PER_ROW = 30;

    private final JdbcTemplate jdbc;
    private final TrainingAccess access;

    public TrainingMatrixCompletionService(JdbcTemplate jdbc, TrainingAccess access) {
        this.jdbc = jdbc;
        this.access = access;
    }

    private UUID department(UserAccount actor, UUID departmentId) {
        access.require(actor, "training.compliance.view");
        UUID department = departmentId != null ? departmentId : access.departmentOf(actor);
        if (department == null) throw new IllegalArgumentException("TRAINING_DEPARTMENT_REQUIRED");
        access.requireScope(actor, department);
        return department;
    }

    /** The positions that have at least one row in the effective matrix of the department. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> positions(UserAccount actor, UUID departmentId) {
        UUID department = department(actor, departmentId);
        return TrainingRows.camel(jdbc.queryForList("""
            select p.id, p.code, p.name, count(distinct r.id) as row_count,
                   (select count(*) from training_person_positions tp join app_users u on u.id = tp.person_user_id where tp.position_id = p.id and tp.valid_to is null and u.status = 'Active') as people_count
              from training_matrices m join training_matrix_versions v on v.matrix_id = m.id and v.status = 'EFFECTIVE'
              join training_matrix_rows r on r.version_id = v.id join training_matrix_cells c on c.row_id = r.id join training_job_roles p on p.id = c.position_id
             where m.department_id = ? group by p.id, p.code, p.name order by p.name
            """, department));
    }

    @Transactional(readOnly = true)
    public Map<String, Object> completion(UserAccount actor, UUID departmentId, UUID positionId, String search, String status, boolean gapsOnly, int page, int limit, int columnPage, int columnLimit) {
        UUID department = department(actor, departmentId);
        if (positionId == null) throw new IllegalArgumentException("TRAINING_POSITION_REQUIRED");
        if (status != null && !status.isBlank() && !STATES.contains(status)) throw new IllegalArgumentException("TRAINING_STATUS_INVALID");
        int safeLimit = Math.min(Math.max(limit, 1), 100), safePage = Math.max(page, 1);
        int safeColumnLimit = Math.min(Math.max(columnLimit, 1), MAX_ROWS), safeColumnPage = Math.max(columnPage, 1);

        Map<String, Object> out = new LinkedHashMap<>();
        Map<String, Object> version = jdbc.queryForList("""
            select v.id, v.version_no from training_matrix_versions v join training_matrices m on m.id = v.matrix_id where m.department_id = ? and v.status = 'EFFECTIVE'
            """, department).stream().findFirst().orElse(null);
        out.put("hasEffectiveMatrix", version != null);
        if (version == null) return empty(out, safePage, safeLimit, safeColumnPage, safeColumnLimit);
        out.put("matrixVersionNo", version.get("version_no"));

        List<Map<String, Object>> rows = jdbc.queryForList("""
            select r.id as row_id, r.row_no, r.row_group, r.annual_required, coalesce(t.code, d.document_number) as code, coalesce(t.name, d.document_name) as title,
                   t.name as tname, d.document_number as dnum, d.id as doc_id,
                   (select dr.revision_number from document_revisions dr where dr.document_id = d.id and dr.status_code = 'EFFECTIVE' order by dr.effective_date desc nulls last limit 1) as eff_rev,
                   (select dr.requires_training from document_revisions dr where dr.document_id = d.id and dr.status_code = 'EFFECTIVE' order by dr.effective_date desc nulls last limit 1) as eff_requires
              from training_matrix_rows r join training_matrix_cells c on c.row_id = r.id and c.position_id = ?
              left join training_topics t on t.id = r.topic_id left join documents d on d.id = r.document_id
             where r.version_id = ?
             order by case r.row_group when 'FACTORY_GENERAL' then 0 when 'DEPARTMENT_GENERAL' then 1 else 2 end, r.row_no
            """, positionId, version.get("id"));
        if (rows.size() > MAX_ROWS) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "TRAINING_MATRIX_TOO_LARGE");

        List<Object> args = new ArrayList<>();
        args.add(positionId);
        String like = null;
        StringBuilder sql = new StringBuilder("""
            select u.id as pid, u.full_name, u.employee_code from training_person_positions tp join app_users u on u.id = tp.person_user_id
             where tp.position_id = ? and tp.valid_to is null and u.status = 'Active'
            """);
        if (search != null && !search.isBlank()) {
            like = "%" + search.trim().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
            sql.append(" and (lower(u.full_name) like ? escape '\\' or lower(coalesce(u.employee_code,'')) like ? escape '\\')");
            args.add(like); args.add(like);
        }
        sql.append(" order by u.full_name limit ").append(MAX_PEOPLE + 1);
        List<Map<String, Object>> people = jdbc.queryForList(sql.toString(), args.toArray());
        if (people.size() > MAX_PEOPLE) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "TRAINING_MATRIX_TOO_LARGE");

        // One set-based read of the facts for every person and row; the state is decided below, in one place.
        Map<String, Map<String, Object>> facts = new LinkedHashMap<>();
        if (!people.isEmpty() && !rows.isEmpty()) {
            List<UUID> pids = people.stream().map(p -> (UUID) p.get("pid")).toList();
            String peopleMarks = String.join(",", java.util.Collections.nCopies(pids.size(), "?"));
            List<UUID> rowIds = rows.stream().map(r -> (UUID) r.get("row_id")).toList();
            String rowMarks = String.join(",", java.util.Collections.nCopies(rowIds.size(), "?"));
            List<Object> factArgs = new ArrayList<>(pids);
            factArgs.addAll(rowIds);
            factArgs.add(version.get("id"));
            String factSql = """
                select pe.pid, ro.row_id, lr.last_done, lr.last_rev, oa.activity_id
                  from (select u.id as pid from app_users u where u.id in (%s)) pe
                  cross join (select r.id as row_id, t.name as tname, d.document_number as dnum from training_matrix_rows r
                               left join training_topics t on t.id = r.topic_id left join documents d on d.id = r.document_id
                               where r.id in (%s) and r.version_id = ?) ro
                  left join lateral (select rec.completed_on as last_done, rec.document_revision as last_rev from training_records rec left join training_record_voids v on v.record_id = rec.id
                                      where rec.person_user_id = pe.pid and v.id is null
                                        and ((ro.dnum is not null and rec.document_number = ro.dnum) or (ro.tname is not null and lower(rec.topic_text) = lower(ro.tname)))
                                      order by rec.completed_on desc limit 1) lr on true
                  left join lateral (select a.id as activity_id from training_participants p join training_activities a on a.id = p.activity_id
                                      join training_session_topics st on st.session_id = p.session_id
                                      where p.person_user_id = pe.pid and a.status in ('PLANNED','NOTIFIED','IN_PROGRESS','PENDING_QA_CONFIRMATION') and p.state <> 'ABSENT'
                                        and ((ro.dnum is not null and st.document_number = ro.dnum) or (ro.tname is not null and lower(st.topic_text) = lower(ro.tname)))
                                      limit 1) oa on true
                """.formatted(peopleMarks, rowMarks);
            for (Map<String, Object> f : jdbc.queryForList(factSql, factArgs.toArray())) {
                facts.put(f.get("pid") + "|" + f.get("row_id"), f);
            }
        }

        // People with a training review still open (new employee, return after absence, transfer): the grid says so next to the name.
        Map<UUID, List<String>> reviews = new java.util.HashMap<>();
        if (!people.isEmpty()) {
            List<UUID> ids = people.stream().map(p -> (UUID) p.get("pid")).toList();
            for (Map<String, Object> rv : jdbc.queryForList("select person_user_id, kind from training_personnel_reviews where status = 'OPEN' and person_user_id in (" + String.join(",", java.util.Collections.nCopies(ids.size(), "?")) + ")", ids.toArray())) {
                reviews.computeIfAbsent((UUID) rv.get("person_user_id"), k -> new ArrayList<>()).add(String.valueOf(rv.get("kind")));
            }
        }
        LocalDate today = LocalDate.now(TrainingNumberService.ZONE);
        List<Map<String, Object>> data = new ArrayList<>();
        // Totals over every person of the position who matches the search, before the state filter and the paging, so they are the whole picture of the position.
        Map<String, Map<String, Object>> rowSummary = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) rowSummary.put(String.valueOf(row.get("row_id")), newRowSummary());
        int peopleReady = 0, peopleWithGap = 0;
        for (Map<String, Object> person : people) {
            Map<String, Object> cells = new LinkedHashMap<>();
            int required = 0, done = 0;
            boolean hasStatus = status == null || status.isBlank();
            boolean hasGap = false;
            for (Map<String, Object> row : rows) {
                Map<String, Object> fact = facts.get(person.get("pid") + "|" + row.get("row_id"));
                LocalDate lastDone = fact == null || fact.get("last_done") == null ? null : ((Date) fact.get("last_done")).toLocalDate();
                String state = state(row, lastDone, fact == null ? null : (String) fact.get("last_rev"), fact != null && fact.get("activity_id") != null, today);
                countInRow(rowSummary.get(String.valueOf(row.get("row_id"))), person, state);
                if (!"NOT_REQUIRED".equals(state)) required++;
                if ("QUALIFIED".equals(state)) done++;
                if (GAPS.contains(state)) hasGap = true;
                if (!hasStatus && state.equals(status)) hasStatus = true;
                Map<String, Object> cell = new LinkedHashMap<>();
                cell.put("status", state);
                cell.put("lastDoneOn", lastDone == null ? null : lastDone.toString());
                cell.put("lastRevision", fact == null ? null : fact.get("last_rev"));
                cell.put("activityId", fact == null ? null : fact.get("activity_id"));
                cells.put(String.valueOf(row.get("row_id")), cell);
            }
            if (required > 0 && done == required) peopleReady++;
            if (hasGap) peopleWithGap++;
            if (!hasStatus || (gapsOnly && !hasGap)) continue;
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("personId", person.get("pid"));
            entry.put("fullName", person.get("full_name"));
            entry.put("employeeCode", person.get("employee_code"));
            entry.put("done", done);
            entry.put("required", required);
            // SOP.0003 5.3.8: the work assignment is made when the person has completed every item of the matrix of the position.
            entry.put("eligibleForAssignment", required > 0 && done == required);
            entry.put("openReviews", reviews.getOrDefault((UUID) person.get("pid"), List.of()));
            entry.put("cells", cells);
            data.add(entry);
        }

        int from = (safePage - 1) * safeLimit;
        out.put("data", data.subList(Math.min(from, data.size()), Math.min(from + safeLimit, data.size())));
        out.put("pagination", Map.of("page", safePage, "limit", safeLimit, "total", data.size(), "totalPages", Math.max(1, (data.size() + safeLimit - 1) / safeLimit)));
        int columnFrom = (safeColumnPage - 1) * safeColumnLimit;
        List<Map<String, Object>> columns = new ArrayList<>();
        for (Map<String, Object> row : rows.subList(Math.min(columnFrom, rows.size()), Math.min(columnFrom + safeColumnLimit, rows.size()))) {
            Map<String, Object> column = new LinkedHashMap<>();
            column.put("rowId", row.get("row_id"));
            column.put("group", row.get("row_group"));
            column.put("code", row.get("code"));
            column.put("title", row.get("title"));
            column.put("annual", row.get("annual_required"));
            column.put("currentRevision", row.get("eff_rev"));
            columns.add(column);
        }
        out.put("columns", columns);
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("people", people.size());
        summary.put("ready", peopleReady);
        summary.put("withGap", peopleWithGap);
        summary.put("rows", rowSummary);
        out.put("summary", summary);
        out.put("columnPagination", Map.of("page", safeColumnPage, "limit", safeColumnLimit, "total", rows.size(), "totalPages", Math.max(1, (rows.size() + safeColumnLimit - 1) / safeColumnLimit)));
        return out;
    }

    private static Map<String, Object> newRowSummary() {
        Map<String, Object> counts = new LinkedHashMap<>();
        for (String state : STATES) counts.put(state, 0);
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("counts", counts);
        summary.put("open", new ArrayList<Map<String, Object>>());
        summary.put("moreOpen", 0);
        return summary;
    }

    /** Counts the state of one person on one row and names the person when the row is still open for them (up to {@link #MAX_NAMED_PER_ROW}). */
    @SuppressWarnings("unchecked")
    static void countInRow(Map<String, Object> rowSummary, Map<String, Object> person, String state) {
        Map<String, Object> counts = (Map<String, Object>) rowSummary.get("counts");
        counts.put(state, ((Integer) counts.get(state)) + 1);
        if (!OPEN_STATES.contains(state)) return;
        List<Map<String, Object>> open = (List<Map<String, Object>>) rowSummary.get("open");
        if (open.size() >= MAX_NAMED_PER_ROW) {
            rowSummary.put("moreOpen", ((Integer) rowSummary.get("moreOpen")) + 1);
            return;
        }
        Map<String, Object> named = new LinkedHashMap<>();
        named.put("personId", person.get("pid"));
        named.put("fullName", person.get("full_name"));
        named.put("employeeCode", person.get("employee_code"));
        named.put("status", state);
        open.add(named);
    }

    /**
     * Everything behind one cell of the grid: the requirement, the state with the reason in words, the records of the person for it (voided ones marked) and the open trainings the person is on.
     * It uses the same rules as the grid, so the two never disagree.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> cellDetail(UserAccount actor, UUID departmentId, UUID personId, UUID rowId) {
        UUID department = department(actor, departmentId);
        if (personId == null || rowId == null) throw new IllegalArgumentException("TRAINING_POSITION_REQUIRED");
        Map<String, Object> row = jdbc.queryForList("""
            select r.id as row_id, r.row_group, r.annual_required, coalesce(t.code, d.document_number) as code, coalesce(t.name, d.document_name) as title, t.name as tname, d.document_number as dnum,
                   (select dr.revision_number from document_revisions dr where dr.document_id = d.id and dr.status_code = 'EFFECTIVE' order by dr.effective_date desc nulls last limit 1) as eff_rev,
                   (select dr.requires_training from document_revisions dr where dr.document_id = d.id and dr.status_code = 'EFFECTIVE' order by dr.effective_date desc nulls last limit 1) as eff_requires
              from training_matrix_rows r join training_matrix_versions v on v.id = r.version_id and v.status = 'EFFECTIVE' join training_matrices m on m.id = v.matrix_id and m.department_id = ?
              left join training_topics t on t.id = r.topic_id left join documents d on d.id = r.document_id
             where r.id = ? and exists (select 1 from training_matrix_cells c join training_person_positions tp on tp.position_id = c.position_id and tp.person_user_id = ? and tp.valid_to is null where c.row_id = r.id)
            """, department, rowId, personId).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        Map<String, Object> person = jdbc.queryForList("""
            select u.id, u.full_name, u.employee_code, u.department, (select string_agg(p.name, ', ') from training_person_positions tp join training_job_roles p on p.id = tp.position_id where tp.person_user_id = u.id and tp.valid_to is null) as positions
              from app_users u where u.id = ?
            """, personId).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        String match = "((?::text is not null and rec.document_number = ?) or (?::text is not null and lower(rec.topic_text) = lower(?)))";
        List<Map<String, Object>> records = TrainingRows.camel(jdbc.queryForList("""
            select rec.id, rec.record_no, rec.training_number, rec.activity_id, rec.completed_on, rec.document_revision, rec.method, rec.result, (v.id is not null) as voided, v.reason as void_reason
              from training_records rec left join training_record_voids v on v.record_id = rec.id
             where rec.person_user_id = ? and """ + match + " order by rec.completed_on desc, rec.record_no desc limit 20", personId, row.get("dnum"), row.get("dnum"), row.get("tname"), row.get("tname")));
        List<Map<String, Object>> open = TrainingRows.camel(jdbc.queryForList("""
            select distinct a.id, a.training_number, a.training_title, a.status, a.due_date, s.scheduled_on
              from training_participants p join training_activities a on a.id = p.activity_id join training_sessions s on s.id = p.session_id join training_session_topics st on st.session_id = s.id
             where p.person_user_id = ? and a.status in ('PLANNED','NOTIFIED','IN_PROGRESS','PENDING_QA_CONFIRMATION') and p.state <> 'ABSENT'
               and ((?::text is not null and st.document_number = ?) or (?::text is not null and lower(st.topic_text) = lower(?)))
             order by a.due_date nulls last limit 5
            """, personId, row.get("dnum"), row.get("dnum"), row.get("tname"), row.get("tname")));
        Map<String, Object> last = records.stream().filter(r -> !Boolean.TRUE.equals(r.get("voided"))).findFirst().orElse(null);
        LocalDate lastDone = last == null ? null : LocalDate.parse(String.valueOf(last.get("completedOn")).substring(0, 10));
        String lastRevision = last == null ? null : (String) last.get("documentRevision");
        LocalDate today = LocalDate.now(TrainingNumberService.ZONE);
        String state = state(row, lastDone, lastRevision, !open.isEmpty(), today);
        boolean annual = Boolean.TRUE.equals(row.get("annual_required"));
        String why = switch (state) {
            case "NOT_REQUIRED" -> "The revision of this SOP now in force was marked as not needing training.";
            case "IN_PROGRESS" -> "A training on this requirement is open and the person is on its list.";
            case "QUALIFIED" -> "Trained" + (lastRevision == null ? "" : " on revision " + lastRevision) + " on " + lastDone + (annual ? "; the annual training falls due on " + lastDone.plusYears(1) + "." : ".");
            case "UPDATE_NEEDED" -> "The last training was on revision " + lastRevision + ", but revision " + row.get("eff_rev") + " is in force and needs training.";
            case "DUE" -> "The annual training is due again: the last training was on " + lastDone + ", more than a year ago.";
            default -> "There is no valid training record of this person for this requirement.";
        };
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("person", TrainingRows.camel(person));
        Map<String, Object> req = new LinkedHashMap<>();
        req.put("code", row.get("code"));
        req.put("title", row.get("title"));
        req.put("group", row.get("row_group"));
        req.put("annual", annual);
        req.put("sop", row.get("dnum") != null);
        req.put("currentRevision", row.get("eff_rev"));
        out.put("requirement", req);
        out.put("state", state);
        out.put("reason", why);
        out.put("lastDoneOn", lastDone == null ? null : lastDone.toString());
        out.put("lastRevision", lastRevision);
        out.put("lastTrainingNumber", last == null ? null : last.get("trainingNumber"));
        out.put("lastActivityId", last == null ? null : last.get("activityId"));
        out.put("nextDueOn", annual && lastDone != null ? lastDone.plusYears(1).toString() : null);
        out.put("records", records);
        out.put("openTrainings", open);
        return out;
    }

    private static String state(Map<String, Object> row, LocalDate lastDone, String lastRevision, boolean openActivity, LocalDate today) {
        boolean sop = row.get("dnum") != null;
        Object effRequires = row.get("eff_requires");
        if (sop && row.get("eff_rev") != null && Boolean.FALSE.equals(effRequires)) return "NOT_REQUIRED";
        if (lastDone == null) return openActivity ? "IN_PROGRESS" : "REQUIRED";
        boolean olderRevision = sop && row.get("eff_rev") != null && Boolean.TRUE.equals(effRequires) && lastRevision != null && !lastRevision.equals(row.get("eff_rev"));
        if (olderRevision) return openActivity ? "IN_PROGRESS" : "UPDATE_NEEDED";
        boolean annualDue = Boolean.TRUE.equals(row.get("annual_required")) && lastDone.isBefore(today.minusYears(1));
        if (annualDue) return openActivity ? "IN_PROGRESS" : "DUE";
        return "QUALIFIED";
    }

    private static Map<String, Object> empty(Map<String, Object> out, int page, int limit, int columnPage, int columnLimit) {
        out.put("data", List.of());
        out.put("columns", List.of());
        out.put("summary", Map.of("people", 0, "ready", 0, "withGap", 0, "rows", Map.of()));
        out.put("pagination", Map.of("page", page, "limit", limit, "total", 0, "totalPages", 1));
        out.put("columnPagination", Map.of("page", columnPage, "limit", columnLimit, "total", 0, "totalPages", 1));
        return out;
    }
}
