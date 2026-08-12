package com.eqms.repository;

import com.eqms.entity.RolePermission;
import com.eqms.entity.RolePermissionId;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface RolePermissionRepository extends JpaRepository<RolePermission, RolePermissionId> {
    @EntityGraph(attributePaths = {"permission"})
    List<RolePermission> findAllByRole_Id(UUID roleId);
    void deleteAllByRole_Id(UUID roleId);
}
