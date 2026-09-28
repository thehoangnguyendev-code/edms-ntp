package com.eqms.repository;

import com.eqms.entity.KnowledgeCategoryLevel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.UUID;

public interface KnowledgeCategoryLevelRepository extends JpaRepository<KnowledgeCategoryLevel, UUID> {
    @Query("select count(distinct l.hierarchy.id) from KnowledgeCategoryLevel l where l.fieldCode = :field")
    long countHierarchiesUsingLevel(@Param("field") String field);
}
