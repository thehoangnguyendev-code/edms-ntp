package com.eqms.repository;

import com.eqms.entity.UserAccessProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface UserAccessProfileRepository extends JpaRepository<UserAccessProfile, UserAccessProfile.PK> {

    List<UserAccessProfile> findByAccessProfileId(UUID accessProfileId);

    List<UserAccessProfile> findByUserId(UUID userId);

    @Modifying
    @Query("DELETE FROM UserAccessProfile u WHERE u.userId = :userId AND u.accessProfileId = :profileId")
    void deleteByUserIdAndAccessProfileId(UUID userId, UUID profileId);

    boolean existsByUserIdAndAccessProfileId(UUID userId, UUID profileId);

    @Query("SELECT COUNT(u) FROM UserAccessProfile u WHERE u.accessProfileId = :profileId")
    long countByAccessProfileId(UUID profileId);

    @Query("SELECT COUNT(u) > 0 FROM UserAccessProfile u JOIN RoleDefinition r ON u.accessProfileId = r.id WHERE u.userId = :userId AND r.code = :profileCode")
    boolean existsByUserIdAndProfileCode(@Param("userId") UUID userId, @Param("profileCode") String profileCode);

    @Query("SELECT COUNT(u) FROM UserAccessProfile u JOIN RoleDefinition r ON u.accessProfileId = r.id WHERE r.code = :profileCode AND r.active = true")
    long countByActiveProfileCode(@Param("profileCode") String profileCode);

    /**
     * Users whose Access Profile carries the given Workflow Role code (join through
     * access_profile_workflow_roles). This is the new catalog-based lookup that
     * supplements (not yet replaces) the legacy document_workflow_pool_members path
     * for role-based bypass checks (see workflow_roles catalog, V172).
     */
    @Query("SELECT DISTINCT u.userId FROM UserAccessProfile u "
            + "JOIN com.eqms.entity.AccessProfileWorkflowRole apwr ON apwr.accessProfileId = u.accessProfileId "
            + "WHERE apwr.workflowRole = :workflowRole")
    List<UUID> findUserIdsByWorkflowRole(@Param("workflowRole") String workflowRole);

    /**
     * Users whose Access Profile code is one of the given codes (e.g. DCO/DOCUMENT_CONTROLLER).
     * Used by T-P1-4 to resolve workflow-policy ACCESS_PROFILE actors to real recipients,
     * instead of hard-coding a permission-only recipient list.
     */
    @Query("SELECT DISTINCT u.userId FROM UserAccessProfile u JOIN RoleDefinition r ON u.accessProfileId = r.id "
            + "WHERE r.code IN :profileCodes AND r.active = true")
    List<UUID> findUserIdsByProfileCodes(@Param("profileCodes") Collection<String> profileCodes);
}
