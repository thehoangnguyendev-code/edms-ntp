package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.dto.knowledge.KnowledgeSharingDtos.AccessEntry;
import com.eqms.dto.knowledge.KnowledgeSharingDtos.GrantRequest;
import com.eqms.dto.knowledge.KnowledgeSharingDtos.GranteeChip;
import com.eqms.dto.knowledge.KnowledgeSharingDtos.GranteeUser;
import com.eqms.dto.knowledge.KnowledgeSharingDtos.Managed;
import com.eqms.dto.knowledge.KnowledgeSharingDtos.Node;
import com.eqms.dto.knowledge.KnowledgeSharingDtos.NodeAccess;
import com.eqms.dto.knowledge.KnowledgeSharingDtos.Option;
import com.eqms.dto.knowledge.KnowledgeSharingDtos.Paged;
import com.eqms.dto.knowledge.KnowledgeSharingDtos.PersonRow;
import com.eqms.dto.knowledge.KnowledgeSharingDtos.Options;
import com.eqms.entity.BusinessUnit;
import com.eqms.entity.Department;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentType;
import com.eqms.entity.KnowledgeCategoryHierarchy;
import com.eqms.entity.ObjectAccessRule;
import com.eqms.entity.Position;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.enums.KnowledgeField;
import com.eqms.repository.BusinessUnitRepository;
import com.eqms.repository.DepartmentRepository;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.DocumentTypeRepository;
import com.eqms.repository.KnowledgeCategoryHierarchyRepository;
import com.eqms.repository.KnowledgeShareDelegateRepository;
import com.eqms.repository.ObjectAccessRuleRepository;
import com.eqms.repository.PositionRepository;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.KnowledgeShareAuthorityService.Level;
import jakarta.persistence.criteria.Predicate;
import jakarta.transaction.Transactional;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * Sharing of the Knowledge Base from the Knowledge explorer (right-click > Share): the folder of a Business Unit, of a Department, of a Document
 * Type of a Department, or one document. A share is an ordinary Object Access Rule owned by a Department (V727) or by a Business Unit (V737); it
 * only ever concerns the View of Effective documents in the Knowledge Base, never Document Control. Every change is recorded in the Audit Trail; no
 * e-signature is asked (owner decision 2026-11-03). Who may do what is decided by {@link KnowledgeShareAuthorityService}.
 *
 * Inheritance, as in a shared drive: a share on the Business Unit covers every Department, Document Type and document of it; on the Department,
 * every Document Type and document of it; on a Document Type, its documents. An exclusion (DENY) always wins over a share; only a Head may make
 * one (a delegate could otherwise undo what the Head shared).
 */
@Service
public class KnowledgeSharingService {
    private static final int MAX_USERS = 500;
    private static final int MAX_POSITIONS = 50;
    private static final int MAX_DEPARTMENTS = 50;
    private static final DateTimeFormatter WHEN = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm").withZone(ZoneId.systemDefault());

    private final ObjectAccessRuleRepository ruleRepository;
    private final DepartmentRepository departmentRepository;
    private final BusinessUnitRepository businessUnitRepository;
    private final DocumentTypeRepository documentTypeRepository;
    private final DocumentRecordRepository documentRepository;
    private final UserAccountRepository userRepository;
    private final PositionRepository positionRepository;
    private final KnowledgeCategoryHierarchyRepository hierarchyRepository;
    private final KnowledgeShareDelegateRepository delegateRepository;
    private final CurrentUserService currentUserService;
    private final KnowledgeShareAuthorityService authority;
    private final KnowledgeShareNotifier notifier;
    private final AuditTrailService auditTrailService;

    public KnowledgeSharingService(
            ObjectAccessRuleRepository ruleRepository, DepartmentRepository departmentRepository, BusinessUnitRepository businessUnitRepository,
            DocumentTypeRepository documentTypeRepository, DocumentRecordRepository documentRepository,
            UserAccountRepository userRepository, PositionRepository positionRepository,
            KnowledgeCategoryHierarchyRepository hierarchyRepository, KnowledgeShareDelegateRepository delegateRepository,
            CurrentUserService currentUserService, KnowledgeShareAuthorityService authority, KnowledgeShareNotifier notifier,
            AuditTrailService auditTrailService) {
        this.ruleRepository = ruleRepository;
        this.departmentRepository = departmentRepository;
        this.businessUnitRepository = businessUnitRepository;
        this.documentTypeRepository = documentTypeRepository;
        this.documentRepository = documentRepository;
        this.userRepository = userRepository;
        this.positionRepository = positionRepository;
        this.hierarchyRepository = hierarchyRepository;
        this.delegateRepository = delegateRepository;
        this.currentUserService = currentUserService;
        this.authority = authority;
        this.notifier = notifier;
        this.auditTrailService = auditTrailService;
    }

    // ---- what the explorer may offer ----------------------------------------------------------------------------

    /** The Departments and Business Units the current user may share (empty for most users). */
    @Transactional
    public Managed managed() {
        KnowledgeShareAuthorityService.Managed managed = authority.managed(currentUserService.requireCurrentUser());
        return new Managed(List.copyOf(managed.departmentIds()), List.copyOf(managed.businessUnitIds()));
    }

