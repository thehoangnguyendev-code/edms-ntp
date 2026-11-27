package com.eqms.service;

import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.entity.UserAccount;
import com.eqms.util.DateTimeFormatUtils;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.sql.Timestamp;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * The workflow diagrams of Document Control and Training Management (DEC-WORKFLOW-DIAGRAM-2026-11-27). A person with the view or the manage permission of a
 * module sees its diagrams; only manage creates, draws, renames and deletes them. A save puts the diagram in force, needs a reason, is written to the audit log
 * and keeps the version; the version number the person started from must still be the current one, so nobody overwrites a change they have not seen.
 *
 * <p>The SVG is drawn by the browser of the author and is untrusted: the screens show it only as an image (an img element), where nothing in it can run.
 */
@Service
public class WorkflowDiagramService {

    static final int MAX_CONTENT = 3_000_000;
    private static final String ENTITY = "WORKFLOW_DIAGRAM";

    /** A module that has diagrams, with the permissions that open and change them. */
    public enum Module {
        DOCUMENT_CONTROL("documents", "Document Control"),
        TRAINING("training", "Training Management");

        private final String key;
        private final String label;

        Module(String key, String label) {
            this.key = key;
            this.label = label;
        }

        String view() {
            return key + ".workflow_diagram.view";
        }

        String manage() {
            return key + ".workflow_diagram.manage";
        }

        String access() {
            return key + ".module.view";
        }
    }

    private final JdbcTemplate jdbc;
    private final PermissionEvaluationService permissions;
    private final AuditTrailService audit;

    public WorkflowDiagramService(JdbcTemplate jdbc, PermissionEvaluationService permissions, AuditTrailService audit) {
        this.jdbc = jdbc;
        this.permissions = permissions;
        this.audit = audit;
    }

    private static ResponseStatusException refuse(HttpStatus status, String code) {
        return new ResponseStatusException(status, code);
    }

    private static Module module(String value) {
        try {
            return Module.valueOf(value == null ? "" : value);
        } catch (IllegalArgumentException unknown) {
            throw refuse(HttpStatus.BAD_REQUEST, "WORKFLOW_DIAGRAM_MODULE_UNKNOWN");
        }
    }

    private boolean canManage(UserAccount actor, Module module) {
        return permissions.hasPermission(actor, module.access()) && permissions.hasPermission(actor, module.manage());
    }

    private void requireView(UserAccount actor, Module module) {
        if (!permissions.hasPermission(actor, module.access())
                || !(permissions.hasPermission(actor, module.view()) || permissions.hasPermission(actor, module.manage()))) {
            throw new AccessDeniedException("You do not have permission to view these workflow diagrams.");
        }
    }

    private void requireManage(UserAccount actor, Module module) {
        if (!canManage(actor, module)) throw new AccessDeniedException("You do not have permission to change these workflow diagrams.");
    }

