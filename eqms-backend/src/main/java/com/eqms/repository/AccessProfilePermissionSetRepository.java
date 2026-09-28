package com.eqms.repository;

import com.eqms.entity.AccessProfilePermissionSet;
import com.eqms.entity.AccessProfilePermissionSetId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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

    /** The Permission Set(s) inside one specific Access Profile that actually grant a given
     *  permission code -- used to scope SoD remediation guidance to the real unit of grant
     *  (a Permission Set, shared across profiles) rather than vaguely naming just the profile. */
    @Query("SELECT DISTINCT aps.permissionSet FROM AccessProfilePermissionSet aps "
            + "JOIN com.eqms.entity.PermissionSetItem psi ON psi.permissionSet.id = aps.permissionSetId "
            + "WHERE aps.accessProfileId = :profileId AND psi.permission.code = :permissionCode")
    List<com.eqms.entity.PermissionSet> findPermissionSetsInProfileGrantingPermission(
            @Param("profileId") UUID profileId, @Param("permissionCode") String permissionCode);
}
