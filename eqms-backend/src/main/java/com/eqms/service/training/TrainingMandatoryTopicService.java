package com.eqms.service.training;

import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.entity.UserAccount;
import com.eqms.service.AuditTrailService;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * The contents SOP.0003 5.3.2 says the annual training requirement includes (General GMP, Data integrity, Aseptic technique, and what the company adds). A requirement is
 * reminded when no line covers one of them. Training Administration keeps the list; every change is in the Audit Trail with its reason.
 */
@Service
public class TrainingMandatoryTopicService {
    public record Write(String name, String nameVi, String keyword, Boolean active, String reason) {}

    private final JdbcTemplate jdbc;
    private final TrainingAccess access;
    private final AuditTrailService audit;

    public TrainingMandatoryTopicService(JdbcTemplate jdbc, TrainingAccess access, AuditTrailService audit) {
        this.jdbc = jdbc;
        this.access = access;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> list(UserAccount actor) {
        access.require(actor, "training.admin.manage", "training.settings.view", "training.requirement.prepare");
        return TrainingRows.camel(jdbc.queryForList("select id, name, name_vi, keyword, active from training_annual_mandatory_topics order by name"));
    }

    @Transactional
    public Map<String, Object> save(UserAccount actor, UUID id, Write request) {
        access.require(actor, "training.admin.manage");
        if (request == null) throw new IllegalArgumentException("TRAINING_MANDATORY_TOPIC_INVALID");
        String name = clean(request.name(), 200);
        String keyword = clean(request.keyword(), 100);
        if (name == null || keyword == null) throw new IllegalArgumentException("TRAINING_MANDATORY_TOPIC_INVALID");
        if (request.reason() == null || request.reason().isBlank()) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
        String reason = request.reason().trim();
        UUID target = id;
        List<AuditTrailChangeResponse> changes = new java.util.ArrayList<>();
        if (id == null) {
            if (jdbc.queryForObject("select count(*) from training_annual_mandatory_topics where lower(name) = lower(?)", Integer.class, name) > 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_MANDATORY_TOPIC_EXISTS");
            target = UUID.randomUUID();
            jdbc.update("insert into training_annual_mandatory_topics(id, name, name_vi, keyword, active) values (?,?,?,?,?)", target, name, clean(request.nameVi(), 200), keyword, request.active() == null || request.active());
            changes.add(new AuditTrailChangeResponse("Mandatory Content Added", null, name));
        } else {
            Map<String, Object> current = jdbc.queryForList("select * from training_annual_mandatory_topics where id = ?", id).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
            boolean active = request.active() == null ? Boolean.TRUE.equals(current.get("active")) : request.active();
            if (!name.equals(current.get("name"))) changes.add(new AuditTrailChangeResponse("Name", String.valueOf(current.get("name")), name));
            if (!keyword.equals(current.get("keyword"))) changes.add(new AuditTrailChangeResponse("Keyword", String.valueOf(current.get("keyword")), keyword));
            if (active != Boolean.TRUE.equals(current.get("active"))) changes.add(new AuditTrailChangeResponse("Active", String.valueOf(current.get("active")), String.valueOf(active)));
            jdbc.update("update training_annual_mandatory_topics set name = ?, name_vi = ?, keyword = ?, active = ? where id = ?", name, clean(request.nameVi(), 200), keyword, active, id);
        }
        if (!changes.isEmpty()) {
            changes.add(new AuditTrailChangeResponse("Reason", null, reason));
            audit.logAs(actor, "TRAINING_REQUIREMENT", "Mandatory contents", target, "TRAINING_MANDATORY_TOPIC_" + (id == null ? "ADDED" : "CHANGED"), null, null, reason, changes);
        }
        UUID row = target;
        return TrainingRows.camel(jdbc.queryForList("select id, name, name_vi, keyword, active from training_annual_mandatory_topics where id = ?", row)).getFirst();
    }

    private static String clean(String value, int max) {
        if (value == null || value.isBlank()) return null;
        String t = value.trim();
        if (t.length() > max) throw new IllegalArgumentException("TRAINING_MANDATORY_TOPIC_INVALID");
        return t;
    }
}