    /**
     * Works out what a folder of the explorer is: the Knowledge Base key and the keys of the levels below it are the document fields the hierarchy
     * is built from. A folder can be shared when its path fixes a Business Unit alone (the folder of the Unit), or a Department (and, optionally, a
     * Document Type), and nothing a share could not follow.
     */
    @Transactional
    public Node resolveFolder(UUID hierarchyId, String kb, List<String> path) {
        UserAccount actor = currentUserService.requireCurrentUser();
        List<KnowledgeCategoryHierarchy> active = hierarchyRepository.findAllByActiveTrueOrderByNameAsc();
        KnowledgeCategoryHierarchy hierarchy = hierarchyId == null ? null
                : active.stream().filter(h -> h.getId().equals(hierarchyId)).findFirst().orElse(null);
        if (hierarchy == null) {
            hierarchy = active.stream().filter(KnowledgeCategoryHierarchy::isDefaultHierarchy).findFirst()
                    .orElse(active.isEmpty() ? null : active.get(0));
        }
        if (hierarchy == null || !StringUtils.hasText(kb)) {
            return refused("There is no Knowledge Base here to share.");
        }
        List<String> keys = path == null ? List.of() : path.stream().filter(StringUtils::hasText).toList();
        Map<KnowledgeField, String> pinned = new LinkedHashMap<>();
        pinned.put(KnowledgeField.parse(hierarchy.getDeterminatorField()).orElse(null), kb);
        for (int i = 0; i < keys.size() && i < hierarchy.getLevels().size(); i++) {
            pinned.put(KnowledgeField.parse(hierarchy.getLevels().get(i).getFieldCode()).orElse(null), keys.get(i));
        }
        for (Map.Entry<KnowledgeField, String> entry : pinned.entrySet()) {
            KnowledgeField field = entry.getKey();
            if (field == null || KnowledgePortalService.NO_VALUE_KEY.equals(entry.getValue())) {
                return refused("This folder holds documents with no value for its category, so it cannot be shared as a folder.");
            }
            if (field != KnowledgeField.BUSINESS_UNIT && field != KnowledgeField.DEPARTMENT && field != KnowledgeField.DOCUMENT_TYPE) {
                return refused("This folder is split by " + field.label() + ", which a share cannot follow. Share the Business Unit, a Department or a Document Type folder, or a document.");
            }
        }
        String unitKey = pinned.get(KnowledgeField.BUSINESS_UNIT);
        String departmentKey = pinned.get(KnowledgeField.DEPARTMENT);
        String typeKey = pinned.get(KnowledgeField.DOCUMENT_TYPE);
        if (departmentKey == null) {
            if (typeKey != null || unitKey == null) {
                return refused("Open a Business Unit or a Department folder to share it.");
            }
            BusinessUnit unit = businessUnitRepository.findById(parseId(unitKey)).orElse(null);
            if (unit == null) {
                return refused("The Business Unit of this folder was not found.");
            }
            return nodeOf(actor, new Target("BUSINESS_UNIT", unit, null, null, null), "Only the Head of Unit of " + unit.getName()
                    + ", a person named by the Head of Unit, or a person who may share every Department, can share the folder of the whole Unit.");
        }
        Department department = departmentRepository.findById(parseId(departmentKey)).orElse(null);
        if (department == null) {
            return refused("The Department of this folder was not found.");
        }
        DocumentType type = null;
        if (typeKey != null) {
            type = documentTypeRepository.findById(parseId(typeKey)).orElse(null);
            if (type == null) {
                return refused("The Document Type of this folder was not found.");
            }
        }
        return nodeOf(actor, new Target(type == null ? "DEPARTMENT" : "DOCUMENT_TYPE", department.getBusinessUnit(), department, type, null),
                "You may not share the folders of " + department.getName() + ": only its Department Head, the Head of its Business Unit, a person they named, or a person who may share every Department, can.");
    }

    /** Who has access to an item, and through which share (the shares on the item itself, and the wider ones it inherits). */
    @Transactional
    public NodeAccess access(String kind, UUID businessUnitId, UUID departmentId, UUID documentTypeId, UUID documentId) {
        UserAccount actor = currentUserService.requireCurrentUser();
        Target target = requireTarget(actor, kind, businessUnitId, departmentId, documentTypeId, documentId);
        Set<UUID> delegateUsers = new HashSet<>();
        if (target.department() != null) {
            delegateRepository.findAllByDepartment_IdOrderByGrantedAtAsc(target.department().getId()).forEach(d -> delegateUsers.add(d.getUser().getId()));
        }
        if (target.unit() != null) {
            delegateRepository.findAllByBusinessUnit_IdOrderByGrantedAtAsc(target.unit().getId()).forEach(d -> delegateUsers.add(d.getUser().getId()));
        }
        List<ObjectAccessRule> rules = new ArrayList<>();
        if (target.department() != null) {
            rules.addAll(ruleRepository.findAllByOwnerDepartment_IdOrderByPriorityDescNameAsc(target.department().getId()));
        }
        if (target.unit() != null) {
            rules.addAll(ruleRepository.findAllByOwnerBusinessUnit_IdOrderByPriorityDescNameAsc(target.unit().getId()));
        }
        List<AccessEntry> entries = new ArrayList<>();
        for (ObjectAccessRule rule : rules) {
            if (!rule.isActive()) {
                continue;
            }
            int rank = rank(rule);
            if (rank < 0 || !coversTarget(rule, target)) {
                continue;
            }
            boolean exact = rank == target.rank() && (rank != 3 || rule.getDocuments().size() == 1);
            boolean removable = exact && authority.mayRemove(actor, rule);
            entries.add(new AccessEntry(rule.getId(), rule.getEffect(), rule.getResourceType(), scopeLabel(rule), rank < target.rank(), removable,
                    granteeLabels(rule), granteeChips(rule, delegateUsers), rule.getCreatedBy() == null ? null : rule.getCreatedBy().getFullName(),
                    Level.ofStored(rule.getCreatedAuthority()).name(), rule.getCreatedAt() == null ? null : WHEN.format(rule.getCreatedAt()),
                    rule.getCreatedBy() != null && Objects.equals(rule.getCreatedBy().getId(), actor.getId())));
        }
        entries.sort(Comparator.comparing(AccessEntry::inherited).thenComparing(AccessEntry::effect, Comparator.reverseOrder())
                .thenComparing(e -> e.grantees().isEmpty() ? "" : e.grantees().get(0), String.CASE_INSENSITIVE_ORDER));
        return new NodeAccess(nodeOf(actor, target, null), entries);
    }

