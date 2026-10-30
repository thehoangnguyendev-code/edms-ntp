package com.eqms.service.training;

import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.UserAccount;
import com.eqms.service.AuditTrailService;
import com.eqms.service.DocumentAuthorizationService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * The people the author of a document proposes for its training while the document is prepared. The training activity of the document already exists then (it
 * holds the Training Number) but has no session yet, so the people cannot be on a list: they are kept here, and put on the list of the first session when the
 * organizer adds it ({@link TrainingActivityService}). The list is still confirmed by the organizer with a signature; nothing here makes anyone "trained".
 * <p>
 * Who may edit is decided by Document Control (the person who may edit the draft document or revision) or by Training (an organizer of the department): this class
 * asks both and adds no permission of its own.
 */
@Service
public class TrainingProposedParticipantService {
    private static final int MAX_PEOPLE = 500;

    private final JdbcTemplate jdbc;
    private final TrainingAccess access;
    private final TrainingStore store;
    private final DocumentAuthorizationService documents;
    private final AuditTrailService audit;
    @PersistenceContext
    private EntityManager entityManager;

    public TrainingProposedParticipantService(JdbcTemplate jdbc, TrainingAccess access, TrainingStore store, DocumentAuthorizationService documents, AuditTrailService audit) {
        this.jdbc = jdbc;
        this.access = access;
        this.store = store;
        this.documents = documents;
        this.audit = audit;
    }

    public record ReplaceRequest(List<UUID> personUserIds) {}

