package com.eqms.repository;

import com.eqms.entity.KnowledgeCategoryComponent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface KnowledgeCategoryComponentRepository extends JpaRepository<KnowledgeCategoryComponent, UUID> {
    Optional<KnowledgeCategoryComponent> findBySourceField(String sourceField);
    boolean existsBySourceField(String sourceField);
    boolean existsByNameIgnoreCase(String name);
    boolean existsByNameIgnoreCaseAndIdNot(String name, UUID id);
    List<KnowledgeCategoryComponent> findAllByActiveTrue();
}
