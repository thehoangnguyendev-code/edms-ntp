package com.eqms.service;

import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.dto.uncontrolledcopypolicy.UncontrolledCopyRuleChange;
import com.eqms.entity.DocumentType;
import com.eqms.entity.UncontrolledCopyEligibilityRule;
import com.eqms.entity.UserAccount;
import com.eqms.repository.DocumentTypeRepository;
import com.eqms.repository.UncontrolledCopyEligibilityRuleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.util.*;

/** Draft changes join the signed policy transaction; never save from a modal. */
@Service
public class UncontrolledCopyRuleDraftService {
    private final UncontrolledCopyEligibilityRuleRepository repository;
    private final DocumentTypeRepository types;
    public UncontrolledCopyRuleDraftService(UncontrolledCopyEligibilityRuleRepository repository, DocumentTypeRepository types) {
        this.repository = repository;
        this.types = types;
    }

    private record Plan(UncontrolledCopyEligibilityRule row, UncontrolledCopyRuleChange change, DocumentType type) {}

    @Transactional(propagation = Propagation.MANDATORY)
    public List<AuditTrailChangeResponse> apply(List<UncontrolledCopyRuleChange> changes, UserAccount actor) {
        if (changes == null || changes.isEmpty()) return List.of();
        List<UncontrolledCopyEligibilityRule> stored = repository.findAll();
        Map<UUID, UncontrolledCopyEligibilityRule> byId = new HashMap<>();
        stored.forEach(row -> byId.put(row.getId(), row));
        Set<UUID> touched = new HashSet<>();
        List<Plan> plans = new ArrayList<>();
        List<AuditTrailChangeResponse> audit = new ArrayList<>();
        // Validate every operation and the final active scopes before changing managed entities.
        for (var change : changes) {
            if (change == null || (change.id() == null && change.delete())) throw new IllegalArgumentException("Invalid rule change");
            var row = change.id() == null ? new UncontrolledCopyEligibilityRule() : byId.get(change.id());
            if (change.id() != null && (!touched.add(change.id()) || row == null || change.expectedUpdatedAt() == null
                    || !Objects.equals(row.getUpdatedAt(), change.expectedUpdatedAt()))) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Eligibility rule changed. Reload and review your changes.");
            }
            DocumentType type = change.delete() || change.documentTypeId() == null ? null : types.findById(change.documentTypeId())
                    .orElseThrow(() -> new IllegalArgumentException("Document Type not found"));
            if (change.id() == null) row.setId(UUID.randomUUID());
            plans.add(new Plan(row, change, type));
            String prefix = "Eligibility Rule " + row.getId() + ": ";
            if (change.delete()) {
                audit.add(new AuditTrailChangeResponse(prefix + "Deleted", describe(row), null));
            } else if (change.id() == null) {
                audit.add(new AuditTrailChangeResponse(prefix + "Created", null, describe(type, change.allowed(), change.active())));
            } else {
                add(audit, prefix + "Document Type", typeName(row.getDocumentType()), typeName(type));
                add(audit, prefix + "Allowed", String.valueOf(row.isAllowed()), String.valueOf(change.allowed()));
                add(audit, prefix + "Active", String.valueOf(row.isActive()), String.valueOf(change.active()));
                if (row.isSystem() && type != null) add(audit, prefix + "System Default", "true", "false");
            }
        }
        Set<UUID> scopes = new HashSet<>(); // null is the Any scope.
        for (var row : stored) {
            if (!touched.contains(row.getId()) && row.isActive()
                    && !scopes.add(row.getDocumentType() == null ? null : row.getDocumentType().getId())) {
                throw new IllegalArgumentException("Duplicate active Document Type rule");
            }
        }
        for (var plan : plans) {
            if (!plan.change().delete() && plan.change().active()
                    && !scopes.add(plan.type() == null ? null : plan.type().getId())) {
                throw new IllegalArgumentException("An active eligibility rule already exists for this Document Type.");
            }
        }
        // Release old active scopes first, allowing swaps/replacements in one transaction.
        for (var plan : plans) {
            if (plan.change().id() != null) {
                if (plan.change().delete()) repository.delete(plan.row());
                else plan.row().setActive(false);
            }
        }
        repository.flush();
        for (var plan : plans) {
            if (plan.change().delete()) continue;
            var row = plan.row();
            if (plan.change().id() == null) row.setCreatedBy(actor);
            row.setUpdatedBy(actor);
            row.setSystem(row.isSystem() && plan.type() == null);
            row.setDocumentType(plan.type());
            row.setAllowed(plan.change().allowed());
            row.setActive(plan.change().active());
            repository.save(row);
        }
        repository.flush(); // Detect uniqueness/version conflicts before signature and audit commit.
        return audit;
    }

    private static String typeName(DocumentType type) { return type == null ? "Any" : type.getName(); }
    private static String describe(DocumentType type, boolean allowed, boolean active) {
        return typeName(type) + "; allowed=" + allowed + "; active=" + active;
    }
    private static String describe(UncontrolledCopyEligibilityRule row) { return describe(row.getDocumentType(), row.isAllowed(), row.isActive()); }
    private static void add(List<AuditTrailChangeResponse> audit, String field, String before, String after) {
        if (!Objects.equals(before, after)) audit.add(new AuditTrailChangeResponse(field, before, after));
    }
}
