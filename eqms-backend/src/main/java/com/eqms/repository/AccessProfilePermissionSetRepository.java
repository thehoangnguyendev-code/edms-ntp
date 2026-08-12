package com.eqms.repository;

import com.eqms.entity.AccessProfilePermissionSet;
import com.eqms.entity.AccessProfilePermissionSetId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface AccessProfilePermissionSetRepository extends JpaRepository<AccessProfilePermissionSet, AccessProfilePermissionSetId> {

    List<AccessProfilePermissionSet> findByAccessProfileId(UUID accessProfileId);

    @Modifying
    @Query("DELETE FROM AccessProfilePermissionSet a WHERE a.accessProfileId = :profileId")
    void deleteByAccessProfileId(UUID profileId);

    @Modifying
    @Query("DELETE FROM AccessProfilePermissionSet a WHERE a.accessProfileId = :profileId AND a.permissionSetId = :setId")
    void deleteByAccessProfileIdAndPermissionSetId(UUID profileId, UUID setId);

    boolean existsByAccessProfileIdAndPermissionSetId(UUID profileId, UUID setId);

    long countByPermissionSetId(UUID permissionSetId);

    List<AccessProfilePermissionSet> findByPermissionSetId(UUID permissionSetId);
}
