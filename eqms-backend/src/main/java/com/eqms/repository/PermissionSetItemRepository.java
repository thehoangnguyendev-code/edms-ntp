package com.eqms.repository;

import com.eqms.entity.PermissionSetItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface PermissionSetItemRepository extends JpaRepository<PermissionSetItem, UUID> {
    List<PermissionSetItem> findAllByPermissionSet_Id(UUID permissionSetId);

    /**
     * Bulk delete that runs immediately. The derived {@code deleteAllBy...} only schedules removals, and Hibernate flushes
     * inserts before deletes, so re-inserting a permission that was kept (the usual "replace all items" flow) violated the
     * unique (permission_set_id, permission_id) constraint. Pending changes are flushed first so nothing is lost.
     */
    @Modifying(flushAutomatically = true)
    @Query("delete from PermissionSetItem i where i.permissionSet.id = :permissionSetId")
    void deleteAllByPermissionSet_Id(@Param("permissionSetId") UUID permissionSetId);
}