    @Transactional
    public Options options() {
        requireManagesSomething();
        return new Options(
                positionRepository.findAllByActiveTrueOrderByNameAsc().stream().map(p -> new Option(p.getId().toString(), p.getName())).toList(),
                departmentRepository.findAllByActiveTrueOrderByNameAsc().stream().map(d -> new Option(d.getId().toString(), d.getName())).toList());
    }

    /** Server-side search of the people a share can name: active users by name, employee code or user name (30 at most). */
    @Transactional
    public List<GranteeUser> searchUsers(String search, int limit) {
        requireManagesSomething();
        return searchActiveUsers(search, limit, 0, null);
    }

    /**
     * The same search for naming a person who may share, kept to the people of the scope: the Department's own people for a Department Head,
     * every person of the Unit for a Head of Unit (or the administrator), and for a Business Unit scope the people of its Departments. Paged by
     * {@code offset} so the list can be scrolled without loading it all.
     */
    @Transactional
    public List<GranteeUser> searchUsers(String search, int limit, int offset, String scopeKind, UUID businessUnitId, UUID departmentId) {
        UserAccount actor = currentUserService.requireCurrentUser();
        requireManagesSomething();
        if (!StringUtils.hasText(scopeKind)) {
            return searchActiveUsers(search, limit, offset, null);
        }
        List<Department> scope;
        if ("BUSINESS_UNIT".equalsIgnoreCase(scopeKind)) {
            BusinessUnit unit = businessUnitRepository.findById(need(businessUnitId, "Choose a Business Unit"))
                    .orElseThrow(() -> new IllegalArgumentException("Business Unit not found"));
            if (!authority.levelOver(actor, unit).atLeast(Level.UNIT_HEAD)) {
                throw new AccessDeniedException("Only the Head of the Unit can name people for the whole Unit");
            }
            scope = departmentRepository.findAllByBusinessUnit_Id(unit.getId());
        } else {
            Department department = requireDepartment(departmentId);
            Level level = authority.levelOver(actor, department);
            if (!level.atLeast(Level.DEPARTMENT_HEAD)) {
                throw new AccessDeniedException("Only a Head can name people who may share");
            }
            scope = level.atLeast(Level.UNIT_HEAD) && department.getBusinessUnit() != null
                    ? departmentRepository.findAllByBusinessUnit_Id(department.getBusinessUnit().getId())
                    : List.of(department);
        }
        return searchActiveUsers(search, limit, offset, scope);
    }

    /** The search itself, for a caller that has checked its own permission (the administrator's overview). */
    List<GranteeUser> searchActiveUsers(String search, int limit) {
        return searchActiveUsers(search, limit, 0, null);
    }

    private List<GranteeUser> searchActiveUsers(String search, int limit, int offset, List<Department> scope) {
        if (scope != null && scope.isEmpty()) {
            return List.of();
        }
        String q = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        int size = Math.max(1, Math.min(limit, 30));
        org.springframework.data.jpa.domain.Specification<UserAccount> spec = (root, query, cb) -> {
            List<Predicate> p = new ArrayList<>();
            p.add(cb.equal(root.get("status"), UserStatus.Active));
            if (scope != null) {
                // the profile holds the Department's id, and in older data only its name
                Set<UUID> ids = new HashSet<>();
                Set<String> names = new HashSet<>();
                scope.forEach(d -> {
                    ids.add(d.getId());
                    if (d.getName() != null) {
                        names.add(d.getName().toLowerCase(Locale.ROOT));
                    }
                });
                p.add(cb.or(root.get("departmentId").in(ids), cb.lower(root.get("department")).in(names)));
            }
            if (!q.isEmpty()) {
                String like = "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
                p.add(cb.or(cb.like(cb.lower(root.get("fullName")), like, '\\'),
                        cb.like(cb.lower(root.get("employeeCode")), like, '\\'),
                        cb.like(cb.lower(root.get("username")), like, '\\')));
            }
            return cb.and(p.toArray(Predicate[]::new));
        };
        return userRepository.findAll(spec, PageRequest.of(Math.max(0, offset) / size, size, Sort.by("fullName").and(Sort.by("id")))).stream()
                .map(u -> new GranteeUser(u.getId(), u.getFullName(), u.getEmployeeCode(), u.getDepartment())).toList();
    }

    // ---- who has access, one row per person or group -------------------------------------------------------------

