package com.eqms.repository;

import com.eqms.entity.ObjectAccessRule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ObjectAccessRuleRepository extends JpaRepository<ObjectAccessRule, UUID> {
    List<ObjectAccessRule> findAllByOrderByPriorityDescNameAsc();
    List<ObjectAccessRule> findAllByActiveOrderByPriorityDescNameAsc(boolean active);

    /**
     * The active shares (rules owned by a Department or by a Business Unit) that may concern one user: for everyone, for the people of the
     * owner Department or Unit, for the user, for the user's Department, or for the user's Position (lower-case, trimmed). The caller repeats
     * the test in Java.
     */
    @org.springframework.data.jpa.repository.Query("""
            SELECT DISTINCT r FROM ObjectAccessRule r
            LEFT JOIN FETCH r.ownerDepartment od
            LEFT JOIN FETCH r.ownerBusinessUnit ob
            WHERE r.active = true AND (od IS NOT NULL OR ob IS NOT NULL) AND (
                r.granteeEveryone = true
                OR (r.granteeWholeDepartment = true AND (od.id = :departmentId OR ob.id = :businessUnitId))
                OR EXISTS (SELECT 1 FROM r.granteeUsers u WHERE u.id = :userId)
                OR EXISTS (SELECT 1 FROM r.granteeDepartments d WHERE d.id = :departmentId)
                OR EXISTS (SELECT 1 FROM r.granteePositions p WHERE lower(trim(p.name)) = :position))
            """)
    List<ObjectAccessRule> findSharesThatMayApply(
            @org.springframework.data.repository.query.Param("userId") UUID userId,
            @org.springframework.data.repository.query.Param("departmentId") UUID departmentId,
            @org.springframework.data.repository.query.Param("businessUnitId") UUID businessUnitId,
            @org.springframework.data.repository.query.Param("position") String position);

    List<ObjectAccessRule> findAllByOwnerDepartment_IdOrderByPriorityDescNameAsc(UUID departmentId);

    List<ObjectAccessRule> findAllByOwnerBusinessUnit_IdOrderByPriorityDescNameAsc(UUID businessUnitId);

    /** Every share of every Department and Business Unit (the administrator's overview). */
    List<ObjectAccessRule> findAllByOwnerDepartmentIsNotNullOrOwnerBusinessUnitIsNotNullOrderByCreatedAtDesc();
}
