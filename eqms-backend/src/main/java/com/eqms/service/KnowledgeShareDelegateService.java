package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.dto.knowledge.KnowledgeSharingDtos.DelegateRequest;
import com.eqms.dto.knowledge.KnowledgeSharingDtos.DelegateRow;
import com.eqms.dto.knowledge.KnowledgeSharingDtos.Paged;
import com.eqms.entity.BusinessUnit;
import com.eqms.entity.Department;
import com.eqms.entity.KnowledgeShareDelegate;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.BusinessUnitRepository;
import com.eqms.repository.DepartmentRepository;
import com.eqms.repository.KnowledgeShareDelegateRepository;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.KnowledgeShareAuthorityService.Level;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * The people a Head names to share in the Knowledge Base like the Head does: for one Department (named by its Department Head or the Head of its
 * Unit) or for a whole Business Unit (named by its Head of Unit). A delegate is a fact in the data, not a permission: every naming and every removal
 * is written to the Audit Trail. A delegate never names other delegates.
 */
@Service
public class KnowledgeShareDelegateService {
    private static final DateTimeFormatter WHEN = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm").withZone(ZoneId.systemDefault());

    private final KnowledgeShareDelegateRepository delegateRepository;
    private final DepartmentRepository departmentRepository;
    private final BusinessUnitRepository businessUnitRepository;
    private final UserAccountRepository userRepository;
    private final CurrentUserService currentUserService;
    private final KnowledgeShareAuthorityService authority;
    private final AuditTrailService auditTrailService;

    public KnowledgeShareDelegateService(KnowledgeShareDelegateRepository delegateRepository, DepartmentRepository departmentRepository,
                                         BusinessUnitRepository businessUnitRepository, UserAccountRepository userRepository,
                                         CurrentUserService currentUserService, KnowledgeShareAuthorityService authority,
                                         AuditTrailService auditTrailService) {
        this.delegateRepository = delegateRepository;
        this.departmentRepository = departmentRepository;
        this.businessUnitRepository = businessUnitRepository;
        this.userRepository = userRepository;
        this.currentUserService = currentUserService;
        this.authority = authority;
        this.auditTrailService = auditTrailService;
    }

