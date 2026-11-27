package com.eqms.service.training;

import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.entity.UserAccount;
import com.eqms.service.AuditTrailService;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * The checklist template of the personnel training reviews (DEC-TRAINING-2026-11-27-01 B8): the items of a review that are not training lines of the matrix. The items the
 * SOP names are locked (they stay, and keep their check); the company adds others, answered by a person (MANUAL) or by a record the system knows. A change applies to the reviews
 * opened after it, and to an open review when it is refreshed; a closed review keeps what it was closed with.
 */
@Service
public class TrainingReviewTemplateService {
    private static final Set<String> KINDS = Set.of("NEW_HIRE", "ABSENCE_RETURN", "DEPT_TRANSFER", "LOCATION_TRANSFER");
    private static final Set<String> CHECKS = Set.of("MANUAL", "SPECIMEN", "JOB_ASSIGNMENT", "HANDOVER");

    public record Write(String kind, String title, String titleVi, String hint, String checkType, Boolean active, Integer sortOrder, Integer version, String reason) {}

    private final JdbcTemplate jdbc;
    private final TrainingAccess access;
    private final AuditTrailService audit;

    public TrainingReviewTemplateService(JdbcTemplate jdbc, TrainingAccess access, AuditTrailService audit) {
        this.jdbc = jdbc;
        this.access = access;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> list(UserAccount actor, String kind, String search, String sortBy, String sortDirection, int page, int limit) {
        access.require(actor, "training.admin.manage", "training.settings.view");
        List<Object> args = new ArrayList<>();
        StringBuilder where = new StringBuilder(" where 1=1");
        if (kind != null && !kind.isBlank()) {
            if (!KINDS.contains(kind)) throw new IllegalArgumentException("TRAINING_REVIEW_KIND_INVALID");
            where.append(" and t.kind = ?");
            args.add(kind);
        }
        if (search != null && !search.isBlank()) {
            String like = "%" + search.trim().toLowerCase(java.util.Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
            where.append(" and (eqms_fold(t.title) like eqms_fold(?) escape '\\' or eqms_fold(coalesce(t.title_vi,'')) like eqms_fold(?) escape '\\' or eqms_fold(coalesce(t.hint,'')) like eqms_fold(?) escape '\\')");
            args.add(like); args.add(like); args.add(like);
        }
        int safeLimit = Math.min(Math.max(limit, 1), 100), safePage = Math.max(page, 1);
        Long total = jdbc.queryForObject("select count(*) from training_review_templates t" + where, Long.class, args.toArray());
        args.add(safeLimit);
        args.add((safePage - 1) * safeLimit);
        List<Map<String, Object>> rows = TrainingRows.camel(jdbc.queryForList("select t.*, (select u.full_name from app_users u where u.id = t.updated_by) as updated_by_name from training_review_templates t" + where
                + TrainingRows.orderBy(sortBy, sortDirection, Map.of("kind", "t.kind", "title", "t.title", "checkType", "t.check_type", "sortOrder", "t.sort_order", "updatedAt", "t.updated_at"), "t.kind, t.sort_order, t.title")
                + " limit ? offset ?", args.toArray()));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("data", rows);
        long count = total == null ? 0 : total;
        result.put("pagination", Map.of("page", safePage, "limit", safeLimit, "total", count, "totalPages", Math.max(1, (count + safeLimit - 1) / safeLimit)));
        return result;
    }

    @Transactional
    public Map<String, Object> create(UserAccount actor, Write request) {
        access.require(actor, "training.admin.manage");
        if (request == null || request.kind() == null || !KINDS.contains(request.kind())) throw new IllegalArgumentException("TRAINING_REVIEW_KIND_INVALID");
        String title = text(request.title(), 500);
        if (title == null) throw new IllegalArgumentException("TRAINING_REVIEW_TEMPLATE_INVALID");
        String check = request.checkType() == null ? "MANUAL" : request.checkType();
        if (!CHECKS.contains(check)) throw new IllegalArgumentException("TRAINING_REVIEW_TEMPLATE_INVALID");
        // one record check of a kind is enough: a second line asking the same question could never differ
        if (!"MANUAL".equals(check) && jdbc.queryForObject("select count(*) from training_review_templates where kind = ? and check_type = ? and active", Integer.class, request.kind(), check) > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_REVIEW_TEMPLATE_DUPLICATE_CHECK");
        }
        UUID id = UUID.randomUUID();
        String code = "X" + id.toString().replace("-", "").substring(0, 12).toUpperCase(java.util.Locale.ROOT);
        jdbc.update("insert into training_review_templates(id, kind, item_code, title, title_vi, hint, check_type, locked, active, sort_order, updated_by) values (?,?,?,?,?,?,?,false,true,?,?)",
                id, request.kind(), code, title, text(request.titleVi(), 500), text(request.hint(), 1000), check, request.sortOrder() == null ? 100 : request.sortOrder(), actor.getId());
        audit.logAs(actor, "TRAINING_PERSONNEL_REVIEW", "Checklist template " + request.kind(), id, "TRAINING_REVIEW_TEMPLATE_ADDED", null, null, title,
                List.of(new AuditTrailChangeResponse("Checklist Item Added", null, title), new AuditTrailChangeResponse("Review Type", null, TrainingStore.words(request.kind())), new AuditTrailChangeResponse("Check", null, TrainingStore.words(check))));
        return one(id);
    }

    @Transactional
    public Map<String, Object> update(UserAccount actor, UUID id, Write request) {
        access.require(actor, "training.admin.manage");
        Map<String, Object> current = jdbc.queryForList("select * from training_review_templates where id = ? for update", id).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        if (request == null || request.version() == null || request.version().intValue() != ((Number) current.get("version")).intValue()) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_REVIEW_TEMPLATE_VERSION_CHANGED");
        String title = text(request.title(), 500);
        if (title == null) throw new IllegalArgumentException("TRAINING_REVIEW_TEMPLATE_INVALID");
        boolean locked = Boolean.TRUE.equals(current.get("locked"));
        boolean active = request.active() == null ? Boolean.TRUE.equals(current.get("active")) : request.active();
        // an item the SOP names stays: it can be worded better but not switched off or given another check
        if (locked && !active) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_REVIEW_TEMPLATE_LOCKED");
        String check = request.checkType() == null ? (String) current.get("check_type") : request.checkType();
        if (!CHECKS.contains(check)) throw new IllegalArgumentException("TRAINING_REVIEW_TEMPLATE_INVALID");
        if (locked && !check.equals(current.get("check_type"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_REVIEW_TEMPLATE_LOCKED");
        if (request.reason() == null || request.reason().isBlank()) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
        int sort = request.sortOrder() == null ? ((Number) current.get("sort_order")).intValue() : request.sortOrder();
        List<AuditTrailChangeResponse> changes = new ArrayList<>();
        change(changes, "Title", current.get("title"), title);
        change(changes, "Title (Vietnamese)", current.get("title_vi"), text(request.titleVi(), 500));
        change(changes, "Hint", current.get("hint"), text(request.hint(), 1000));
        change(changes, "Check", current.get("check_type"), check);
        change(changes, "Active", current.get("active"), active);
        change(changes, "Order", current.get("sort_order"), sort);
        if (changes.isEmpty()) return one(id);
        changes.add(new AuditTrailChangeResponse("Reason", null, request.reason().trim()));
        jdbc.update("update training_review_templates set title = ?, title_vi = ?, hint = ?, check_type = ?, active = ?, sort_order = ?, version = version + 1, updated_by = ?, updated_at = now() where id = ?",
                title, text(request.titleVi(), 500), text(request.hint(), 1000), check, active, sort, actor.getId(), id);
        audit.logAs(actor, "TRAINING_PERSONNEL_REVIEW", "Checklist template " + current.get("kind"), id, "TRAINING_REVIEW_TEMPLATE_CHANGED", null, null, request.reason().trim(), changes);
        return one(id);
    }

    private Map<String, Object> one(UUID id) {
        return TrainingRows.camel(jdbc.queryForList("select t.*, (select u.full_name from app_users u where u.id = t.updated_by) as updated_by_name from training_review_templates t where t.id = ?", id)).getFirst();
    }

    private static void change(List<AuditTrailChangeResponse> out, String field, Object before, Object after) {
        if (!java.util.Objects.equals(before == null ? null : String.valueOf(before), after == null ? null : String.valueOf(after))) out.add(new AuditTrailChangeResponse(field, before == null ? null : String.valueOf(before), after == null ? null : String.valueOf(after)));
    }

    private static String text(String value, int max) {
        if (value == null || value.isBlank()) return null;
        String trimmed = value.trim();
        if (trimmed.length() > max) throw new IllegalArgumentException("TRAINING_REVIEW_TEMPLATE_INVALID");
        return trimmed;
    }
}
