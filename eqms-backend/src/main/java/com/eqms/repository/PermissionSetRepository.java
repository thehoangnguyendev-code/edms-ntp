package com.eqms.repository;

import com.eqms.entity.PermissionSet;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PermissionSetRepository extends JpaRepository<PermissionSet, UUID> {
    Optional<PermissionSet> findByCode(String code);
    Optional<PermissionSet> findByName(String name);
    List<PermissionSet> findAllByOrderByNameAsc();
    List<PermissionSet> findAllByActiveOrderByNameAsc(boolean active);

    @Query("SELECT COUNT(i) FROM PermissionSetItem i WHERE i.permissionSet.id = :id")
    int countItemsById(UUID id);
}
