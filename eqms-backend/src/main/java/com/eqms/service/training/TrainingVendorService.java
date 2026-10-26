package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import com.eqms.service.AuditTrailService;
import com.eqms.service.ElectronicSignatureService;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * The register of approved training vendors (SOP.0025): the units that train from outside the company. A vendor is written as a Draft, approved with the electronic signature of a person other than
 * the one who wrote it (Active), made Inactive with a reason and a signature, and may be activated again with a reason and a signature. The name and the reference of an approved vendor do not change.
 * An external training whose unit is not Active in the register, or whose approval has ended, gets a warning (it does not block): see {@link #check(String)}. Every entry is in the Audit Trail of the system.
 */
@Service
public class TrainingVendorService {
    public static final String TYPE = "TRAINING_VENDOR";

    public record SaveRequest(String name, String reference, LocalDate validUntil) {}
    public record SignRequest(String signatureToken) {}
    /** The reason and the signature of a change of state; {@code validUntil} is the new end of the approval when a vendor is activated again. */
    public record ChangeRequest(String reason, String signatureToken, LocalDate validUntil) {}

    /** What the register is asked for, by the filters of the screen; every filter is applied here, on the server. */
    public record Filters(String search, String status, String approvedBy, String approvedFrom, String approvedTo, String validFrom, String validTo, String reference, String withoutEnd) {}

    private static final String STATUS = "case when p.status = 'ACTIVE' and p.valid_until is not null and p.valid_until < current_date then 'EXPIRED' else p.status end";
    private static final String SELECT = """
        select p.id, p.name, p.reference, p.valid_until, p.approved_at, p.deactivated_at, p.deactivate_reason, p.created_at, p.created_by, c.full_name as created_by_name,
               u.full_name as approved_by_name, d.full_name as deactivated_by_name,
        """ + STATUS + """
         as status
          from training_approved_providers p join app_users c on c.id = p.created_by left join app_users u on u.id = p.approved_by left join app_users d on d.id = p.deactivated_by
        """;
    private static final Map<String, String> LABEL = Map.of("DRAFT", "Draft", "ACTIVE", "Active", "EXPIRED", "Approval ended", "INACTIVE", "Inactive");

    private final JdbcTemplate jdbc;
    private final TrainingAccess access;
    private final ElectronicSignatureService signatures;
    private final AuditTrailService audit;

    public TrainingVendorService(JdbcTemplate jdbc, TrainingAccess access, ElectronicSignatureService signatures, AuditTrailService audit) {
        this.jdbc = jdbc;
        this.access = access;
        this.signatures = signatures;
        this.audit = audit;
    }

    // ------------------------------------------------------------------------------------------------------------------------------ reading

    @Transactional(readOnly = true)
    public Map<String, Object> page(UserAccount actor, Filters f, String sortBy, String sortDirection, int page, int limit) {
        access.require(actor, "training.admin.manage");
        TrainingListFilter filter = new TrainingListFilter()
                .contains(f.search(), "p.name", "p.reference")
                .contains(f.approvedBy(), "u.full_name")
                .contains(f.reference(), "p.reference")
                .equal(STATUS, f.status())
                .timeRange("p.approved_at", f.approvedFrom(), f.approvedTo())
                .dateRange("p.valid_until", f.validFrom(), f.validTo());
        if ("true".equalsIgnoreCase(f.withoutEnd())) filter.raw("p.valid_until is null");
        int safeLimit = Math.min(Math.max(limit, 1), 100), safePage = Math.max(page, 1);
        Long total = jdbc.queryForObject("select count(*) from training_approved_providers p join app_users c on c.id = p.created_by left join app_users u on u.id = p.approved_by" + filter.where(),
                Long.class, filter.args().toArray());
        List<Object> pageArgs = new ArrayList<>(filter.args());
        pageArgs.add(safeLimit);
        pageArgs.add((safePage - 1) * safeLimit);
        List<Map<String, Object>> rows = TrainingRows.camel(jdbc.queryForList(SELECT + filter.where()
                + TrainingRows.orderBy(sortBy, sortDirection, Map.of("name", "p.name", "reference", "p.reference", "validUntil", "p.valid_until", "status", STATUS, "approvedBy", "u.full_name",
                        "approvedAt", "p.approved_at", "createdAt", "p.created_at"), "p.name")
                + " limit ? offset ?", pageArgs.toArray()));
        for (Map<String, Object> row : rows) decorate(actor, row);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("data", rows);
        long count = total == null ? 0 : total;
        result.put("pagination", Map.of("page", safePage, "limit", safeLimit, "total", count, "totalPages", Math.max(1, (count + safeLimit - 1) / safeLimit)));
        return result;
    }

    /** The label of the status and what the person may do with the row: decided here, the screen only shows it. */
    private void decorate(UserAccount actor, Map<String, Object> row) {
        String status = String.valueOf(row.get("status"));
        boolean manage = access.has(actor, "training.admin.manage");
        boolean mine = actor.getId().equals(row.get("createdBy"));
        row.put("statusLabel", LABEL.getOrDefault(status, status));
        Map<String, Object> actions = new LinkedHashMap<>();
        actions.put("view", true);
        actions.put("edit", manage && "DRAFT".equals(status));
        actions.put("approve", manage && "DRAFT".equals(status) && !mine);
        actions.put("deactivate", manage && ("ACTIVE".equals(status) || "EXPIRED".equals(status)));
        actions.put("activate", manage && "INACTIVE".equals(status));
        row.put("actions", actions);
        row.remove("createdBy");
    }

    /** The people who approved a vendor, for the filter "Approved by" of the screen. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> approvers(UserAccount actor) {
        access.require(actor, "training.admin.manage");
        return jdbc.queryForList("select distinct u.full_name as label, u.full_name as value from training_approved_providers p join app_users u on u.id = p.approved_by order by u.full_name");
    }

    @Transactional(readOnly = true)
    public Map<String, Object> detail(UserAccount actor, UUID id) {
        access.require(actor, "training.admin.manage");
        return get(actor, id);
    }

    private Map<String, Object> get(UserAccount actor, UUID id) {
        Map<String, Object> row = TrainingRows.camel(jdbc.queryForList(SELECT + " where p.id = ?", id)).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        decorate(actor, row);
        return row;
    }

    private Map<String, Object> lock(UUID id) {
        return jdbc.queryForList("select * from training_approved_providers where id = ? for update", id).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
    }

    // ------------------------------------------------------------------------------------------------------------------------------ writing

    private static String clean(SaveRequest request) {
        if (request == null || request.name() == null || request.name().isBlank() || request.name().trim().length() > 255) throw new IllegalArgumentException("TRAINING_VENDOR_NAME_REQUIRED");
        if (request.reference() != null && request.reference().trim().length() > 120) throw new IllegalArgumentException("TRAINING_VENDOR_REFERENCE_TOO_LONG");
        if (request.validUntil() != null && request.validUntil().isBefore(LocalDate.now())) throw new IllegalArgumentException("TRAINING_VENDOR_VALIDITY_PAST");
        return request.name().trim();
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private void requireNameFree(String name, UUID except) {
        Integer same = jdbc.queryForObject("select count(*) from training_approved_providers where lower(btrim(name)) = lower(?) and status in ('DRAFT', 'ACTIVE') and id <> ?", Integer.class, name, except == null ? new UUID(0, 0) : except);
        if (same != null && same > 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_VENDOR_EXISTS");
    }

    /** Writes a vendor as a Draft: nothing is signed yet. */
    @Transactional
    public Map<String, Object> create(UserAccount actor, SaveRequest request) {
        access.require(actor, "training.admin.manage");
        String name = clean(request);
        requireNameFree(name, null);
        UUID id = UUID.randomUUID();
        jdbc.update("insert into training_approved_providers(id, name, reference, valid_until, status, created_by) values (?,?,?,?, 'DRAFT', ?)", id, name, blankToNull(request.reference()), request.validUntil(), actor.getId());
        audit.logAs(actor, TYPE, name, id, "TRAINING_VENDOR_CREATED", null, "DRAFT", blankToNull(request.reference()));
        return get(actor, id);
    }

    /** Changes a Draft: after the approval the name and the reference do not change. */
    @Transactional
    public Map<String, Object> update(UserAccount actor, UUID id, SaveRequest request) {
        access.require(actor, "training.admin.manage");
        Map<String, Object> v = lock(id);
        if (!"DRAFT".equals(v.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_VENDOR_NOT_DRAFT");
        String name = clean(request);
        requireNameFree(name, id);
        jdbc.update("update training_approved_providers set name = ?, reference = ?, valid_until = ? where id = ?", name, blankToNull(request.reference()), request.validUntil(), id);
        audit.logAs(actor, TYPE, name, id, "TRAINING_VENDOR_UPDATED", "DRAFT", "DRAFT", blankToNull(request.reference()));
        return get(actor, id);
    }

    /** Approves a Draft with the electronic signature of a person other than the one who wrote it. */
    @Transactional
    public Map<String, Object> approve(UserAccount actor, UUID id, SignRequest request) {
        access.require(actor, "training.admin.manage");
        Map<String, Object> v = lock(id);
        if (!"DRAFT".equals(v.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_VENDOR_NOT_DRAFT");
        if (actor.getId().equals(v.get("created_by"))) throw new IllegalArgumentException(TrainingApprovalService.SEGREGATION);
        if (request == null || request.signatureToken() == null || request.signatureToken().isBlank()) throw new IllegalArgumentException("TRAINING_SIGNATURE_REQUIRED");
        Object until = v.get("valid_until");
        if (until != null && ((java.sql.Date) until).toLocalDate().isBefore(LocalDate.now())) throw new IllegalArgumentException("TRAINING_VENDOR_VALIDITY_PAST");
        requireNameFree(String.valueOf(v.get("name")), id);
        UUID signature = signatures.createEntitySignature(TYPE, id, String.valueOf(v.get("name")), actor, request.signatureToken(), "TRAINING_PROVIDER_APPROVED",
                "Approval of an external training vendor (SOP.0025)", null, null, null).getId();
        jdbc.update("update training_approved_providers set status = 'ACTIVE', approved_by = ?, approved_signature_id = ?, approved_at = now() where id = ?", actor.getId(), signature, id);
        audit.logAs(actor, TYPE, String.valueOf(v.get("name")), id, "TRAINING_PROVIDER_APPROVED", "DRAFT", "ACTIVE", null);
        return get(actor, id);
    }

    @Transactional
    public Map<String, Object> deactivate(UserAccount actor, UUID id, ChangeRequest request) {
        access.require(actor, "training.admin.manage");
        Map<String, Object> v = lock(id);
        if (!"ACTIVE".equals(v.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_VENDOR_NOT_ACTIVE");
        requireReasonAndSignature(request);
        UUID signature = signatures.createEntitySignature(TYPE, id, String.valueOf(v.get("name")), actor, request.signatureToken(), "TRAINING_PROVIDER_DEACTIVATED", request.reason().trim(), null, null, null).getId();
        jdbc.update("update training_approved_providers set status = 'INACTIVE', deactivated_by = ?, deactivated_signature_id = ?, deactivated_at = now(), deactivate_reason = ? where id = ?",
                actor.getId(), signature, request.reason().trim(), id);
        audit.logAs(actor, TYPE, String.valueOf(v.get("name")), id, "TRAINING_PROVIDER_DEACTIVATED", "ACTIVE", "INACTIVE", request.reason().trim());
        return get(actor, id);
    }

    /** Activates an Inactive vendor again, with a reason and a signature; the end of the approval may be renewed in the same step. */
    @Transactional
    public Map<String, Object> activate(UserAccount actor, UUID id, ChangeRequest request) {
        access.require(actor, "training.admin.manage");
        Map<String, Object> v = lock(id);
        if (!"INACTIVE".equals(v.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_VENDOR_NOT_INACTIVE");
        requireReasonAndSignature(request);
        LocalDate until = request.validUntil() != null ? request.validUntil() : v.get("valid_until") == null ? null : ((java.sql.Date) v.get("valid_until")).toLocalDate();
        if (until != null && until.isBefore(LocalDate.now())) throw new IllegalArgumentException("TRAINING_VENDOR_VALIDITY_PAST");
        requireNameFree(String.valueOf(v.get("name")), id);
        UUID signature = signatures.createEntitySignature(TYPE, id, String.valueOf(v.get("name")), actor, request.signatureToken(), "TRAINING_VENDOR_ACTIVATED", request.reason().trim(), null, null, null).getId();
        jdbc.update("update training_approved_providers set status = 'ACTIVE', valid_until = ?, approved_by = ?, approved_signature_id = ?, approved_at = now(), deactivated_by = null, deactivated_signature_id = null, "
                + "deactivated_at = null, deactivate_reason = null where id = ?", until, actor.getId(), signature, id);
        audit.logAs(actor, TYPE, String.valueOf(v.get("name")), id, "TRAINING_VENDOR_ACTIVATED", "INACTIVE", "ACTIVE", request.reason().trim());
        return get(actor, id);
    }

    private static void requireReasonAndSignature(ChangeRequest request) {
        if (request == null || request.reason() == null || request.reason().isBlank()) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
        if (request.signatureToken() == null || request.signatureToken().isBlank()) throw new IllegalArgumentException("TRAINING_SIGNATURE_REQUIRED");
    }

    // ------------------------------------------------------------------------------------------------------------------------------ the warning

    /**
     * What the register says about the training unit of an external training: null when there is nothing to warn about (the unit is Active and its approval is valid), otherwise the warning
     * code: {@code VENDOR_NOT_APPROVED}, {@code VENDOR_APPROVAL_ENDED} or {@code VENDOR_NOT_NAMED}.
     */
    @Transactional(readOnly = true)
    public String check(String trainingUnitName) {
        if (trainingUnitName == null || trainingUnitName.isBlank()) return "VENDOR_NOT_NAMED";
        List<Map<String, Object>> found = jdbc.queryForList("select valid_until from training_approved_providers where lower(btrim(name)) = lower(btrim(?)) and status = 'ACTIVE' limit 1", trainingUnitName);
        if (found.isEmpty()) return "VENDOR_NOT_APPROVED";
        Object until = found.getFirst().get("valid_until");
        if (until != null && ((java.sql.Date) until).toLocalDate().isBefore(LocalDate.now())) return "VENDOR_APPROVAL_ENDED";
        return null;
    }
}
