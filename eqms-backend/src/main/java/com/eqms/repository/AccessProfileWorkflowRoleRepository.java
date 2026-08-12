package com.eqms.repository;

import com.eqms.entity.AccessProfileWorkflowRole;
import com.eqms.entity.UserAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface AccessProfileWorkflowRoleRepository extends JpaRepository<AccessProfileWorkflowRole, AccessProfileWorkflowRole.PK> {

    List<AccessProfileWorkflowRole> findByAccessProfileId(UUID accessProfileId);

    List<AccessProfileWorkflowRole> findByWorkflowRole(String workflowRole);

    /**
     * Users who hold {@code workflowRole} through an active Access Profile
     * assignment (join user_access_profiles -> access_profile_workflow_roles,
     * filtering the profile's is_active flag). Replaces the
     * document_workflow_pool_members-based lookup for the DCO-bypass and
     * similar role-driven checks (see 0.5a migration V172). Distinct + ordered
     * by user id for deterministic, comparable results in parity tests.
     */
    @Query("SELECT DISTINCT uap.user FROM UserAccessProfile uap "
            + "JOIN AccessProfileWorkflowRole apwr ON apwr.accessProfileId = uap.accessProfileId "
            + "WHERE apwr.workflowRole = :workflowRole AND uap.accessProfile.active = true "
            + "ORDER BY uap.user.id")
    List<UserAccount> findUsersByWorkflowRole(String workflowRole);

    @Modifying
    @Query("DELETE FROM AccessProfileWorkflowRole a WHERE a.accessProfileId = :profileId")
    void deleteByAccessProfileId(UUID profileId);

    @Modifying
    @Query("DELETE FROM AccessProfileWorkflowRole a WHERE a.accessProfileId = :profileId AND a.workflowRole = :role")
    void deleteByAccessProfileIdAndWorkflowRole(UUID profileId, String role);
}
