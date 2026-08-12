package com.eqms.repository;

import com.eqms.entity.WorkflowActionPolicyActor;
import com.eqms.enums.WorkflowActorType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface WorkflowActionPolicyActorRepository extends JpaRepository<WorkflowActionPolicyActor, UUID> {

    List<WorkflowActionPolicyActor> findByPolicy_Id(UUID policyId);

    void deleteByPolicy_Id(UUID policyId);

    boolean existsByPolicy_IdAndActorTypeAndActorCode(UUID policyId, WorkflowActorType actorType, String actorCode);
}
