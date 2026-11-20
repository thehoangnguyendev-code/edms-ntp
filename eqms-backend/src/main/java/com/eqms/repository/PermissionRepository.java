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

    /**
     * For Access Explorer: for every permission, how many ACTIVE permission sets contain it, how many ACTIVE access profiles use those sets, and how many people hold it through
     * them (and how many of those have an Active account). It follows the same chain as the sign-in and as the Permission Holders report. Columns: code, sets, profiles, people, active people.
     */
    @Query(value = """
        SELECT p.code,
               COUNT(DISTINCT ps.id),
               COUNT(DISTINCT rl.id),
               COUNT(DISTINCT u.id),
               COUNT(DISTINCT CASE WHEN u.status = 'Active' THEN u.id END)
        FROM permissions p
        LEFT JOIN permission_set_items psi ON psi.permission_id = p.id
        LEFT JOIN permission_sets ps ON ps.id = psi.permission_set_id AND ps.active
        LEFT JOIN access_profile_permission_sets aps ON aps.permission_set_id = ps.id
        LEFT JOIN roles rl ON rl.id = aps.access_profile_id AND rl.is_active
        LEFT JOIN user_access_profiles uap ON uap.access_profile_id = rl.id
        LEFT JOIN app_users u ON u.id = uap.user_id
        GROUP BY p.code
        """, nativeQuery = true)
    List<Object[]> holderCountsByCode();
}