    /**
     * The "Who has access" list of an item: one row for each person, Position, Department or group a share reaches (the ones the item inherits
     * included), searched by name and cut to the page that was asked for, so a long list is read as it is scrolled.
     */
    @Transactional
    public Paged<PersonRow> people(String kind, UUID businessUnitId, UUID departmentId, UUID documentTypeId, UUID documentId,
                                   String search, boolean mine, int offset, int limit) {
        UserAccount actor = currentUserService.requireCurrentUser();
        Target target = requireTarget(actor, kind, businessUnitId, departmentId, documentTypeId, documentId);
        Set<UUID> delegateUsers = new HashSet<>();
        List<ObjectAccessRule> rules = new ArrayList<>();
        if (target.department() != null) {
            delegateRepository.findAllByDepartment_IdOrderByGrantedAtAsc(target.department().getId()).forEach(d -> delegateUsers.add(d.getUser().getId()));
            rules.addAll(ruleRepository.findAllByOwnerDepartment_IdOrderByPriorityDescNameAsc(target.department().getId()));
        }
        if (target.unit() != null) {
            delegateRepository.findAllByBusinessUnit_IdOrderByGrantedAtAsc(target.unit().getId()).forEach(d -> delegateUsers.add(d.getUser().getId()));
            rules.addAll(ruleRepository.findAllByOwnerBusinessUnit_IdOrderByPriorityDescNameAsc(target.unit().getId()));
        }
        String q = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        boolean onlyMine = mine;
        List<PersonRow> rows = new ArrayList<>();
        for (ObjectAccessRule rule : rules) {
            int rank = rank(rule);
            if (!rule.isActive() || rank < 0 || !coversTarget(rule, target)) {
                continue;
            }
            boolean exact = rank == target.rank() && (rank != 3 || rule.getDocuments().size() == 1);
            boolean removable = exact && authority.mayRemove(actor, rule);
            String by = rule.getCreatedBy() == null ? null : rule.getCreatedBy().getFullName();
            String level = Level.ofStored(rule.getCreatedAuthority()).name();
            String at = rule.getCreatedAt() == null ? null : WHEN.format(rule.getCreatedAt());
            boolean madeByMe = rule.getCreatedBy() != null && Objects.equals(rule.getCreatedBy().getId(), actor.getId());
            String scope = scopeLabel(rule);
            String owner = rule.getOwnerBusinessUnit() != null ? rule.getOwnerBusinessUnit().getName() : rule.getOwnerDepartment().getName();
            boolean inherited = rank < target.rank();
            List<PersonRow> mine1 = new ArrayList<>();
            if (rule.isGranteeEveryone()) {
                mine1.add(new PersonRow(rule.getId(), rule.getEffect(), "EVERYONE", null, "Everyone", null, false, inherited, removable, scope, by, level, at, madeByMe));
            }
            if (rule.isGranteeWholeDepartment()) {
                mine1.add(new PersonRow(rule.getId(), rule.getEffect(), "WHOLE", null, "Everyone in " + owner, null, false, inherited, removable, scope, by, level, at, madeByMe));
            }
            for (Department d : rule.getGranteeDepartments()) {
                mine1.add(new PersonRow(rule.getId(), rule.getEffect(), "DEPARTMENT", d.getId(), "Department: " + d.getName(), null, false, inherited, removable, scope, by, level, at, madeByMe));
            }
            for (Position pos : rule.getGranteePositions()) {
                mine1.add(new PersonRow(rule.getId(), rule.getEffect(), "POSITION", pos.getId(), "Position: " + pos.getName(), null, false, inherited, removable, scope, by, level, at, madeByMe));
            }
            for (UserAccount u : rule.getGranteeUsers()) {
                if (u.getFullName() == null) {
                    continue;
                }
                String detail = java.util.stream.Stream.of(u.getEmployeeCode(), u.getDepartment()).filter(StringUtils::hasText)
                        .collect(java.util.stream.Collectors.joining(" · "));
                mine1.add(new PersonRow(rule.getId(), rule.getEffect(), "USER", u.getId(), u.getFullName(), detail, delegateUsers.contains(u.getId()), inherited, removable, scope, by, level, at, madeByMe));
            }
            for (PersonRow row : mine1) {
                if (onlyMine && !row.createdByMe()) {
                    continue;
                }
                if (q.isEmpty() || row.label().toLowerCase(Locale.ROOT).contains(q) || (row.detail() != null && row.detail().toLowerCase(Locale.ROOT).contains(q))) {
                    rows.add(row);
                }
            }
        }
        rows.sort(Comparator.comparing(PersonRow::inherited).thenComparing(PersonRow::effect, Comparator.reverseOrder())
                .thenComparing(PersonRow::label, String.CASE_INSENSITIVE_ORDER));
        int from = Math.max(0, Math.min(offset, rows.size()));
        int to = Math.min(rows.size(), from + Math.max(1, Math.min(limit, 50)));
        return new Paged<>(List.copyOf(rows.subList(from, to)), rows.size());
    }

