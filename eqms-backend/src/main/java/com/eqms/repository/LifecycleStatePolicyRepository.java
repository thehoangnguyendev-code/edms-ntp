package com.eqms.repository;

import com.eqms.entity.LifecycleStatePolicy;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface LifecycleStatePolicyRepository extends JpaRepository<LifecycleStatePolicy, UUID> {

    List<LifecycleStatePolicy> findAllByOrderByCapabilityCodeAscPriorityDescCreatedAtAsc();

    List<LifecycleStatePolicy> findAllByModuleKeyAndObjectTypeAndCapabilityCodeAndActiveTrueOrderByPriorityDesc(
            String moduleKey, String objectType, String capabilityCode);
}
