package com.eqms.service;

import com.eqms.entity.BusinessUnit;
import com.eqms.entity.Department;
import com.eqms.entity.KnowledgeShareDelegate;
import com.eqms.entity.ObjectAccessRule;
import com.eqms.entity.UserAccount;
import com.eqms.repository.BusinessUnitRepository;
import com.eqms.repository.DepartmentRepository;
import com.eqms.repository.KnowledgeShareDelegateRepository;
import org.springframework.stereotype.Service;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * Who may share the Knowledge Base, and at what level. Permission-driven, never a role name:
 * <ul>
 *   <li>ADMIN: a holder of security.object_rules.manage or security.object_rules.share_knowledge_any_department (the administrator; the person
 *       designated as DCO), for every Department and Business Unit;</li>
 *   <li>UNIT_HEAD: the Head of Unit named on a Business Unit (Dictionaries), for that Unit and every Department in it;</li>
 *   <li>DEPARTMENT_HEAD: the Department Head named on a Department (Dictionaries), for that Department;</li>
 *   <li>DELEGATE: a person a Head named (Business Unit or Department scope). A delegate shares like the Head but never excludes, never removes
 *       what somebody else shared, never names other delegates.</li>
 * </ul>
 * Nobody removes what a higher level made: a share carries the level of who made it ({@link ObjectAccessRule#getCreatedAuthority()}).
 */
@Service
public class KnowledgeShareAuthorityService {
    public static final String MANAGE_ALL_PERMISSION = "security.object_rules.manage";
    public static final String SHARE_ANY_DEPARTMENT_PERMISSION = "security.object_rules.share_knowledge_any_department";

    public enum Level {
        NONE(0), DELEGATE(1), DEPARTMENT_HEAD(2), UNIT_HEAD(3), ADMIN(4);

        private final int rank;

        Level(int rank) {
            this.rank = rank;
        }

        public int rank() {
            return rank;
        }

        public boolean atLeast(Level other) {
            return rank >= other.rank;
        }

        /** The level stored with a share; a share from before the column existed was made by a Department Head. */
        public static Level ofStored(String stored) {
            if (stored == null) {
                return DEPARTMENT_HEAD;
            }
            try {
                return valueOf(stored);
            } catch (IllegalArgumentException ex) {
                return DEPARTMENT_HEAD;
            }
        }
    }

    /** The Departments and Business Units a user may share (any level). */
    public record Managed(Set<UUID> departmentIds, Set<UUID> businessUnitIds) {
        public boolean isEmpty() {
            return departmentIds.isEmpty() && businessUnitIds.isEmpty();
        }
    }

    private final PermissionEvaluationService permissions;
    private final DepartmentRepository departmentRepository;
    private final BusinessUnitRepository businessUnitRepository;
    private final KnowledgeShareDelegateRepository delegateRepository;

    public KnowledgeShareAuthorityService(PermissionEvaluationService permissions, DepartmentRepository departmentRepository,
                                          BusinessUnitRepository businessUnitRepository, KnowledgeShareDelegateRepository delegateRepository) {
        this.permissions = permissions;
        this.departmentRepository = departmentRepository;
        this.businessUnitRepository = businessUnitRepository;
        this.delegateRepository = delegateRepository;
    }

    public boolean isAdmin(UserAccount actor) {
        return permissions.hasPermission(actor, MANAGE_ALL_PERMISSION) || permissions.hasPermission(actor, SHARE_ANY_DEPARTMENT_PERMISSION);
    }

    /** The highest level the actor holds over a Department (and so over its Document Types and documents). */
    public Level levelOver(UserAccount actor, Department department) {
        if (actor == null || department == null) {
            return Level.NONE;
        }
        if (isAdmin(actor)) {
            return Level.ADMIN;
        }
        // being named on the Department or the Unit (only the administrator edits Dictionaries) is the whole grant: there is no permission to assign
        BusinessUnit unit = department.getBusinessUnit();
        if (unit != null && isUser(unit.getHeadOfUnit(), actor)) {
            return Level.UNIT_HEAD;
        }
        if (isUser(department.getDepartmentHead(), actor)) {
            return Level.DEPARTMENT_HEAD;
        }
        if (delegateRepository.findByDepartment_IdAndUser_Id(department.getId(), actor.getId()).isPresent()
                || (unit != null && delegateRepository.findByBusinessUnit_IdAndUser_Id(unit.getId(), actor.getId()).isPresent())) {
            return Level.DELEGATE;
        }
        return Level.NONE;
    }

    /** The highest level the actor holds over a Business Unit (the folder of the whole Unit). */
    public Level levelOver(UserAccount actor, BusinessUnit unit) {
        if (actor == null || unit == null) {
            return Level.NONE;
        }
        if (isAdmin(actor)) {
            return Level.ADMIN;
        }
        if (isUser(unit.getHeadOfUnit(), actor)) {
            return Level.UNIT_HEAD;
        }
        if (delegateRepository.findByBusinessUnit_IdAndUser_Id(unit.getId(), actor.getId()).isPresent()) {
            return Level.DELEGATE;
        }
        return Level.NONE;
    }

    /** The level the actor holds over the owner of a share (its Department or its Business Unit). */
    public Level levelOverOwner(UserAccount actor, ObjectAccessRule rule) {
        return rule.getOwnerBusinessUnit() != null ? levelOver(actor, rule.getOwnerBusinessUnit()) : levelOver(actor, rule.getOwnerDepartment());
    }

    /**
     * Whether the actor may remove a share: the level over its owner must be at least the level of who made it, and a delegate removes only what
     * he made himself.
     */
    public boolean mayRemove(UserAccount actor, ObjectAccessRule rule) {
        return mayRemove(actor, levelOverOwner(actor, rule), rule.getCreatedAuthority(), rule.getCreatedBy());
    }

    /** The same rule for anything a person made (a share, a link): {@code mine} is the level over its owner. */
    public boolean mayRemove(UserAccount actor, Level mine, String createdAuthority, UserAccount createdBy) {
        Level made = Level.ofStored(createdAuthority);
        if (mine == Level.NONE || !mine.atLeast(made)) {
            return false;
        }
        return mine != Level.DELEGATE || (createdBy != null && Objects.equals(createdBy.getId(), actor.getId()));
    }

    /** Everything the user may share: for the explorer to know whether to offer "Share". */
    public Managed managed(UserAccount actor) {
        Set<UUID> departments = new LinkedHashSet<>();
        Set<UUID> units = new LinkedHashSet<>();
        if (actor == null || actor.getId() == null) {
            return new Managed(departments, units);
        }
        if (isAdmin(actor)) {
            departmentRepository.findAllByActiveTrueOrderByNameAsc().forEach(d -> departments.add(d.getId()));
            businessUnitRepository.findAllByActiveTrueOrderByNameAsc().forEach(u -> units.add(u.getId()));
            return new Managed(departments, units);
        }
        departmentRepository.findAllByDepartmentHead_Id(actor.getId()).forEach(d -> departments.add(d.getId()));
        for (BusinessUnit unit : businessUnitRepository.findAllByHeadOfUnit_Id(actor.getId())) {
            units.add(unit.getId());
            departmentRepository.findAllByBusinessUnit_Id(unit.getId()).forEach(d -> departments.add(d.getId()));
        }
        for (KnowledgeShareDelegate delegate : delegateRepository.findAllByUser_Id(actor.getId())) {
            if (delegate.getDepartment() != null) {
                departments.add(delegate.getDepartment().getId());
            }
            if (delegate.getBusinessUnit() != null) {
                units.add(delegate.getBusinessUnit().getId());
                departmentRepository.findAllByBusinessUnit_Id(delegate.getBusinessUnit().getId()).forEach(d -> departments.add(d.getId()));
            }
        }
        return new Managed(departments, units);
    }

    /** The people to tell when a delegate acts on a Department: its Head, else the Head of Unit. Empty when neither is named. */
    public List<UserAccount> headsToTell(Department department) {
        if (department.getDepartmentHead() != null) {
            return List.of(department.getDepartmentHead());
        }
        BusinessUnit unit = department.getBusinessUnit();
        return unit != null && unit.getHeadOfUnit() != null ? List.of(unit.getHeadOfUnit()) : List.of();
    }

    /** The people to tell when a delegate acts on a Business Unit: its Head of Unit. */
    public List<UserAccount> headsToTell(BusinessUnit unit) {
        return unit != null && unit.getHeadOfUnit() != null ? List.of(unit.getHeadOfUnit()) : List.of();
    }

    public boolean isDelegateOf(UserAccount user, Department department) {
        if (user == null || user.getId() == null || department == null) {
            return false;
        }
        return delegateRepository.findByDepartment_IdAndUser_Id(department.getId(), user.getId()).isPresent()
                || (department.getBusinessUnit() != null
                && delegateRepository.findByBusinessUnit_IdAndUser_Id(department.getBusinessUnit().getId(), user.getId()).isPresent());
    }

    private static boolean isUser(UserAccount candidate, UserAccount actor) {
        return candidate != null && actor.getId() != null && actor.getId().equals(candidate.getId());
    }
}
