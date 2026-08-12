package com.eqms.repository;

import com.eqms.entity.RevisionStatusDefinition;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RevisionStatusDefinitionRepository extends JpaRepository<RevisionStatusDefinition, String> {
    List<RevisionStatusDefinition> findAllByOrderBySortOrderAsc();
}
