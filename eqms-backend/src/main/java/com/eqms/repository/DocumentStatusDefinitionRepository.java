package com.eqms.repository;

import com.eqms.entity.DocumentStatusDefinition;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DocumentStatusDefinitionRepository extends JpaRepository<DocumentStatusDefinition, String> {
    List<DocumentStatusDefinition> findAllByOrderBySortOrderAsc();
}
