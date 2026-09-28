package com.eqms.repository;

import com.eqms.entity.KnowledgeCategoryHierarchy;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface KnowledgeCategoryHierarchyRepository extends JpaRepository<KnowledgeCategoryHierarchy, UUID> {
    boolean existsByNameIgnoreCase(String name);
    long countByDeterminatorField(String determinatorField);
    boolean existsByNameIgnoreCaseAndIdNot(String name, UUID id);
    Optional<KnowledgeCategoryHierarchy> findByDefaultHierarchyTrue();
    List<KnowledgeCategoryHierarchy> findAllByActiveTrueOrderByNameAsc();
}