    /** The delegates of a Department or of a Business Unit (a Head sees them; nobody else). */
    @Transactional(readOnly = true)
    public List<DelegateRow> list(String scopeKind, UUID businessUnitId, UUID departmentId) {
        UserAccount actor = currentUserService.requireCurrentUser();
        List<KnowledgeShareDelegate> rows;
        if (KnowledgeShareDelegate.SCOPE_BUSINESS_UNIT.equalsIgnoreCase(scopeKind)) {
            BusinessUnit unit = requireUnit(businessUnitId);
            requireLevel(actor, authority.levelOver(actor, unit), Level.UNIT_HEAD, unit.getName());
            rows = delegateRepository.findAllByBusinessUnit_IdOrderByGrantedAtAsc(unit.getId());
        } else {
            Department department = requireDepartment(departmentId);
            requireLevel(actor, authority.levelOver(actor, department), Level.DEPARTMENT_HEAD, department.getName());
            rows = delegateRepository.findAllByDepartment_IdOrderByGrantedAtAsc(department.getId());
        }
        return rows.stream().map(this::toRow)
                .sorted(Comparator.comparing(DelegateRow::fullName, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER))).toList();
    }

    /** One page of the delegates, searched by name or employee code, so a long list is read as it is scrolled. */
    @Transactional(readOnly = true)
    public Paged<DelegateRow> page(String scopeKind, UUID businessUnitId, UUID departmentId, String search, int offset, int limit) {
        String q = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        List<DelegateRow> all = list(scopeKind, businessUnitId, departmentId).stream()
                .filter(r -> q.isEmpty() || (r.fullName() != null && r.fullName().toLowerCase(Locale.ROOT).contains(q))
                        || (r.employeeCode() != null && r.employeeCode().toLowerCase(Locale.ROOT).contains(q)))
                .toList();
        int from = Math.max(0, Math.min(offset, all.size()));
        return new Paged<>(all.subList(from, Math.min(all.size(), from + Math.max(1, Math.min(limit, 50)))), all.size());
    }

    @Transactional
    public DelegateRow add(DelegateRequest request) {
        UserAccount actor = currentUserService.requireCurrentUser();
        if (request.userId() == null) {
            throw new IllegalArgumentException("Choose a person");
        }
        UserAccount user = userRepository.findById(request.userId()).orElseThrow(() -> new IllegalArgumentException("User not found"));
        if (user.getStatus() != UserStatus.Active) {
            throw new IllegalArgumentException("Only an active user can be named");
        }
        KnowledgeShareDelegate delegate = new KnowledgeShareDelegate();
        delegate.setUser(user);
        delegate.setGrantedBy(actor);
        String scopeName;
        if (KnowledgeShareDelegate.SCOPE_BUSINESS_UNIT.equalsIgnoreCase(request.scopeKind())) {
            BusinessUnit unit = requireUnit(request.businessUnitId());
            requireLevel(actor, authority.levelOver(actor, unit), Level.UNIT_HEAD, unit.getName());
            if (delegateRepository.findByBusinessUnit_IdAndUser_Id(unit.getId(), user.getId()).isPresent()) {
                throw new IllegalArgumentException(user.getFullName() + " may already share for this Business Unit");
            }
            delegate.setScopeKind(KnowledgeShareDelegate.SCOPE_BUSINESS_UNIT);
            delegate.setBusinessUnit(unit);
            scopeName = "Business Unit " + unit.getName();
        } else {
            Department department = requireDepartment(request.departmentId());
            requireLevel(actor, authority.levelOver(actor, department), Level.DEPARTMENT_HEAD, department.getName());
            if (delegateRepository.findByDepartment_IdAndUser_Id(department.getId(), user.getId()).isPresent()) {
                throw new IllegalArgumentException(user.getFullName() + " may already share for this Department");
            }
            delegate.setScopeKind(KnowledgeShareDelegate.SCOPE_DEPARTMENT);
            delegate.setDepartment(department);
            scopeName = "Department " + department.getName();
        }
        delegateRepository.save(delegate);
        auditTrailService.logAs(actor, "KNOWLEDGE_SHARE_DELEGATE", user.getFullName() + " - " + scopeName, delegate.getId(), "CREATED", null, "Active",
                "Named " + user.getFullName() + " as a person who may share the Knowledge Base of " + scopeName + " on behalf of the Head",
                List.of(new AuditTrailChangeResponse("Person", null, user.getFullName()), new AuditTrailChangeResponse("Scope", null, scopeName)));
        return toRow(delegate);
    }

    @Transactional
    public void remove(UUID delegateId) {
        UserAccount actor = currentUserService.requireCurrentUser();
        KnowledgeShareDelegate delegate = delegateRepository.findById(delegateId).orElseThrow(() -> new IllegalArgumentException("Delegate not found"));
        String scopeName;
        if (delegate.getBusinessUnit() != null) {
            requireLevel(actor, authority.levelOver(actor, delegate.getBusinessUnit()), Level.UNIT_HEAD, delegate.getBusinessUnit().getName());
            scopeName = "Business Unit " + delegate.getBusinessUnit().getName();
        } else {
            requireLevel(actor, authority.levelOver(actor, delegate.getDepartment()), Level.DEPARTMENT_HEAD, delegate.getDepartment().getName());
            scopeName = "Department " + delegate.getDepartment().getName();
        }
        auditTrailService.logAs(actor, "KNOWLEDGE_SHARE_DELEGATE", delegate.getUser().getFullName() + " - " + scopeName, delegate.getId(), "DELETED", "Active", null,
                delegate.getUser().getFullName() + " may no longer share the Knowledge Base of " + scopeName + " on behalf of the Head. "
                        + "What he or she shared stays until a Head removes it.",
                List.of(new AuditTrailChangeResponse("Person", delegate.getUser().getFullName(), null)));
        delegateRepository.delete(delegate);
    }

    private DelegateRow toRow(KnowledgeShareDelegate d) {
        UserAccount u = d.getUser();
        String scopeLabel = d.getBusinessUnit() != null ? "Business Unit " + d.getBusinessUnit().getName() : "Department " + d.getDepartment().getName();
        return new DelegateRow(d.getId(), u.getId(), u.getFullName(), u.getEmployeeCode(), u.getDepartment(), u.getPosition(), d.getScopeKind(), scopeLabel,
                d.getGrantedBy() == null ? null : d.getGrantedBy().getFullName(), WHEN.format(d.getGrantedAt()));
    }

    private static void requireLevel(UserAccount actor, Level actual, Level needed, String scope) {
        if (!actual.atLeast(needed)) {
            throw new AccessDeniedException("Only the " + needed.name().toLowerCase(Locale.ROOT).replace('_', ' ') + " of " + scope
                    + " (or a person who may share every Department) can name or remove the people who share for it");
        }
    }

    private Department requireDepartment(UUID id) {
        if (id == null) {
            throw new IllegalArgumentException("Choose a Department");
        }
        return departmentRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Department not found"));
    }

    private BusinessUnit requireUnit(UUID id) {
        if (id == null) {
            throw new IllegalArgumentException("Choose a Business Unit");
        }
        return businessUnitRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Business Unit not found"));
    }
}
