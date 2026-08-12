package com.eqms.repository;

import com.eqms.entity.PermissionSetItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PermissionSetItemRepository extends JpaRepository<PermissionSetItem, UUID> {
    List<PermissionSetItem> findAllByPermissionSet_Id(UUID permissionSetId);
    void deleteAllByPermissionSet_Id(UUID permissionSetId);
}
