package com.eqms.repository;

import com.eqms.entity.WorkflowActionPolicyRelation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface WorkflowActionPolicyRelationRepository extends JpaRepository<WorkflowActionPolicyRelation, UUID> {
    List<WorkflowActionPolicyRelation> findAllByPolicy_IdAndActiveTrueOrderByPriorityAsc(UUID policyId);
    void deleteAllByPolicy_Id(UUID policyId);
}