    /** The open activity of the document that can still receive a proposal: the one waiting for its first revision, or the one of the revision being prepared. */
    private Map<String, Object> openActivity(UUID documentId) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
            select * from training_activities where document_id=? and parent_activity_id is null and status in ('RESERVED','PLANNED') order by created_at desc limit 1
            """, documentId);
        return rows.isEmpty() ? null : rows.getFirst();
    }

    private boolean organizes(UserAccount actor, Map<String, Object> activity) {
        return access.has(actor, "training.activity.organize") && access.inScope(actor, (UUID) activity.get("organizer_department_id"));
    }

    private boolean canEdit(UserAccount actor, Map<String, Object> activity) {
        String status = String.valueOf(activity.get("status"));
        boolean open = "RESERVED".equals(status) || ("PLANNED".equals(status) && activity.get("list_prepared_by") == null);
        if (!open) return false;
        if (organizes(actor, activity)) return true;
        UUID documentId = (UUID) activity.get("document_id");
        UUID revisionId = (UUID) activity.get("revision_id");
        if (revisionId == null) {
            DocumentRecord document = entityManager.find(DocumentRecord.class, documentId);
            return document != null && documents.canEditInitialDocumentDraft(actor, document);
        }
        DocumentRevisionRecord revision = entityManager.find(DocumentRevisionRecord.class, revisionId);
        return revision != null && documents.canEditDraftRevision(actor, revision);
    }

    private boolean canView(UserAccount actor, Map<String, Object> activity) {
        if (organizes(actor, activity) || access.has(actor, "training.activity.view") && access.inScope(actor, (UUID) activity.get("organizer_department_id"))) return true;
        DocumentRecord document = entityManager.find(DocumentRecord.class, activity.get("document_id"));
        return document != null && documents.canViewDocument(actor, document);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> forDocument(UserAccount actor, UUID documentId) {
        Map<String, Object> out = new LinkedHashMap<>();
        Map<String, Object> activity = openActivity(documentId);
        if (activity == null) {
            out.put("available", false);
            out.put("editable", false);
            out.put("people", List.of());
            return out;
        }
        if (!canView(actor, activity)) throw new SecurityException(TrainingAccess.DENIED);
        out.put("available", true);
        out.put("activityId", activity.get("id"));
        out.put("trainingNumber", activity.get("training_number"));
        out.put("editable", canEdit(actor, activity));
        out.put("people", TrainingRows.camel(jdbc.queryForList("""
            select u.id as person_id, u.full_name, u.username, u.email, u.employee_code, u.department, u.position, u.avatar
              from training_proposed_participants p join app_users u on u.id = p.person_user_id
             where p.activity_id=? order by u.full_name
            """, activity.get("id"))));
        return out;
    }

    /** Replaces the proposal by the given people. */
    @Transactional(readOnly = true)
    public Map<String, Object> forDocumentPage(UserAccount actor, UUID documentId, int page, int limit) {
        Map<String, Object> result = new LinkedHashMap<>(forDocument(actor, documentId));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> people = (List<Map<String, Object>>) result.getOrDefault("people", List.of());
        int size = Math.max(1, Math.min(50, limit));
        int safePage = Math.max(1, page);
        int from = (int) Math.min((long) (safePage - 1) * size, people.size());
        result.put("personIds", people.stream().map(p -> p.get("personId")).toList());
        result.put("people", people.subList(from, Math.min(people.size(), from + size)));
        result.put("pagination", new com.eqms.dto.user.PaginationResponse(safePage, size, people.size(), (int) Math.ceil((double) people.size() / size)));
        return result;
    }

    /** Replaces the proposal by the given people. */
    @Transactional
    public Map<String, Object> replace(UserAccount actor, UUID documentId, ReplaceRequest request) {
        Map<String, Object> activity = openActivity(documentId);
        if (activity == null) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_PROPOSAL_NO_ACTIVITY");
        if (!canEdit(actor, activity)) throw new SecurityException(TrainingAccess.DENIED);
        Set<UUID> wanted = new LinkedHashSet<>(request == null || request.personUserIds() == null ? List.<UUID>of() : request.personUserIds());
        if (wanted.size() > MAX_PEOPLE || wanted.contains(null)) throw new IllegalArgumentException("TRAINING_PROPOSAL_INVALID");
        UUID activityId = (UUID) activity.get("id");
        Map<UUID, String> active = new LinkedHashMap<>();
        for (UUID id : wanted) {
            List<String> names = jdbc.queryForList("select full_name from app_users where id=? and status='Active'", String.class, id);
            if (names.isEmpty()) throw new IllegalArgumentException("TRAINING_PARTICIPANT_NOT_ELIGIBLE");
            active.put(id, names.getFirst());
        }
        Set<UUID> before = new LinkedHashSet<>(jdbc.queryForList("select person_user_id from training_proposed_participants where activity_id=?", UUID.class, activityId));
        List<AuditTrailChangeResponse> changes = new ArrayList<>();
        int removed = 0;
        for (UUID id : before) {
            if (!active.containsKey(id)) {
                changes.add(new AuditTrailChangeResponse("Participant removed", describe(id), null));
                jdbc.update("delete from training_proposed_participants where activity_id=? and person_user_id=?", activityId, id);
                removed++;
            }
        }
        int added = 0;
        for (UUID id : active.keySet()) {
            if (!before.contains(id)) {
                jdbc.update("insert into training_proposed_participants(id, activity_id, person_user_id, proposed_by) values (?,?,?,?)", UUID.randomUUID(), activityId, id, actor.getId());
                changes.add(new AuditTrailChangeResponse("Participant added", null, describe(id)));
                added++;
            }
        }
        if (!changes.isEmpty()) {
            int after = before.size() - removed + added;
            changes.add(0, new AuditTrailChangeResponse("List of participants in the Training", before.size() + " people", after + " people"));
            String comment = "Proposed participants of " + activity.get("training_number") + ": " + added + " added, " + removed + " removed, " + after + " in total";
            store.event(TrainingStore.OBJECT_ACTIVITY, activityId, activityId, "PARTICIPANTS_PROPOSED", Map.of("added", added, "removed", removed), actor.getId());
            audit.logAs(actor, TrainingStore.OBJECT_ACTIVITY, String.valueOf(activity.get("training_number")), activityId, "TRAINING_PARTICIPANTS_PROPOSED", null, null, comment, changes);
            // The same entry on the document, so that its own Audit Trail shows who chose the people and who was chosen or taken off.
            DocumentRecord document = entityManager.find(DocumentRecord.class, documentId);
            if (document != null) {
                String number = document.getDocumentNumber() == null ? "" : document.getDocumentNumber();
                String name = document.getDocumentName() == null ? "" : document.getDocumentName();
                String label = !number.isBlank() && !name.isBlank() ? number + " - " + name : (number.isBlank() ? (name.isBlank() ? "-" : name) : number);
                audit.logAs(actor, "DOCUMENT", label, documentId, "TRAINING_PARTICIPANTS_PROPOSED", null, null, comment, changes);
            }
        }
        return forDocument(actor, documentId);
    }

    /** A person as the Audit Trail shows them: name, employee ID, department and position, enough to tell two people of the same name apart. */
    private String describe(UUID personId) {
        List<Map<String, Object>> rows = jdbc.queryForList("select full_name, employee_code, department, position from app_users where id=?", personId);
        if (rows.isEmpty()) return String.valueOf(personId);
        Map<String, Object> r = rows.getFirst();
        List<String> parts = new ArrayList<>();
        for (String key : List.of("employee_code", "department", "position")) {
            Object v = r.get(key);
            if (v != null && !String.valueOf(v).isBlank()) parts.add(String.valueOf(v));
        }
        return r.get("full_name") + (parts.isEmpty() ? "" : " (" + String.join(", ", parts) + ")");
    }

    // ------------------------------------------------------------------------------------------------------------------------------ choosing people

    @Transactional(readOnly = true)
    public com.eqms.dto.user.PageResponse<Map<String, Object>> queryPeople(UserAccount actor, String search,
            String businessUnit, String department, int page, int limit) {
        requireCanChoose(actor);
        String like = "%" + escapeLike((search == null ? "" : search.trim()).toLowerCase(Locale.ROOT)) + "%";
        String where = " where u.status='Active' and (lower(u.full_name) like ? escape '\\' or lower(u.username) like ? escape '\\' or lower(coalesce(u.employee_code,'')) like ? escape '\\')";
        List<Object> args = new ArrayList<>(List.of(like, like, like));
        if (businessUnit != null && !businessUnit.isBlank()) { where += " and u.business_unit=?"; args.add(businessUnit); }
        if (department != null && !department.isBlank()) { where += " and u.department=?"; args.add(department); }
        Long total = jdbc.queryForObject("select count(*) from app_users u" + where, Long.class, args.toArray());
        int safePage = Math.max(1, page);
        int size = Math.min(50, Math.max(1, limit));
        args.add(size);
        args.add((long) (safePage - 1) * size);
        var data = TrainingRows.camel(jdbc.queryForList("select u.id, u.full_name, u.username, u.email, u.employee_code, u.department, u.position, u.business_unit, u.avatar from app_users u"
                + where + " order by lower(u.full_name), u.id limit ? offset ?", args.toArray()));
        return new com.eqms.dto.user.PageResponse<>(data, new com.eqms.dto.user.PaginationResponse(safePage, size,
                total == null ? 0 : total, total == null ? 0 : (int) Math.ceil((double) total / size)));
    }

    private void requireCanChoose(UserAccount actor) {
        if (!(documents.canManageDocumentWorkspace(actor) || documents.canCreateDocument(actor) || access.has(actor, "training.activity.organize"))) throw new SecurityException(TrainingAccess.DENIED);
    }

    private static String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    /** Active people by name or user name, in every department: a document is read across the company. Only what is needed to recognise the person. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> people(UserAccount actor, String search, int limit) {
        requireCanChoose(actor);
        String like = "%" + escapeLike((search == null ? "" : search.trim()).toLowerCase(Locale.ROOT)) + "%";
        return TrainingRows.camel(jdbc.queryForList("""
            select u.id, u.full_name, u.username, u.email, u.employee_code, u.department, u.position, u.business_unit, u.avatar from app_users u
             where u.status = 'Active' and (lower(u.full_name) like ? escape '\\' or lower(u.username) like ? escape '\\' or lower(coalesce(u.employee_code,'')) like ? escape '\\')
             order by u.full_name limit ?
            """, like, like, like, Math.min(Math.max(limit, 1), 50)));
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> groups(UserAccount actor, String by) {
        requireCanChoose(actor);
        String column = column(by);
        return TrainingRows.camel(jdbc.queryForList("select " + column + " as name, count(*) as total from app_users where status='Active' and " + column + " is not null and trim(" + column + ") <> '' group by " + column + " order by " + column));
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> inGroups(UserAccount actor, String by, List<String> names) {
        requireCanChoose(actor);
        String column = column(by);
        if (names == null || names.isEmpty()) return List.of();
        String marks = String.join(",", names.stream().map(n -> "?").toList());
        return TrainingRows.camel(jdbc.queryForList("select u.id, u.full_name, u.username, u.email, u.employee_code, u.department, u.position, u.business_unit, u.avatar from app_users u where u.status='Active' and u." + column
                + " in (" + marks + ") order by u.full_name limit 500", names.toArray()));
    }

    private static String column(String by) {
        return switch (by == null ? "" : by) {
            case "BUSINESS_UNIT" -> "business_unit";
            case "DEPARTMENT" -> "department";
            default -> throw new IllegalArgumentException("TRAINING_GROUP_INVALID");
        };
    }
}
