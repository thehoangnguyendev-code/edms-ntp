package com.eqms.repository;

import com.eqms.entity.WorkflowRole;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WorkflowRoleRepository extends JpaRepository<WorkflowRole, UUID>, JpaSpecificationExecutor<WorkflowRole> {

    List<WorkflowRole> findAllByOrderByDisplayOrderAscLabelAsc();

    List<WorkflowRole> findAllByActiveTrueOrderByDisplayOrderAscLabelAsc();

    Optional<WorkflowRole> findByCode(String code);

    Optional<WorkflowRole> findByCodeIgnoreCase(String code);

    @Query("select distinct w.moduleKey from WorkflowRole w where w.moduleKey is not null and w.moduleKey <> '' order by w.moduleKey")
    List<String> findDistinctModuleKeys();
}
