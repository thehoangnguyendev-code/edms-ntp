package com.eqms.repository;

import com.eqms.entity.ControlledCopyStatusDefinition;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ControlledCopyStatusDefinitionRepository extends JpaRepository<ControlledCopyStatusDefinition, String> {
    List<ControlledCopyStatusDefinition> findAllByOrderBySortOrderAsc();
}
