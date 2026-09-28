package com.eqms.repository;

import com.eqms.entity.PermissionDependency;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PermissionDependencyRepository extends JpaRepository<PermissionDependency, UUID> {

    List<PermissionDependency> findAllByPermissionCode(String permissionCode);

    List<PermissionDependency> findAllByRelationType(String relationType);
}