    /**
     * Takes one person (or Position, Department, group) out of a share and leaves the others in it; when the share is left with nobody it is
     * removed whole. The same authority as removing the share applies, and the Audit Trail records who was taken out.
     */
    @Transactional
    public void revokeGrantee(UUID ruleId, String type, UUID granteeId) {
        UserAccount actor = currentUserService.requireCurrentUser();
        ObjectAccessRule rule = ruleRepository.findById(ruleId)
                .filter(r -> r.getOwnerDepartment() != null || r.getOwnerBusinessUnit() != null)
                .orElseThrow(() -> new IllegalArgumentException("Share not found"));
        if (!authority.mayRemove(actor, rule)) {
            throw new AccessDeniedException("You may not remove this share: it was made by "
                    + Level.ofStored(rule.getCreatedAuthority()).name().toLowerCase(Locale.ROOT).replace('_', ' ')
                    + ", and only somebody of the same or a higher level (and, for a delegate, only its maker) can remove it");
        }
        String kindOf = type == null ? "" : type.trim().toUpperCase(Locale.ROOT);
        String owner = rule.getOwnerBusinessUnit() != null ? rule.getOwnerBusinessUnit().getName() : rule.getOwnerDepartment().getName();
        String removed;
        switch (kindOf) {
            case "EVERYONE" -> {
                if (!rule.isGranteeEveryone()) throw new IllegalArgumentException("This share is not for everyone");
                removed = "Everyone";
            }
            case "WHOLE" -> {
                if (!rule.isGranteeWholeDepartment()) throw new IllegalArgumentException("This share is not for the whole Department or Unit");
                removed = "Everyone in " + owner;
            }
            case "DEPARTMENT" -> removed = rule.getGranteeDepartments().stream().filter(d -> d.getId().equals(granteeId)).map(d -> "Department: " + d.getName()).findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("That Department is not in this share"));
            case "POSITION" -> removed = rule.getGranteePositions().stream().filter(d -> d.getId().equals(granteeId)).map(d -> "Position: " + d.getName()).findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("That Position is not in this share"));
            case "USER" -> removed = rule.getGranteeUsers().stream().filter(d -> d.getId().equals(granteeId)).map(UserAccount::getFullName).findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("That person is not in this share"));
            default -> throw new IllegalArgumentException("Unknown kind of grantee");
        }
        int left = (rule.isGranteeEveryone() ? 1 : 0) + (rule.isGranteeWholeDepartment() ? 1 : 0) + rule.getGranteeDepartments().size()
                + rule.getGranteePositions().size() + rule.getGranteeUsers().size();
        if (left <= 1) {
            revoke(ruleId);
            return;
        }
        List<String> before = granteeLabels(rule);
        switch (kindOf) {
            case "EVERYONE" -> rule.setGranteeEveryone(false);
            case "WHOLE" -> rule.setGranteeWholeDepartment(false);
            case "DEPARTMENT" -> rule.getGranteeDepartments().removeIf(d -> d.getId().equals(granteeId));
            case "POSITION" -> rule.getGranteePositions().removeIf(d -> d.getId().equals(granteeId));
            default -> rule.getGranteeUsers().removeIf(d -> d.getId().equals(granteeId));
        }
        ruleRepository.save(rule);
        Level mine = authority.levelOverOwner(actor, rule);
        boolean headOfOwner = mine == Level.DEPARTMENT_HEAD || (mine == Level.UNIT_HEAD && rule.getOwnerBusinessUnit() != null);
        String note = mine == Level.DELEGATE ? " (by a person who may share on behalf of the Head)"
                : headOfOwner ? "" : " by " + actor.getFullName() + ", who is not the Department Head of " + owner;
        auditTrailService.logAs(actor, "OBJECT_ACCESS_RULE", rule.getName(), rule.getId(), "UPDATED", "Active", "Active",
                "Took " + removed + " out of the " + ("DENY".equals(rule.getEffect()) ? "exclusion" : "share") + " of " + scopeLabel(rule) + " in " + owner + note,
                List.of(new AuditTrailChangeResponse("People", String.join(", ", before), String.join(", ", granteeLabels(rule)))));
        if (mine == Level.DELEGATE) {
            List<UserAccount> heads = rule.getOwnerBusinessUnit() != null ? authority.headsToTell(rule.getOwnerBusinessUnit()) : authority.headsToTell(rule.getOwnerDepartment());
            notifier.tell(heads, actor, "a delegate took somebody out of a share", "took somebody out of a share he or she had made in the Knowledge Base",
                    scopeLabel(rule), owner, "Removed: " + removed);
        }
    }

    // ---- changing shares ----------------------------------------------------------------------------------------

    @Transactional
    public NodeAccess grant(GrantRequest request) {
        UserAccount actor = currentUserService.requireCurrentUser();
        Target target = requireTarget(actor, request.kind(), request.businessUnitId(), request.departmentId(), request.documentTypeId(), request.documentId());
        Level level = levelOf(actor, target);
        String effect = request.effect() == null ? "" : request.effect().trim().toUpperCase(Locale.ROOT);
        if (!effect.equals("ALLOW") && !effect.equals("DENY")) {
            throw new IllegalArgumentException("Effect must be ALLOW or DENY");
        }
        if (effect.equals("DENY") && level == Level.DELEGATE) {
            throw new AccessDeniedException("A person who shares on behalf of a Head cannot exclude anybody: only a Head can");
        }
        List<UUID> userIds = distinct(request.userIds());
        List<UUID> positionIds = distinct(request.positionIds());
        List<UUID> departmentIds = distinct(request.departmentIds());
        if (userIds.isEmpty() && positionIds.isEmpty() && departmentIds.isEmpty() && !request.wholeDepartment() && !request.everyone()) {
            throw new IllegalArgumentException("Choose who to share with: people, Positions, Departments, everyone of the Department or Unit, or everyone");
        }
        if (userIds.size() > MAX_USERS || positionIds.size() > MAX_POSITIONS || departmentIds.size() > MAX_DEPARTMENTS) {
            throw new IllegalArgumentException("Too many people, Positions or Departments in one share");
        }
        Set<UserAccount> users = new LinkedHashSet<>(userRepository.findAllById(userIds));
        if (users.size() != userIds.size()) {
            throw new IllegalArgumentException("A chosen user does not exist");
        }
        if (users.stream().anyMatch(u -> u.getStatus() != UserStatus.Active)) {
            throw new IllegalArgumentException("Only active users can be chosen");
        }
        Set<Position> positions = new LinkedHashSet<>(positionRepository.findAllById(positionIds));
        if (positions.size() != positionIds.size()) {
            throw new IllegalArgumentException("A chosen Position does not exist");
        }
        if (positions.stream().anyMatch(p -> !p.isActive())) {
            throw new IllegalArgumentException("Only active Positions can be chosen");
        }
        Set<Department> departments = new LinkedHashSet<>(departmentRepository.findAllById(departmentIds));
        if (departments.size() != departmentIds.size()) {
            throw new IllegalArgumentException("A chosen Department does not exist");
        }
        if (departments.stream().anyMatch(d -> !d.isActive())) {
            throw new IllegalArgumentException("Only active Departments can be chosen");
        }

        ObjectAccessRule rule = new ObjectAccessRule();
        rule.setResourceType(target.kind());
        switch (target.kind()) {
            case "BUSINESS_UNIT" -> {
                rule.setOwnerBusinessUnit(target.unit());
                rule.setResourceId(target.unit().getId());
                rule.setResourceName(target.unit().getName());
            }
            case "DEPARTMENT" -> {
                rule.setOwnerDepartment(target.department());
                rule.setResourceId(target.department().getId());
                rule.setResourceName(target.department().getName());
            }
            case "DOCUMENT_TYPE" -> {
                rule.setOwnerDepartment(target.department());
                rule.setResourceId(target.type().getId());
                rule.setResourceName(target.type().getName());
            }
            default -> {
                rule.setOwnerDepartment(target.department());
                rule.setDocuments(new LinkedHashSet<>(Set.of(target.document())));
                rule.setResourceName("1 document");
            }
        }
        rule.setActions(List.of("VIEW"));
        rule.setEffect(effect);
        // A share of a narrower item ranks above a wider one; an exclusion ranks above every share, so it always wins.
        rule.setPriority((effect.equals("DENY") ? 100 : 0) + switch (target.kind()) {
            case "BUSINESS_UNIT" -> 5;
            case "DEPARTMENT" -> 10;
            case "DOCUMENT_TYPE" -> 20;
            default -> 30;
        });
        rule.setActive(true);
        rule.setAccessProfiles(new LinkedHashSet<>());
        rule.setGranteeUsers(users);
        rule.setGranteePositions(positions);
        rule.setGranteeDepartments(departments);
        rule.setGranteeWholeDepartment(request.wholeDepartment());
        rule.setGranteeEveryone(request.everyone());
        rule.setCreatedAuthority(level.name());
        List<String> who = granteeLabels(rule);
        String verb = effect.equals("DENY") ? "Exclude" : "Share";
        rule.setName(truncate(verb + ": " + nodeLabel(target) + " - " + String.join(", ", who), 200));
        rule.setDescription("Knowledge Base share made from the Knowledge explorer");
        rule.setCreatedBy(actor);
        rule.setUpdatedBy(actor);
        ruleRepository.save(rule);
        auditTrailService.logAs(actor, "OBJECT_ACCESS_RULE", rule.getName(), rule.getId(), "CREATED", null, "Active",
                (effect.equals("DENY") ? "Excluded " : "Shared ") + nodeLabel(target) + " in the Knowledge Base with " + String.join(", ", who)
                        + (level == Level.DELEGATE ? " (made by a person who may share on behalf of the Head)" : ""),
                List.of(new AuditTrailChangeResponse("Item", null, nodeLabel(target)),
                        new AuditTrailChangeResponse("Effect", null, effect.equals("DENY") ? "Exclude" : "Share"),
                        new AuditTrailChangeResponse("People", null, String.join(", ", who))));
        if (level == Level.DELEGATE) {
            notifier.tell(headsToTell(target), actor, "a delegate shared " + nodeKindWord(target), "shared " + nodeKindWord(target) + " in the Knowledge Base",
                    nodeLabel(target), scopeName(target), "Shared with " + String.join(", ", who));
        }
        return access(request.kind(), request.businessUnitId(), request.departmentId(), request.documentTypeId(), request.documentId());
    }

    @Transactional
    public void revoke(UUID ruleId) {
        UserAccount actor = currentUserService.requireCurrentUser();
        ObjectAccessRule rule = ruleRepository.findById(ruleId)
                .filter(r -> r.getOwnerDepartment() != null || r.getOwnerBusinessUnit() != null)
                .orElseThrow(() -> new IllegalArgumentException("Share not found"));
        if (!authority.mayRemove(actor, rule)) {
            throw new AccessDeniedException("You may not remove this share: it was made by "
                    + Level.ofStored(rule.getCreatedAuthority()).name().toLowerCase(Locale.ROOT).replace('_', ' ')
                    + ", and only somebody of the same or a higher level (and, for a delegate, only its maker) can remove it");
        }
        Level mine = authority.levelOverOwner(actor, rule);
        List<String> who = granteeLabels(rule);
        String owner = rule.getOwnerBusinessUnit() != null ? rule.getOwnerBusinessUnit().getName() : rule.getOwnerDepartment().getName();
        // Somebody other than the Head of the owner may remove a share (a Head of Unit, the administrator, the person designated as DCO): the Audit Trail names them.
        boolean headOfOwner = mine == Level.DEPARTMENT_HEAD || (mine == Level.UNIT_HEAD && rule.getOwnerBusinessUnit() != null);
        String note = mine == Level.DELEGATE ? " (by a person who may share on behalf of the Head)"
                : headOfOwner ? "" : " by " + actor.getFullName() + ", who is not the Department Head of " + owner;
        auditTrailService.logAs(actor, "OBJECT_ACCESS_RULE", rule.getName(), rule.getId(), "DELETED", "Active", null,
                "Removed the " + ("DENY".equals(rule.getEffect()) ? "exclusion" : "share") + " of " + scopeLabel(rule) + " in " + owner
                        + " (" + String.join(", ", who) + ")" + note,
                List.of(new AuditTrailChangeResponse("People", String.join(", ", who), null)));
        if (mine == Level.DELEGATE) {
            List<UserAccount> heads = rule.getOwnerBusinessUnit() != null ? authority.headsToTell(rule.getOwnerBusinessUnit()) : authority.headsToTell(rule.getOwnerDepartment());
            notifier.tell(heads, actor, "a delegate removed a share", "removed a share he or she had made in the Knowledge Base", scopeLabel(rule), owner,
                    "Was shared with " + String.join(", ", who));
        }
        ruleRepository.delete(rule);
    }

    // ---- targets -------------------------------------------------------------------------------------------------

    /** The item being shared: a Business Unit alone, or a Department (with its Unit), and the Document Type or document of a narrower item. */
    record Target(String kind, BusinessUnit unit, Department department, DocumentType type, DocumentRecord document) {
        int rank() {
            return switch (kind) {
                case "BUSINESS_UNIT" -> 0;
                case "DEPARTMENT" -> 1;
                case "DOCUMENT_TYPE" -> 2;
                default -> 3;
            };
        }
    }

    Target requireTarget(UserAccount actor, String kind, UUID businessUnitId, UUID departmentId, UUID documentTypeId, UUID documentId) {
        String normalized = kind == null ? "" : kind.trim().toUpperCase(Locale.ROOT);
        Target target;
        switch (normalized) {
            case "BUSINESS_UNIT" -> {
                BusinessUnit unit = businessUnitRepository.findById(need(businessUnitId, "Choose a Business Unit"))
                        .orElseThrow(() -> new IllegalArgumentException("Business Unit not found"));
                target = new Target(normalized, unit, null, null, null);
            }
            case "DEPARTMENT" -> {
                Department department = requireDepartment(departmentId);
                target = new Target(normalized, department.getBusinessUnit(), department, null, null);
            }
            case "DOCUMENT_TYPE" -> {
                Department department = requireDepartment(departmentId);
                DocumentType type = documentTypeRepository.findById(need(documentTypeId, "Choose a Document Type"))
                        .orElseThrow(() -> new IllegalArgumentException("Document Type not found"));
                target = new Target(normalized, department.getBusinessUnit(), department, type, null);
            }
            case "DOCUMENT" -> {
                DocumentRecord document = documentRepository.findById(need(documentId, "Choose a document"))
                        .orElseThrow(() -> new IllegalArgumentException("Document not found"));
                if (document.getDepartment() == null) {
                    throw new IllegalArgumentException("This document has no Department, so nobody can share it");
                }
                target = new Target(normalized, document.getDepartment().getBusinessUnit(), document.getDepartment(), null, document);
            }
            default -> throw new IllegalArgumentException("Share a Business Unit, a Department, a Document Type or a document");
        }
        if (levelOf(actor, target) == Level.NONE) {
            throw new AccessDeniedException("You may not share " + nodeLabel(target) + " in the Knowledge Base: only its Department Head, the Head of its Business Unit, a person they named, or a person who may share every Department, can");
        }
        return target;
    }

    Level levelOf(UserAccount actor, Target target) {
        return target.department() == null ? authority.levelOver(actor, target.unit()) : authority.levelOver(actor, target.department());
    }

    private Node nodeOf(UserAccount actor, Target target, String refusal) {
        Level level = levelOf(actor, target);
        if (level == Level.NONE) {
            return new Node(false, refusal, null, target.unit() == null ? null : target.unit().getId(), target.unit() == null ? null : target.unit().getName(),
                    target.department() == null ? null : target.department().getId(), target.department() == null ? null : target.department().getName(),
                    null, null, nodeLabel(target), false, "NONE", false, false);
        }
        boolean delegates = target.department() == null ? level.atLeast(Level.UNIT_HEAD) : level.atLeast(Level.DEPARTMENT_HEAD);
        return new Node(true, null, target.kind(), target.unit() == null ? null : target.unit().getId(), target.unit() == null ? null : target.unit().getName(),
                target.department() == null ? null : target.department().getId(), target.department() == null ? null : target.department().getName(),
                target.type() == null ? null : target.type().getId(), target.document() == null ? null : target.document().getId(),
                nodeLabel(target), true, level.name(), level != Level.DELEGATE, delegates);
    }

    private Department requireDepartment(UUID departmentId) {
        return departmentRepository.findById(need(departmentId, "Choose a Department"))
                .orElseThrow(() -> new IllegalArgumentException("Department not found"));
    }

    static String nodeLabel(Target target) {
        return switch (target.kind()) {
            case "BUSINESS_UNIT" -> target.unit().getName();
            case "DEPARTMENT" -> target.department().getName();
            case "DOCUMENT_TYPE" -> target.department().getName() + " / " + target.type().getName();
            default -> target.document().getDocumentNumber() + " - " + target.document().getDocumentName();
        };
    }

    private static String nodeKindWord(Target target) {
        return switch (target.kind()) {
            case "BUSINESS_UNIT" -> "the folder of a Business Unit";
            case "DEPARTMENT" -> "the folder of a Department";
            case "DOCUMENT_TYPE" -> "a Document Type folder";
            default -> "a document";
        };
    }

    private static String scopeName(Target target) {
        return target.department() != null ? "Department " + target.department().getName() : "Business Unit " + target.unit().getName();
    }

    private List<UserAccount> headsToTell(Target target) {
        return target.department() != null ? authority.headsToTell(target.department()) : authority.headsToTell(target.unit());
    }

    /** 0 Business Unit, 1 Department, 2 Document Type, 3 document; -1 for a rule that is not a share. */
    static int rank(ObjectAccessRule rule) {
        if (!KnowledgeVisibilityService.isKnowledgeShare(rule)) {
            return -1;
        }
        return switch (rule.getResourceType().trim().toUpperCase(Locale.ROOT)) {
            case "BUSINESS_UNIT" -> 0;
            case "DEPARTMENT" -> 1;
            case "DOCUMENT_TYPE" -> 2;
            default -> 3;
        };
    }

    /** Whether the rule reaches the item: the same or a wider item (a document rule reaches a document that it names). */
    static boolean coversTarget(ObjectAccessRule rule, Target target) {
        return switch (rank(rule)) {
            case 0 -> target.unit() != null && rule.getOwnerBusinessUnit() != null && Objects.equals(rule.getOwnerBusinessUnit().getId(), target.unit().getId());
            case 1 -> target.rank() >= 1;
            case 2 -> target.rank() >= 2 && (target.type() != null
                    ? Objects.equals(rule.getResourceId(), target.type().getId())
                    : target.document() != null && target.document().getDocumentType() != null
                            && Objects.equals(rule.getResourceId(), target.document().getDocumentType().getId()));
            default -> target.rank() == 3 && rule.getDocuments().stream().anyMatch(d -> Objects.equals(d.getId(), target.document().getId()));
        };
    }

    static String scopeLabel(ObjectAccessRule rule) {
        return switch (rule.getResourceType().trim().toUpperCase(Locale.ROOT)) {
            case "BUSINESS_UNIT" -> "Whole Business Unit";
            case "DEPARTMENT" -> "Whole Department";
            case "DOCUMENT_TYPE" -> "Document Type: " + rule.getResourceName();
            default -> rule.getDocuments().size() == 1
                    ? "Document: " + rule.getDocuments().iterator().next().getDocumentNumber()
                    : rule.getDocuments().size() + " documents";
        };
    }

    static List<String> granteeLabels(ObjectAccessRule rule) {
        List<String> labels = new ArrayList<>();
        if (rule.isGranteeEveryone()) {
            labels.add("Everyone");
        }
        if (rule.isGranteeWholeDepartment()) {
            if (rule.getOwnerDepartment() != null) {
                labels.add("Everyone in " + rule.getOwnerDepartment().getName());
            } else if (rule.getOwnerBusinessUnit() != null) {
                labels.add("Everyone in " + rule.getOwnerBusinessUnit().getName());
            }
        }
        rule.getGranteeDepartments().stream().map(Department::getName).sorted(String.CASE_INSENSITIVE_ORDER)
                .forEach(n -> labels.add("Department: " + n));
        rule.getGranteePositions().stream().map(Position::getName).sorted(String.CASE_INSENSITIVE_ORDER)
                .forEach(n -> labels.add("Position: " + n));
        rule.getGranteeUsers().stream().map(UserAccount::getFullName).filter(Objects::nonNull).sorted(String.CASE_INSENSITIVE_ORDER)
                .forEach(labels::add);
        return labels;
    }

    /** The same people, with a mark on the users who may share on behalf of the Head of this Department or Unit. */
    private static List<GranteeChip> granteeChips(ObjectAccessRule rule, Set<UUID> delegateUsers) {
        List<GranteeChip> chips = new ArrayList<>();
        List<String> labels = granteeLabels(rule);
        Set<String> delegateNames = new HashSet<>();
        for (UserAccount user : rule.getGranteeUsers()) {
            if (delegateUsers.contains(user.getId()) && user.getFullName() != null) {
                delegateNames.add(user.getFullName());
            }
        }
        // the specific people are the last labels (sorted by name after the other kinds of grantee)
        int firstUser = labels.size() - (int) rule.getGranteeUsers().stream().filter(u -> u.getFullName() != null).count();
        for (int i = 0; i < labels.size(); i++) {
            chips.add(new GranteeChip(labels.get(i), i >= firstUser && delegateNames.contains(labels.get(i))));
        }
        return chips;
    }

    // ---- authorization -------------------------------------------------------------------------------------------

    private void requireManagesSomething() {
        if (authority.managed(currentUserService.requireCurrentUser()).isEmpty()) {
            throw new AccessDeniedException("Only a Department Head, a Head of Unit, a person they named, or a person who may share every Department, may share the Knowledge Base");
        }
    }

    // ---- helpers -------------------------------------------------------------------------------------------------

    private static Node refused(String reason) {
        return new Node(false, reason, null, null, null, null, null, null, null, null, false, "NONE", false, false);
    }

    private static UUID need(UUID id, String message) {
        if (id == null) {
            throw new IllegalArgumentException(message);
        }
        return id;
    }

    private static UUID parseId(String value) {
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException ex) {
            return new UUID(0L, 0L);
        }
    }

    private static List<UUID> distinct(List<UUID> ids) {
        return ids == null ? List.of() : ids.stream().filter(Objects::nonNull).distinct().toList();
    }

    private static String truncate(String value, int max) {
        return value.length() <= max ? value : value.substring(0, max - 1) + "…";
    }
}
