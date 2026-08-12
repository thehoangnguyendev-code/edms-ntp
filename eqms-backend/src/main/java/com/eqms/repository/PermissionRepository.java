package com.eqms.repository;

import com.eqms.entity.Permission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PermissionRepository extends JpaRepository<Permission, UUID> {
    Optional<Permission> findByCode(String code);
    List<Permission> findAllByModuleKeyIgnoreCaseOrderByDisplayOrderAscCodeAsc(String moduleKey);
    List<Permission> findAllByRequiresAuditOrderByModuleKeyAscGroupKeyAscDisplayOrderAscCodeAsc(boolean requiresAudit);

    @Query("""
        SELECT p FROM Permission p
        WHERE LOWER(COALESCE(p.name,'')) LIKE LOWER(CONCAT('%',:q,'%'))
           OR LOWER(COALESCE(p.code,'')) LIKE LOWER(CONCAT('%',:q,'%'))
           OR LOWER(COALESCE(p.description,'')) LIKE LOWER(CONCAT('%',:q,'%'))
           OR LOWER(COALESCE(p.moduleKey,'')) LIKE LOWER(CONCAT('%',:q,'%'))
           OR LOWER(COALESCE(p.groupKey,'')) LIKE LOWER(CONCAT('%',:q,'%'))
        ORDER BY p.moduleKey ASC, p.groupKey ASC, p.displayOrder ASC, p.code ASC
        """)
    List<Permission> searchPermissions(@Param("q") String query);
}
