package com.eqms.repository;

import com.eqms.entity.WorkflowActionPolicy;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WorkflowActionPolicyRepository extends JpaRepository<WorkflowActionPolicy, UUID> {

    /** Resolve policy for a specific document type (document-type-specific override). */
    @Query("""
            SELECT p FROM WorkflowActionPolicy p
            WHERE p.moduleKey = :moduleKey
              AND p.workflowKey = :workflowKey
              AND p.objectType = :objectType
              AND p.actionCode = :actionCode
              AND p.fromStatus = :fromStatus
              AND p.documentTypeId = :documentTypeId
              AND p.active = true
            ORDER BY p.priority ASC, p.updatedAt DESC
            """)
    List<WorkflowActionPolicy> findActivePoliciesForDocumentType(
            String moduleKey, String workflowKey, String objectType,
            String actionCode, String fromStatus, UUID documentTypeId);

    /** Resolve global policy (documentTypeId IS NULL). */
    @Query("""
            SELECT p FROM WorkflowActionPolicy p
            WHERE p.moduleKey = :moduleKey
              AND p.workflowKey = :workflowKey
              AND p.objectType = :objectType
              AND p.actionCode = :actionCode
              AND p.fromStatus = :fromStatus
              AND p.documentTypeId IS NULL
              AND p.active = true
            ORDER BY p.priority ASC, p.updatedAt DESC
            """)
    List<WorkflowActionPolicy> findActiveGlobalPolicies(
            String moduleKey, String workflowKey, String objectType,
            String actionCode, String fromStatus);

    /** List all policies for a given action (active + inactive) for admin. */
    List<WorkflowActionPolicy> findByActionCodeOrderByPriorityAscUpdatedAtDesc(String actionCode);

    /**
     * Whether this action is wired up at all (any fromStatus), scoped to a specific module/workflow/
     * object type. Used to tell apart "action genuinely never configured" from "action is configured,
     * just not for this particular state" when {@link com.eqms.service.authorization.ResourceAuthorizationAdapter#resolvePolicy}
     * returns empty -- the two cases warrant different diagnostic reason codes.
     */
    boolean existsByModuleKeyAndWorkflowKeyAndObjectTypeAndActionCodeAndActiveTrue(
            String moduleKey, String workflowKey, String objectType, String actionCode);

    /** All policies page-able — for list API. */
    List<WorkflowActionPolicy> findAllByOrderByActionCodeAscPriorityAsc();

    Optional<WorkflowActionPolicy> findByIdAndSystemTrue(UUID id);

    /** Count active policies for an action (any fromStatus), excluding one id — for deactivation safety. */
    @Query("""
            SELECT COUNT(p) FROM WorkflowActionPolicy p
            WHERE p.moduleKey = :moduleKey
              AND p.workflowKey = :workflowKey
              AND p.objectType = :objectType
              AND p.actionCode = :actionCode
              AND p.active = true
              AND p.id <> :excludeId
            """)
    long countActiveForAction(
            @Param("moduleKey") String moduleKey,
            @Param("workflowKey") String workflowKey,
            @Param("objectType") String objectType,
            @Param("actionCode") String actionCode,
            @Param("excludeId") UUID excludeId);

    /** Detect exact active duplicate (same tuple + priority), optionally excluding one id. */
    @Query("""
            SELECT COUNT(p) > 0 FROM WorkflowActionPolicy p
            WHERE p.moduleKey = :moduleKey
              AND p.workflowKey = :workflowKey
              AND p.objectType = :objectType
              AND p.actionCode = :actionCode
              AND p.fromStatus = :fromStatus
              AND p.active = true
              AND p.priority = :priority
              AND ((:documentTypeId IS NULL AND p.documentTypeId IS NULL)
                   OR p.documentTypeId = :documentTypeId)
              AND p.id <> :excludeId
            """)
    boolean existsActiveDuplicate(
            @Param("moduleKey") String moduleKey,
            @Param("workflowKey") String workflowKey,
            @Param("objectType") String objectType,
            @Param("actionCode") String actionCode,
            @Param("fromStatus") String fromStatus,
            @Param("priority") int priority,
            @Param("documentTypeId") UUID documentTypeId,
            @Param("excludeId") UUID excludeId);
}
