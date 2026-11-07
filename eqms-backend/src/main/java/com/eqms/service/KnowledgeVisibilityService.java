package com.eqms.service;

import com.eqms.entity.BusinessUnit;
import com.eqms.entity.Department;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.KnowledgeShareLink;
import com.eqms.entity.ObjectAccessRule;
import com.eqms.entity.UserAccount;
import com.eqms.repository.BusinessUnitRepository;
import com.eqms.repository.DepartmentRepository;
import com.eqms.repository.KnowledgeShareLinkRepository;
import com.eqms.repository.ObjectAccessRuleRepository;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.From;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Predicate;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Who may see a document in the Knowledge Base when Document Properties > Knowledge Base visibility is "Sharing" (SHARING).
 * One decision, written twice on purpose: {@link #isVisible} for a single document and {@link #visibilityPredicate} for a list, so a
 * list never shows what a direct open refuses, or the reverse. KnowledgeVisibilityServiceTest keeps the single-document form honest.
 *
 * A document (Business Unit U, Department D) is visible to a user when ALL of these hold:
 * 1. the user holds the Knowledge permission (the ceiling the administrator sets through Access Profiles);
 * 2. the user is the Head of Unit of U or the Department Head of D, or the rule with the highest priority that applies to the user and
 *    matches the document is an ALLOW, or -- when no rule matches -- a link the user opened (and that is still usable) covers the document.
 *    No rule and no link is a refusal (closed by default).
 *
 * The rules that count are the shares: rules owned by a Department (the whole Department, a Document Type of it, or specific documents) or by a
 * Business Unit (the whole Unit). Each names who it is for: users, Positions, other Departments, everyone of the owner Department or Unit, or
 * everyone; the grantees are a union. An exclusion (DENY) ranks above every share, so a link never brings back what an exclusion took away.
 * Among equal priorities the rule that sorts first by name wins.
 *
 * A holder of the view-all permission is decided by the caller (DocumentService#visibleKnowledgeEntries).
 */
@Service
public class KnowledgeVisibilityService {
    /** The permission that opens the Knowledge Base: the one ceiling of this decision. */
    public static final String KNOWLEDGE_VIEW_PERMISSION = "self_service.knowledge.view";
    /**
     * Sees every Effective document of the Knowledge Base, in every visibility mode and whatever a Head shared or excluded (a person who audits
     * the system, such as the DCO or compliance). It belongs to the Knowledge Base alone: it is not a Document Control permission.
     */
    public static final String KNOWLEDGE_VIEW_ALL_PERMISSION = "self_service.knowledge.view_all";

    private static final Comparator<ObjectAccessRule> RULE_ORDER = Comparator
            .comparingInt(ObjectAccessRule::getPriority).reversed()
            .thenComparing(rule -> rule.getName() == null ? "" : rule.getName())
            .thenComparing(rule -> String.valueOf(rule.getId()));
    /** Stands for "none" in a query parameter (a null UUID parameter has no type). */
    private static final UUID NONE = new UUID(0L, 0L);

    private final ObjectAccessRuleRepository ruleRepository;
    private final DepartmentRepository departmentRepository;
    private final BusinessUnitRepository businessUnitRepository;
    private final KnowledgeShareLinkRepository linkRepository;
    private final PermissionEvaluationService permissionEvaluationService;

    public KnowledgeVisibilityService(
            ObjectAccessRuleRepository ruleRepository,
            DepartmentRepository departmentRepository,
            BusinessUnitRepository businessUnitRepository,
            KnowledgeShareLinkRepository linkRepository,
            PermissionEvaluationService permissionEvaluationService) {
        this.ruleRepository = ruleRepository;
        this.departmentRepository = departmentRepository;
        this.businessUnitRepository = businessUnitRepository;
        this.linkRepository = linkRepository;
        this.permissionEvaluationService = permissionEvaluationService;
    }

    /** What the decision reads from a document. The Business Unit is the document's own, the one the explorer's folders are built from. */
    public record Facts(UUID documentId, UUID departmentId, UUID businessUnitId, UUID documentTypeId) {
        public static Facts of(DocumentRecord document) {
            Department department = document.getDepartment();
            BusinessUnit unit = document.getBusinessUnit();
            return new Facts(
                    document.getId(),
                    department == null ? null : department.getId(),
                    unit == null ? null : unit.getId(),
                    document.getDocumentType() == null ? null : document.getDocumentType().getId());
        }
    }

    /** Everything about one user that the decision needs, read once. */
    private record UserView(boolean hasBasePermission, Set<UUID> headDepartmentIds, Set<UUID> headUnitIds,
                            List<ObjectAccessRule> rules, List<KnowledgeShareLink> links) {
    }

    /**
     * The per-user data is read once per web request: a Knowledge page checks hundreds of documents, and the shares of the Heads cannot change
     * in the middle of one request. Outside a web request (a job) nothing is cached.
     */
    private UserView userView(UserAccount user) {
        var attributes = org.springframework.web.context.request.RequestContextHolder.getRequestAttributes();
        if (attributes == null || user == null || user.getId() == null) {
            return loadUserView(user);
        }
        String key = "knowledgeVisibility:" + user.getId();
        Object cached = attributes.getAttribute(key, org.springframework.web.context.request.RequestAttributes.SCOPE_REQUEST);
        if (cached instanceof UserView view) {
            return view;
        }
        UserView view = loadUserView(user);
        attributes.setAttribute(key, view, org.springframework.web.context.request.RequestAttributes.SCOPE_REQUEST);
        return view;
    }

    private UserView loadUserView(UserAccount user) {
        if (user == null || user.getId() == null || !permissionEvaluationService.hasPermission(user, KNOWLEDGE_VIEW_PERMISSION)) {
            return new UserView(false, Set.of(), Set.of(), List.of(), List.of());
        }
        Set<UUID> heads = departmentRepository.findAllByDepartmentHead_Id(user.getId()).stream()
                .map(Department::getId).collect(Collectors.toSet());
        Set<UUID> unitHeads = businessUnitRepository.findAllByHeadOfUnit_Id(user.getId()).stream()
                .map(BusinessUnit::getId).collect(Collectors.toSet());
        UUID userUnit = userBusinessUnitId(user);
        String position = user.getPosition() == null ? "" : user.getPosition().trim().toLowerCase(Locale.ROOT);
        // The database narrows the shares to the ones that may concern this user; appliesToUser repeats the test so one rule is
        // never trusted to a query alone.
        List<ObjectAccessRule> rules = ruleRepository
                .findSharesThatMayApply(user.getId(), user.getDepartmentId() == null ? NONE : user.getDepartmentId(), userUnit == null ? NONE : userUnit, position).stream()
                .filter(rule -> isKnowledgeShare(rule) && appliesToUser(rule, user, userUnit))
                .sorted(RULE_ORDER)
                .toList();
        List<KnowledgeShareLink> links = linkRepository.findUsableOpenedBy(user.getId(), Instant.now());
        return new UserView(true, heads, unitHeads, rules, links);
    }

    /** The Business Unit of the user's Department (null when the user has none). */
    private UUID userBusinessUnitId(UserAccount user) {
        if (user.getDepartmentId() == null) {
            return null;
        }
        return departmentRepository.findById(user.getDepartmentId())
                .map(Department::getBusinessUnit).map(BusinessUnit::getId).orElse(null);
    }

    // ---- single document -----------------------------------------------------------------------------------------

    public boolean isVisible(UserAccount user, Facts facts) {
        return decide(user, facts).visible();
    }

    /** The decision and the reason for it: NO_PERMISSION, NO_DEPARTMENT, HEAD, UNIT_HEAD, SHARED (rule), EXCLUDED (rule), LINK (link) or NO_SHARE. */
    public record Decision(boolean visible, String reason, ObjectAccessRule rule, KnowledgeShareLink link) {
        public Decision(boolean visible, String reason, ObjectAccessRule rule) {
            this(visible, reason, rule, null);
        }
    }

    public Decision decide(UserAccount user, Facts facts) {
        UserView view = userView(user);
        if (!view.hasBasePermission()) {
            return new Decision(false, "NO_PERMISSION", null);
        }
        if (facts == null || facts.departmentId() == null) {
            return new Decision(false, "NO_DEPARTMENT", null);
        }
        if (view.headUnitIds().contains(facts.businessUnitId())) {
            return new Decision(true, "UNIT_HEAD", null);
        }
        if (view.headDepartmentIds().contains(facts.departmentId())) {
            return new Decision(true, "HEAD", null);
        }
        for (ObjectAccessRule rule : view.rules()) {
            if (matches(rule, facts)) {
                boolean excluded = "DENY".equalsIgnoreCase(rule.getEffect());
                return new Decision(!excluded, excluded ? "EXCLUDED" : "SHARED", rule);
            }
        }
        for (KnowledgeShareLink link : view.links()) {
            if (matchesLink(link, facts)) {
                return new Decision(true, "LINK", null, link);
            }
        }
        return new Decision(false, "NO_SHARE", null);
    }

    // ---- lists ---------------------------------------------------------------------------------------------------

    /** The same decision as a query condition on a Document ({@code document} is its root). */
    public Predicate visibilityPredicate(UserAccount user, From<?, ?> document, CriteriaBuilder cb) {
        UserView view = userView(user);
        if (!view.hasBasePermission()) {
            return cb.disjunction();
        }
        Path<UUID> documentId = document.get("id");
        Path<UUID> departmentId = document.join("department", JoinType.LEFT).get("id");
        Path<UUID> unitId = document.join("businessUnit", JoinType.LEFT).get("id");
        Path<UUID> typeId = document.join("documentType", JoinType.LEFT).get("id");

        List<Predicate> grants = new ArrayList<>();
        if (!view.headUnitIds().isEmpty()) {
            grants.add(unitId.in(view.headUnitIds()));
        }
        if (!view.headDepartmentIds().isEmpty()) {
            grants.add(departmentId.in(view.headDepartmentIds()));
        }
        List<ObjectAccessRule> rules = view.rules();
        List<Predicate> anyRuleMatches = new ArrayList<>();
        for (int i = 0; i < rules.size(); i++) {
            ObjectAccessRule rule = rules.get(i);
            anyRuleMatches.add(matchPredicate(rule, documentId, departmentId, unitId, typeId, cb));
            if ("DENY".equalsIgnoreCase(rule.getEffect())) {
                continue;
            }
            List<Predicate> all = new ArrayList<>();
            all.add(anyRuleMatches.get(i));
            if (i > 0) {
                all.add(cb.not(cb.or(anyRuleMatches.subList(0, i).toArray(Predicate[]::new))));
            }
            grants.add(cb.and(all.toArray(Predicate[]::new)));
        }
        // a link gives what it covers only where no rule of the Heads matches (so an exclusion is never undone by a link)
        for (KnowledgeShareLink link : view.links()) {
            List<Predicate> all = new ArrayList<>();
            all.add(linkPredicate(link, documentId, departmentId, unitId, typeId, cb));
            if (!anyRuleMatches.isEmpty()) {
                all.add(cb.not(cb.or(anyRuleMatches.toArray(Predicate[]::new))));
            }
            grants.add(cb.and(all.toArray(Predicate[]::new)));
        }
        return grants.isEmpty() ? cb.disjunction() : cb.or(grants.toArray(Predicate[]::new));
    }

    // ---- rule matching (single document) and its query twin ------------------------------------------------------

    /** A share is a rule owned by a Department (target: the Department, a Document Type, documents) or by a Business Unit (target: the Unit). */
    static boolean isKnowledgeShare(ObjectAccessRule rule) {
        String type = rule.getResourceType() == null ? "" : rule.getResourceType().trim().toUpperCase(Locale.ROOT);
        if (rule.getOwnerBusinessUnit() != null) {
            return rule.getOwnerDepartment() == null && type.equals("BUSINESS_UNIT");
        }
        if (rule.getOwnerDepartment() == null) {
            return false;
        }
        return type.equals("DEPARTMENT") || type.equals("DOCUMENT_TYPE") || type.equals("DOCUMENT");
    }

    /**
     * Whether the rule is for this user. A share that names nobody applies to nobody. The kinds of grantee are a union: the user's own account,
     * the user's Position (by name, case and surrounding blanks ignored), the user's Department (by foreign key), the people of the owner
     * Department or of the owner Business Unit, or everyone.
     */
    static boolean appliesToUser(ObjectAccessRule rule, UserAccount user, UUID userBusinessUnitId) {
        if (rule.isGranteeEveryone()) {
            return true;
        }
        UUID userDepartment = user.getDepartmentId();
        if (rule.getGranteeUsers().stream().anyMatch(u -> Objects.equals(u.getId(), user.getId()))) {
            return true;
        }
        if (rule.isGranteeWholeDepartment()) {
            if (userDepartment != null && rule.getOwnerDepartment() != null
                    && Objects.equals(rule.getOwnerDepartment().getId(), userDepartment)) {
                return true;
            }
            if (userBusinessUnitId != null && rule.getOwnerBusinessUnit() != null
                    && Objects.equals(rule.getOwnerBusinessUnit().getId(), userBusinessUnitId)) {
                return true;
            }
        }
        if (userDepartment != null && rule.getGranteeDepartments().stream().anyMatch(d -> Objects.equals(d.getId(), userDepartment))) {
            return true;
        }
        return StringUtils.hasText(user.getPosition())
                && rule.getGranteePositions().stream().anyMatch(p -> p.getName() != null && p.getName().trim().equalsIgnoreCase(user.getPosition().trim()));
    }

    static boolean matches(ObjectAccessRule rule, Facts facts) {
        if (rule.getOwnerBusinessUnit() != null) {
            return facts.businessUnitId() != null && Objects.equals(rule.getOwnerBusinessUnit().getId(), facts.businessUnitId())
                    && "BUSINESS_UNIT".equals(rule.getResourceType().trim().toUpperCase(Locale.ROOT));
        }
        if (rule.getOwnerDepartment() == null || !Objects.equals(rule.getOwnerDepartment().getId(), facts.departmentId())) {
            return false;
        }
        return switch (rule.getResourceType().trim().toUpperCase(Locale.ROOT)) {
            case "DEPARTMENT" -> true;
            case "DOCUMENT_TYPE" -> rule.getResourceId() != null && Objects.equals(rule.getResourceId(), facts.documentTypeId());
            case "DOCUMENT" -> facts.documentId() != null && rule.getDocuments().stream().anyMatch(d -> Objects.equals(d.getId(), facts.documentId()));
            default -> false;
        };
    }

    /** What a link covers: the Unit, the Department, a Document Type of a Department, or one document. */
    static boolean matchesLink(KnowledgeShareLink link, Facts facts) {
        return switch (link.getScopeKind()) {
            case "BUSINESS_UNIT" -> link.getOwnerBusinessUnit() != null && Objects.equals(link.getOwnerBusinessUnit().getId(), facts.businessUnitId());
            case "DEPARTMENT" -> link.getOwnerDepartment() != null && Objects.equals(link.getOwnerDepartment().getId(), facts.departmentId());
            case "DOCUMENT_TYPE" -> link.getOwnerDepartment() != null && link.getDocumentType() != null
                    && Objects.equals(link.getOwnerDepartment().getId(), facts.departmentId())
                    && Objects.equals(link.getDocumentType().getId(), facts.documentTypeId());
            case "DOCUMENT" -> link.getDocument() != null && Objects.equals(link.getDocument().getId(), facts.documentId());
            default -> false;
        };
    }

    private static Predicate matchPredicate(ObjectAccessRule rule, Path<UUID> documentId, Path<UUID> departmentId, Path<UUID> unitId,
                                            Path<UUID> typeId, CriteriaBuilder cb) {
        if (rule.getOwnerBusinessUnit() != null) {
            return cb.equal(unitId, rule.getOwnerBusinessUnit().getId());
        }
        List<Predicate> all = new ArrayList<>();
        all.add(cb.equal(departmentId, rule.getOwnerDepartment().getId()));
        switch (rule.getResourceType().trim().toUpperCase(Locale.ROOT)) {
            case "DEPARTMENT" -> {
            }
            case "DOCUMENT_TYPE" -> all.add(rule.getResourceId() == null ? cb.disjunction() : cb.equal(typeId, rule.getResourceId()));
            case "DOCUMENT" -> {
                Set<UUID> ids = rule.getDocuments().stream().map(DocumentRecord::getId).collect(Collectors.toSet());
                all.add(ids.isEmpty() ? cb.disjunction() : documentId.in(ids));
            }
            default -> all.add(cb.disjunction());
        }
        return cb.and(all.toArray(Predicate[]::new));
    }

    private static Predicate linkPredicate(KnowledgeShareLink link, Path<UUID> documentId, Path<UUID> departmentId, Path<UUID> unitId,
                                           Path<UUID> typeId, CriteriaBuilder cb) {
        return switch (link.getScopeKind()) {
            case "BUSINESS_UNIT" -> link.getOwnerBusinessUnit() == null ? cb.disjunction() : cb.equal(unitId, link.getOwnerBusinessUnit().getId());
            case "DEPARTMENT" -> link.getOwnerDepartment() == null ? cb.disjunction() : cb.equal(departmentId, link.getOwnerDepartment().getId());
            case "DOCUMENT_TYPE" -> link.getOwnerDepartment() == null || link.getDocumentType() == null ? cb.disjunction()
                    : cb.and(cb.equal(departmentId, link.getOwnerDepartment().getId()), cb.equal(typeId, link.getDocumentType().getId()));
            case "DOCUMENT" -> link.getDocument() == null ? cb.disjunction() : cb.equal(documentId, link.getDocument().getId());
            default -> cb.disjunction();
        };
    }
}
