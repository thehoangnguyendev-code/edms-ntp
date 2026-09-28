package com.eqms.repository;

import com.eqms.entity.LifecycleStatePolicy;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface LifecycleStatePolicyRepository extends JpaRepository<LifecycleStatePolicy, UUID> {

    /** See {@link com.eqms.repository.WorkflowActionPolicyRepository#findAllByRequiredPermissionCodeInAndActiveTrue}. */
    List<LifecycleStatePolicy> findAllByRequiredPermissionCodeInAndActiveTrue(Collection<String> codes);

    List<LifecycleStatePolicy> findAllByOrderByCapabilityCodeAscPriorityDescCreatedAtAsc();

    List<LifecycleStatePolicy> findAllByModuleKeyAndObjectTypeAndCapabilityCodeAndActiveTrueOrderByPriorityDesc(
            String moduleKey, String objectType, String capabilityCode);
}
