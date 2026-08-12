package com.eqms.repository;

import com.eqms.entity.SodConstraint;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SodConstraintRepository extends JpaRepository<SodConstraint, UUID> {
    List<SodConstraint> findAllByOrderByNameAsc();
    List<SodConstraint> findAllByActiveOrderByNameAsc(boolean active);

    @Query("""
        SELECT s FROM SodConstraint s WHERE s.active = true
          AND ((s.permissionCodeA = :codeA AND s.permissionCodeB = :codeB)
            OR (s.permissionCodeA = :codeB AND s.permissionCodeB = :codeA))
        """)
    Optional<SodConstraint> findConflict(@Param("codeA") String codeA, @Param("codeB") String codeB);

    @Query("""
        SELECT s FROM SodConstraint s WHERE s.active = true
          AND (s.permissionCodeA IN :codes OR s.permissionCodeB IN :codes)
        """)
    List<SodConstraint> findActiveConstraintsInvolvingAny(@Param("codes") java.util.Collection<String> codes);
}