    @Transactional(readOnly = true)
    public Map<String, Object> list(UserAccount actor, String moduleName, String search) {
        Module module = module(moduleName);
        requireView(actor, module);
        String term = search == null ? "" : search.trim();
        String like = "%" + term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        List<Map<String, Object>> rows = jdbc.queryForList("""
                select d.id, d.name, d.description, d.version_no, d.updated_at, u.full_name as updated_by_name
                  from workflow_diagrams d join app_users u on u.id = d.updated_by
                 where d.module = ? and d.deleted_at is null
                   and (eqms_fold(d.name) like eqms_fold(?) escape '\\' or eqms_fold(coalesce(d.description,'')) like eqms_fold(?) escape '\\')
                 order by lower(d.name), d.id limit 200
                """, module.name(), like, like);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("data", rows.stream().map(WorkflowDiagramService::summary).toList());
        result.put("canManage", canManage(actor, module));
        return result;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> get(UserAccount actor, UUID id) {
        Map<String, Object> row = require(id, false);
        Module module = module((String) row.get("module"));
        requireView(actor, module);
        boolean manage = canManage(actor, module);
        Map<String, Object> out = summary(row);
        out.put("module", module.name());
        out.put("svg", row.get("diagram_svg"));
        // the read-only view draws from the drawing itself; changing it still needs the manage permission on every write
        out.put("xml", row.get("diagram_xml"));
        out.put("canManage", manage);
        return out;
    }

    @Transactional
    public Map<String, Object> create(UserAccount actor, String moduleName, String name, String description) {
        Module module = module(moduleName);
        requireManage(actor, module);
        String title = name(name);
        requireFreeName(module, title, null);
        UUID id = UUID.randomUUID();
        jdbc.update("insert into workflow_diagrams(id, module, name, description, created_by, updated_by) values (?,?,?,?,?,?)",
                id, module.name(), title, optional(description), actor.getId(), actor.getId());
        audit.log(ENTITY, title, id, "CREATE", null, null, "Workflow diagram created in " + module.label,
                List.of(new AuditTrailChangeResponse("Name", null, title)));
        return get(actor, id);
    }

    /** Puts a new drawing in force. {@code version} is the version the author started from. */
    @Transactional
    public Map<String, Object> save(UserAccount actor, UUID id, Integer version, String xml, String svg, String reason) {
        Map<String, Object> row = require(id, true);
        Module module = module((String) row.get("module"));
        requireManage(actor, module);
        int current = (Integer) row.get("version_no");
        if (version == null || version != current) throw refuse(HttpStatus.CONFLICT, "WORKFLOW_DIAGRAM_CHANGED");
        String why = reason(reason);
        String drawing = content(xml, "<mxfile", "<mxGraphModel");
        String picture = content(svg, "<svg", "<?xml");
        if (!picture.contains("<svg")) throw refuse(HttpStatus.BAD_REQUEST, "WORKFLOW_DIAGRAM_CONTENT_INVALID");
        int next = current + 1;
        jdbc.update("insert into workflow_diagram_versions(id, diagram_id, version_no, diagram_xml, diagram_svg, reason, saved_by) values (?,?,?,?,?,?,?)",
                UUID.randomUUID(), id, next, drawing, picture, why, actor.getId());
        jdbc.update("update workflow_diagrams set diagram_xml = ?, diagram_svg = ?, version_no = ?, updated_by = ?, updated_at = now() where id = ?",
                drawing, picture, next, actor.getId(), id);
        audit.logAsWithUserReason(actor, ENTITY, (String) row.get("name"), id, "UPDATE", null, null, "Workflow diagram saved and put in force", why,
                List.of(new AuditTrailChangeResponse("Version", String.valueOf(current), String.valueOf(next))), null);
        return get(actor, id);
    }

    @Transactional
    public Map<String, Object> rename(UserAccount actor, UUID id, String name, String description, String reason) {
        Map<String, Object> row = require(id, true);
        Module module = module((String) row.get("module"));
        requireManage(actor, module);
        String why = reason(reason);
        String title = name(name);
        requireFreeName(module, title, id);
        String text = optional(description);
        jdbc.update("update workflow_diagrams set name = ?, description = ?, updated_by = ?, updated_at = now() where id = ?", title, text, actor.getId(), id);
        audit.logAsWithUserReason(actor, ENTITY, title, id, "UPDATE", null, null, "Workflow diagram details changed", why,
                List.of(new AuditTrailChangeResponse("Name", (String) row.get("name"), title),
                        new AuditTrailChangeResponse("Description", (String) row.get("description"), text)), null);
        return get(actor, id);
    }

    @Transactional
    public void delete(UserAccount actor, UUID id, String reason) {
        Map<String, Object> row = require(id, true);
        requireManage(actor, module((String) row.get("module")));
        String why = reason(reason);
        jdbc.update("update workflow_diagrams set deleted_by = ?, deleted_at = now(), delete_reason = ? where id = ?", actor.getId(), why, id);
        audit.logAsWithUserReason(actor, ENTITY, (String) row.get("name"), id, "DELETE", null, null, "Workflow diagram deleted", why, List.of(), null);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> versions(UserAccount actor, UUID id) {
        requireView(actor, module((String) require(id, false).get("module")));
        return jdbc.queryForList("""
                select v.version_no, v.reason, v.saved_at, u.full_name as saved_by_name
                  from workflow_diagram_versions v join app_users u on u.id = v.saved_by
                 where v.diagram_id = ? order by v.version_no desc
                """, id).stream().map(r -> {
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("version", r.get("version_no"));
            out.put("reason", r.get("reason"));
            out.put("savedByName", r.get("saved_by_name"));
            out.put("savedAt", time(r.get("saved_at")));
            return out;
        }).toList();
    }

    /** The drawing and the picture of one earlier version. */
    @Transactional(readOnly = true)
    public Map<String, Object> versionImage(UserAccount actor, UUID id, int version) {
        requireView(actor, module((String) require(id, false).get("module")));
        List<Map<String, Object>> rows = jdbc.queryForList("select diagram_xml, diagram_svg from workflow_diagram_versions where diagram_id = ? and version_no = ?", id, version);
        if (rows.isEmpty()) throw refuse(HttpStatus.NOT_FOUND, "WORKFLOW_DIAGRAM_NOT_FOUND");
        return Map.of("version", version, "xml", rows.getFirst().get("diagram_xml"), "svg", rows.getFirst().get("diagram_svg"));
    }

    private Map<String, Object> require(UUID id, boolean lock) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                select d.*, u.full_name as updated_by_name from workflow_diagrams d join app_users u on u.id = d.updated_by
                 where d.id = ? and d.deleted_at is null
                """ + (lock ? " for update of d" : ""), id);
        if (rows.isEmpty()) throw refuse(HttpStatus.NOT_FOUND, "WORKFLOW_DIAGRAM_NOT_FOUND");
        return rows.getFirst();
    }

    private void requireFreeName(Module module, String name, UUID self) {
        Integer taken = jdbc.queryForObject("select count(*) from workflow_diagrams where module = ? and lower(name) = lower(?) and deleted_at is null and id <> ?",
                Integer.class, module.name(), name, self == null ? new UUID(0, 0) : self);
        if (taken != null && taken > 0) throw refuse(HttpStatus.CONFLICT, "WORKFLOW_DIAGRAM_NAME_TAKEN");
    }

    private static String name(String value) {
        String text = value == null ? "" : value.trim();
        if (text.isEmpty() || text.length() > 200) throw refuse(HttpStatus.BAD_REQUEST, "WORKFLOW_DIAGRAM_NAME_REQUIRED");
        return text;
    }

    private static String optional(String value) {
        String text = value == null ? "" : value.trim();
        if (text.length() > 1000) throw refuse(HttpStatus.BAD_REQUEST, "WORKFLOW_DIAGRAM_DESCRIPTION_TOO_LONG");
        return text.isEmpty() ? null : text;
    }

    private static String reason(String value) {
        String text = value == null ? "" : value.trim();
        if (text.length() < 3 || text.length() > 1000) throw refuse(HttpStatus.BAD_REQUEST, "WORKFLOW_DIAGRAM_REASON_REQUIRED");
        return text;
    }

    private static String content(String value, String... starts) {
        String text = value == null ? "" : value.strip();
        if (text.isEmpty() || text.length() > MAX_CONTENT) throw refuse(HttpStatus.BAD_REQUEST, "WORKFLOW_DIAGRAM_CONTENT_INVALID");
        for (String start : starts) if (text.startsWith(start)) return text;
        throw refuse(HttpStatus.BAD_REQUEST, "WORKFLOW_DIAGRAM_CONTENT_INVALID");
    }

    private static Map<String, Object> summary(Map<String, Object> row) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", String.valueOf(row.get("id")));
        out.put("name", row.get("name"));
        out.put("description", row.get("description"));
        out.put("version", row.get("version_no"));
        out.put("updatedByName", row.get("updated_by_name"));
        out.put("updatedAt", time(row.get("updated_at")));
        return out;
    }

    private static String time(Object value) {
        return value instanceof Timestamp stamp ? DateTimeFormatUtils.formatDateTime(stamp.toInstant()) : null;
    }
}
